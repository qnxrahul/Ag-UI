# # agents/spending_checker.py
# from __future__ import annotations
# from typing import Dict, Any, List
# from llm.driver import generate_json
# from facts import store as facts_store
# from retrieval.index import DocIndex, Chunk

# SPENDING_SCHEMA_HINT = """
# {
#   "tiers": [
#     {
#       "name": "UnderThreshold",
#       "condition": { "field": "amount", "op": "<", "value": 20000, "currency": "USD" },
#       "required_steps": ["CertifyInvoice","ManagerApproval"],
#       "citations": ["chunk_23","chunk_41"]
#     },
#     {
#       "name": "AtOrOverThreshold",
#       "condition": { "field": "amount", "op": ">=", "value": 20000, "currency": "USD" },
#       "required_steps": ["CertifyInvoice","ManagerApproval","DualSignatures","RFP"],
#       "citations": ["chunk_25"]
#     }
#   ],
#   "exceptions": [
#     { "if": {"category":"asset"}, "then_add_steps": ["AssetRegisterEntry"], "citations": ["chunk_37"] }
#   ],
#   "notes": "short optional note",
#   "ambiguous": false,
#   "candidates": []
# }
# """

# PROMPT = """
# Extract procurement/spending tiers and the procedural steps required for each tier.
# - Identify the numeric thresholds and currency.
# - Identify steps that apply regardless of amount (e.g., two signatures on all cheques).
# - Identify exceptions that add/remove steps for certain categories or vendor types.
# - Include citations by listing chunk ids where each rule is supported.
# - If unsure about any numeric value, set "ambiguous": true and populate "candidates" with {value, reason, cited_chunks}.
# Return JSON only.
# """

# def _context_from_chunks(chunks: List[Chunk]) -> str:
#     lines = []
#     for c in chunks:
#         lines.append(f"[{c.id} p.{c.page}] {c.text}")
#     return "\n\n".join(lines[:12])  # keep under token budget

# def _derive_required_steps(amount: float, category: str | None, rules: Dict[str, Any]) -> List[str]:
#     steps: List[str] = []
#     tiers = rules.get("tiers") or []
#     # base steps from matching tier(s)
#     for t in tiers:
#         cond = t.get("condition") or {}
#         if cond.get("field") == "amount":
#             op = cond.get("op")
#             val = float(cond.get("value", 0))
#             # compare
#             ok = False
#             if op == "<": ok = amount < val
#             elif op == "<=": ok = amount <= val
#             elif op == ">": ok = amount > val
#             elif op == ">=": ok = amount >= val
#             elif op == "==": ok = amount == val
#             if ok:
#                 steps.extend(t.get("required_steps") or [])
#     # unconditional steps baked into tiers? (convention: condition with op "any")
#     for t in tiers:
#         cond = t.get("condition") or {}
#         if cond.get("op") == "any":
#             steps.extend(t.get("required_steps") or [])

#     # exceptions
#     for ex in rules.get("exceptions") or []:
#         if ex.get("if", {}).get("category") and category:
#             if ex["if"]["category"].lower() == category.lower():
#                 steps.extend(ex.get("then_add_steps") or [])
#     # de-dup preserving order
#     seen = set(); out=[]
#     for s in steps:
#         if s not in seen:
#             seen.add(s); out.append(s)
#     return out

# def run_spending_checker(doc_id: str, index: DocIndex, user_query: str) -> Dict[str, Any]:
#     # 1) retrieve
#     chunks = index.top_k("spending threshold procurement rfp dual signatures cheque disbursement")
#     # 2) LLM extract
#     context = _context_from_chunks(chunks)
#     result = generate_json(PROMPT, context, SPENDING_SCHEMA_HINT)
#     # 3) persist facts
#     facts_store.upsert(doc_id, "spending_rules", result)

#     # 4) craft patches to create a dynamic panel
#     panel_id = f"Panel:spending:{doc_id}"
#     citations = []
#     for t in result.get("tiers", []):
#         for ch in t.get("citations", []):
#             citations.append({"key":"spend.rule", "snippet": next((c.text for c in chunks if c.id==ch), "")})
#     for ex in result.get("exceptions", []):
#         for ch in ex.get("citations", []):
#             citations.append({"key":"spend.exception", "snippet": next((c.text for c in chunks if c.id==ch), "")})

#     patches = [
#         {"op":"add","path":"/panels/-","value": panel_id},
#         {"op":"add","path":f"/panel_configs/{panel_id}","value":{
#             "type":"form_spending",
#             "title":"Spending Checker",
#             "controls": { "amount": None, "category": None },
#             "data": { "rules": result, "required_steps": [], "citations": citations }
#         }}
#     ]
#     # 5) optional assistant message to show in chat (front-end stores separately)
#     message = "I’ve created the **Spending Checker** panel on the right. Enter an amount to see the required steps, with citations."
#     return {"patches": patches, "message": message}
    
# def evaluate_spending_controls(doc_id: str, panel_config: Dict[str, Any]) -> Dict[str, Any]:
#     """
#     Called when user changes /panel_configs/<id>/controls/* .
#     Returns dict with updated `data.required_steps` and optional notes.
#     """
#     facts = facts_store.load(doc_id)
#     rules = facts.get("spending_rules") or {}
#     amount = panel_config.get("controls", {}).get("amount")
#     category = panel_config.get("controls", {}).get("category")
#     if amount is None:
#         return {"required_steps": []}
#     steps = _derive_required_steps(float(amount), category, rules)
#     return {"required_steps": steps}


from __future__ import annotations
from typing import Dict, Any, List, Set, Tuple
import re

from llm.driver import generate_json
from facts import store as facts_store
from retrieval.index import DocIndex, Chunk


_SENT_SPLIT = re.compile(r'(?<=[\.\?\!])\s+')
_MONEY = re.compile(r'(?:\$?\s?\d{1,3}(?:,\d{3})+(?:\.\d+)?|\$?\s?\d+(?:\.\d+)?\s?[kK])')
KEY_TERMS = (
    "rfp", "tender", "competitive", "bid", "bids", "procure", "procurement",
    "sole source", "threshold", "over", "under", "greater than", "less than",
    "purchase", "spending", "contract", "approval", "limit", "value"
)

def _normalize_money_token(tok: str) -> float | None:
    s = tok.strip().replace("$", "").replace(" ", "").replace(",", "")
    if not s: return None
    mult = 1.0
    if s.lower().endswith("k"):
        mult = 1000.0
        s = s[:-1]
    try:
        return float(s) * mult
    except Exception:
        return None

def _sentences(text: str) -> List[str]:
    return [s.strip() for s in _SENT_SPLIT.split(text) if s.strip()]

def _money_candidates(chunks: List[Chunk]) -> List[Tuple[float, str, str, str]]:
    """
    Return list of (value, chunk_id, sentence, raw_match) for sentences likely about procurement thresholds.
    Filters out tiny integers unless they are clearly money-like.
    """
    out: List[Tuple[float, str, str, str]] = []
    for c in chunks:
        for s in _sentences(c.text):
            low = s.lower()
            if not any(k in low for k in KEY_TERMS):
                continue
            for m in _MONEY.finditer(s):
                tok = m.group(0)
                val = _normalize_money_token(tok)
                if val is None:
                    continue
                if ('$' not in tok) and (tok.lower().endswith('k') is False) and (val < 100):
                    continue
                out.append((val, c.id, s.strip(), tok.strip()))
    seen = set()
    dedup: List[Tuple[float, str, str, str]] = []
    for v,cid,sen,raw in out:
        key = (v, cid)
        if key in seen: 
            continue
        seen.add(key)
        dedup.append((v,cid,sen,raw))
    dedup.sort(key=lambda x: x[0])
    return dedup


SPENDING_SCHEMA_SKELETON = """
{
  "tiers": [
    {
      "name": "string",
      "condition": { "field": "amount", "op": "<|<=|==|>=|>|any", "value": "number|optional", "currency": "string|optional" },
      "required_steps": ["string", "..."],
      "citations": ["chunk_id", "..."]
    }
  ],
  "exceptions": [
    {
      "if": { "category": "string|optional", "type": "string|optional" },
      "then_add_steps": ["string", "..."],
      "citations": ["chunk_id", "..."]
    }
  ],
  "notes": "string|optional",
  "ambiguous": "boolean",
  "candidates": [
    { "value": "number", "reason": "string", "citations": ["chunk_id", "..."] }
  ]
}
"""

BASE_PROMPT = """
You must extract procurement/spending tiers and required steps ONLY from the CONTEXT and CANDIDATE_MONEY list below.

STRICT RULES:
- Choose numeric thresholds ONLY from CANDIDATE_MONEY.value. Do NOT invent any number.
- Ignore non-monetary counts (e.g., "3 bids"), section numbers, or dates.
- If the document states an unconditional control (e.g., "two signatures on all cheques"), represent it as a tier with condition.op="any" OR add it to each tier.
- Every tier step and numeric choice MUST include citations (chunk ids).
- If you cannot determine a threshold from CANDIDATE_MONEY, set "ambiguous": true and include your candidate rationale; do not guess.
- Return strict JSON only, matching the schema skeleton.
"""

def _context_from_chunks(chunks: List[Chunk]) -> str:
    return "\n\n".join(f"[{c.id} p.{c.page}] {c.text}" for c in chunks[:12])

def _derive_required_steps(amount: float, category: str | None, rules: Dict[str, Any]) -> List[str]:
    steps: List[str] = []
    tiers = rules.get("tiers") or []

    for t in tiers:
        cond = (t.get("condition") or {})
        if (cond.get("op") or "").lower() == "any":
            steps.extend(t.get("required_steps") or [])

    for t in tiers:
        cond = (t.get("condition") or {})
        if (cond.get("field") == "amount") and (cond.get("op") not in (None, "any")):
            op = cond.get("op")
            try:
                val = float(cond.get("value"))
            except Exception:
                continue
            ok = False
            if op == "<": ok = amount < val
            elif op == "<=": ok = amount <= val
            elif op == ">": ok = amount > val
            elif op == ">=": ok = amount >= val
            elif op == "==": ok = amount == val
            if ok:
                steps.extend(t.get("required_steps") or [])

    for ex in rules.get("exceptions") or []:
        cond = ex.get("if") or {}
        cat = (cond.get("category") or "")
        if category and cat and cat.lower() == category.lower():
            steps.extend(ex.get("then_add_steps") or [])

    seen = set(); out=[]
    for s in steps:
        if s not in seen:
            seen.add(s); out.append(s)
    return out

def _used_numbers_in_rules(rules: Dict[str, Any]) -> List[float]:
    nums: List[float] = []
    for t in rules.get("tiers") or []:
        cond = t.get("condition") or {}
        v = cond.get("value")
        try:
            if v is not None and str(v).strip() != "" and (cond.get("op") not in (None, "any")):
                nums.append(float(v))
        except Exception:
            pass
    return nums

def run_spending_checker(doc_id: str, index: DocIndex, user_query: str) -> Dict[str, Any]:
    chunks = index.top_k("spending threshold procurement rfp tender competitive bids sole source contract purchase approval limit value cheque signatures")
    context = _context_from_chunks(chunks)

    cands = _money_candidates(chunks)
    cand_lines = []
    for v,cid,sen,raw in cands:
        cand_lines.append(f"- value: {int(v) if float(v).is_integer() else v} | chunk: {cid} | sentence: \"{sen}\"")
    cand_block = "\n".join(cand_lines) or "(none)"

    prompt = (
        BASE_PROMPT
        + "\n\nCANDIDATE_MONEY (choose numeric thresholds only from these values):\n"
        + cand_block
    )

    result = generate_json(prompt, context, SPENDING_SCHEMA_SKELETON)

    cand_values = {float(v) for v,_,_,_ in cands}
    used = _used_numbers_in_rules(result)
    if any(u not in cand_values for u in used):
        strict_prompt = (
            BASE_PROMPT
            + "\n\nYour previous output contained numbers not in CANDIDATE_MONEY. "
              "Recompute using ONLY those values. If none apply, set ambiguous:true with candidates.\n\n"
            + "CANDIDATE_MONEY:\n" + cand_block
        )
        result = generate_json(strict_prompt, context, SPENDING_SCHEMA_SKELETON)

    facts_store.upsert(doc_id, "spending_rules", result)

    panel_id = f"Panel:spending:{doc_id}"
    citations = []
    cited_ids: Set[str] = set()
    id_to_page = {c.id: c.page for c in chunks}
    for t in result.get("tiers", []):
        for ch in (t.get("citations") or []):
            cited_ids.add(ch)
    for ex in result.get("exceptions", []):
        for ch in (ex.get("citations") or []):
            cited_ids.add(ch)
    for cid in cited_ids:
        snippet = next((c.text for c in chunks if c.id == cid), "")
        citations.append({"key": "spend.rule", "snippet": snippet, "page": id_to_page.get(cid), "chunk_id": cid})

    patches = [
        {"op":"add","path":"/panels/-","value": panel_id},
        {"op":"add","path":f"/panel_configs/{panel_id}","value":{
            "type":"form_spending",
            "title":"Spending Checker",
            "controls": { "amount": None, "category": None },
            "data": { "rules": result, "required_steps": [], "citations": citations }
        }}
    ]
    message = "I’ve created the **Spending Checker** panel. Amount rules and citations are derived only from money-like values in threshold sentences from your document."
    return {"patches": patches, "message": message}

def evaluate_spending_controls(doc_id: str, panel_config: Dict[str, Any]) -> Dict[str, Any]:
    facts = facts_store.load(doc_id)
    rules = facts.get("spending_rules") or {}
    amount = panel_config.get("controls", {}).get("amount")
    category = panel_config.get("controls", {}).get("category")
    if amount is None:
        return {"required_steps": []}
    steps = _derive_required_steps(float(amount), category, rules)
    return {"required_steps": steps}
