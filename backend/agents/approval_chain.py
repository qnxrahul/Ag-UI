from __future__ import annotations
from typing import Dict, Any, List, Set, Tuple
import re

from llm.driver import generate_json
from facts import store as facts_store
from retrieval.index import DocIndex, Chunk


def _ctx(chunks: List[Chunk], limit: int = 24) -> str:
    return "\n\n".join(f"[{c.id} p.{c.page}] {c.text}" for c in chunks[:limit])

def _ids_in(chunks: List[Chunk]) -> Set[str]:
    return {c.id for c in chunks}

def _sentences(text: str) -> List[str]:
    return [s.strip() for s in re.split(r'(?<=[\.\?\!])\s+', text or "") if s.strip()]

_NUM = re.compile(r'\$?\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?|\b\d+(?:\.\d+)?\s*[kKmM]?\b')
_AMOUNT_KEY = re.compile(
    r'\b(up to|over|exceed(?:ing)?|not exceed(?:ing)?|threshold|limit|maximum|min(?:imum)?|range|amount|value|approval|approving|authority|authorized|signing|officer|manager|director)\b',
    re.IGNORECASE
)
_CHEQUE = re.compile(r'\bcheque|check|cheque\s+signing|check\s+signing\b', re.IGNORECASE)

def _harvest_amount_candidates(all_chunks: List[Chunk]) -> List[Tuple[str, str]]:
    """
    Return list of (chunk_id, sentence) that likely express amount tiers or limits,
    filtered to sentences that contain a number AND approval/authority wording.
    """
    out: List[Tuple[str, str]] = []
    for c in all_chunks:
        for s in _sentences(c.text):
            if _NUM.search(s) and _AMOUNT_KEY.search(s):
                out.append((c.id, s))
    seen = set(); dedup: List[Tuple[str, str]] = []
    for cid, s in out:
        key = (cid, s)
        if key in seen: continue
        seen.add(key); dedup.append((cid, s))
    return dedup[:120]


def _validate_extraction(rules: Dict[str, Any], chunks: List[Chunk], amount_cids: Set[str]) -> bool:
    """
    - levels[] present with numeric conditions and citations that exist in our chunk set
    - if we had amount candidates, at least one level must cite one of those chunk ids
    - approvers present, and appear somewhere in the context
    - triggers (if any) cite real chunk ids
    - forbid cheque-only sentences being turned into unconditional amount levels: if ALL citations of a level
      are cheque-only chunks, that's suspicious.
    """
    if not isinstance(rules, dict):
        return False

    ids_ok = _ids_in(chunks)

    def _role_in_ctx(role: str) -> bool:
        r = (role or "").strip().lower()
        if not r: return False
        for c in chunks:
            if r in (c.text or "").lower():
                return True
        return False

    levels = rules.get("levels")
    if not isinstance(levels, list) or not levels:
        return not amount_cids 

    saw_amount_cit = False

    for lvl in levels:
        cond = lvl.get("condition") or {}
        if cond.get("field") != "amount": return False
        op = cond.get("op")
        if op not in ("<", "<=", ">", ">=", "==", "between"): return False

        if op == "between":
            rng = cond.get("range") or {}
            if not isinstance(rng.get("min"), (int, float)): return False
            mx = rng.get("max", None)
            if mx is not None and not isinstance(mx, (int, float)): return False
        else:
            if not isinstance(cond.get("value"), (int, float)): return False

        approvers = lvl.get("approvers") or []
        if not approvers or not all(isinstance(a, str) and a.strip() for a in approvers):
            return False
        if not all(_role_in_ctx(a) for a in approvers):
            return False

        cits = lvl.get("citations") or []
        if not cits or not all(cid in ids_ok for cid in cits):
            return False

        if any(cid in amount_cids for cid in cits):
            saw_amount_cit = True

        qs = lvl.get("quotes") or []
        if not qs:
            return False

        all_chequeish = True
        for cid in cits:
            txt = next((c.text for c in chunks if c.id == cid), "")
            if not _CHEQUE.search(txt):
                all_chequeish = False
                break
        if all_chequeish:
            return False

    if amount_cids and not saw_amount_cit:
        return False

    for trg in rules.get("triggers", []) or []:
        when = trg.get("when") or {}
        add = trg.get("add") or []
        if not when or not add:
            return False
        cits = trg.get("citations") or []
        if not cits or not all(cid in ids_ok for cid in cits):
            return False
        qs = trg.get("quotes") or []
        if not qs:
            return False

    return True

SCHEMA_SKELETON = """
{
  "levels": [
    {
      "title": "string (optional)",
      "condition": {
        "field": "amount",
        "op": "one of: <, <=, >, >=, ==, between",
        "value": 0,
        "range": { "min": 0, "max": 0 },
        "currency": "string (optional)"
      },
      "approvers": ["string", "..."],
      "citations": ["chunk_id", "..."],
      "quotes": ["string", "..."]
    }
  ],
  "triggers": [
    {
      "when": { "instrument": "string" },
      "add": ["string", "..."],
      "citations": ["chunk_id", "..."],
      "quotes": ["string", "..."]
    }
  ],
  "notes": "string|optional",
  "ambiguous": "boolean",
  "candidates": [
    { "reason": "string", "citations": ["chunk_id", "..."], "quotes": ["string", "..."] }
  ]
}
"""

BASE_PROMPT = """
You are given CONTEXT and AMOUNT_CANDIDATES (sentences with numbers + authority/approval wording).

Build a strictly document-grounded JSON structure:

- `levels[]`: amount-based approval/signing levels.
  * Use {field:"amount", op:"<|<=|>|>=|==|between", value:number OR range:{min,max}}.
  * Use ONLY numeric values found in the text; no invented numbers.
  * `approvers` are verbatim titles/labels from the text (normalize only capitalization).
  * Each level MUST include `citations` (chunk ids) and short `quotes` that mention the amount or approval scope.
  * Prefer multiple specific tiers over a single catch-all. If the text provides ranges (“up to”, “over”, “not exceeding”), reflect them faithfully.

- `triggers[]`: conditions that add approvers independent of amount (e.g., instrument = "cheque" -> two signatories).
  * Any sentence that mentions "cheque"/"cheque signing"/"check signing" MUST be represented as a trigger, NOT as an amount level.

- If the text truly lacks amount-based approval levels, set `ambiguous:true` and put reasoning in `candidates[]` with citations+quotes.

- Return STRICT JSON that matches the schema skeleton exactly. Do not invent policy.
"""

def run_approval_chain(doc_id: str, index: DocIndex, user_query: str) -> Dict[str, Any]:
    """
    Create an Approval Chain panel from document-only signals.
    """
    base_chunks = index.top_k(
        "approval authority signing officer signing officers financial signing authorities limit threshold up to over not exceeding amount"
    )

    all_chunks = index.all_chunks()
    amount_sents = _harvest_amount_candidates(all_chunks)
    amount_cids = {cid for cid, _ in amount_sents}

    amount_block = "\n".join([f"- chunk:{cid} | {s}" for cid, s in amount_sents]) or "(none)"
    context = _ctx(base_chunks, limit=24)
    prompt = BASE_PROMPT + "\n\nAMOUNT_CANDIDATES:\n" + amount_block

    result = generate_json(prompt, context, SCHEMA_SKELETON)

    if not _validate_extraction(result, base_chunks, amount_cids):
        strict = BASE_PROMPT + """
ADDITIONAL CONSTRAINTS:
- Your previous output either lacked numeric levels present in AMOUNT_CANDIDATES or used cheque-only lines as amount levels.
- Recompute using ONLY numbers and titles present in the text.
- Represent any cheque/check signing rules as triggers, NOT amount levels.
"""
        result = generate_json(strict + "\n\nAMOUNT_CANDIDATES:\n" + amount_block, context, SCHEMA_SKELETON)

    facts = facts_store.load(doc_id)
    facts["approval_chain_rules"] = result
    facts_store.save(doc_id, facts)

    cited: Set[str] = set()
    for lvl in result.get("levels", []) or []:
        for cid in lvl.get("citations", []) or []:
            cited.add(cid)
    for trg in result.get("triggers", []) or []:
        for cid in trg.get("citations", []) or []:
            cited.add(cid)

    citations = []
    for cid in cited:
        snippet = next((c.text for c in base_chunks if c.id == cid), "")
        if not snippet and all_chunks is not base_chunks:
            snippet = next((c.text for c in all_chunks if c.id == cid), "")
        citations.append({"key": "approval.evidence", "snippet": snippet})

    panel_id = f"Panel:approval_chain:{doc_id}"
    patches = [
        {"op": "add", "path": "/panels/-", "value": panel_id},
        {"op": "add", "path": f"/panel_configs/{panel_id}", "value": {
            "type": "approval_chain",
            "title": "Approval Chain",
            "controls": { "amount": None, "instrument": None },
            "data": { "rules": result, "chain": [], "citations": citations }
        }}
    ]
    message = "I’ve created an **Approval Chain** panel. Enter an amount and (optionally) an instrument (e.g., cheque) to see who must approve."
    return {"patches": patches, "message": message}


def _match_amount(amount: float, cond: Dict[str, Any]) -> bool:
    op = cond.get("op")
    if op == "between":
        rng = cond.get("range") or {}
        mn = float(rng.get("min", float("-inf")))
        mx = rng.get("max", None)
        mxv = float(mx) if mx is not None else float("inf")
        return mn <= amount <= mxv
    val = float(cond.get("value", 0))
    if op == "<":  return amount <  val
    if op == "<=": return amount <= val
    if op == ">":  return amount >  val
    if op == ">=": return amount >= val
    if op == "==": return amount == val
    return False

def _derive_chain(amount: float | None, instrument: str | None, rules: Dict[str, Any]) -> List[str]:
    if amount is None:
        return []
    levels = rules.get("levels") or []
    matched: List[List[str]] = []
    for lvl in levels:
        cond = lvl.get("condition") or {}
        if cond.get("field") == "amount" and _match_amount(float(amount), cond):
            approvers = [a for a in (lvl.get("approvers") or []) if isinstance(a, str)]
            if approvers:
                matched.append(approvers)

    chain: List[str] = []
    for group in matched:
        for a in group:
            if a not in chain:
                chain.append(a)

    inst = (instrument or "").strip().lower()
    for trg in rules.get("triggers") or []:
        when = (trg.get("when") or {})
        w_inst = (when.get("instrument") or "").strip().lower()
        if w_inst and inst and (w_inst in inst):
            for a in trg.get("add") or []:
                if a not in chain:
                    chain.append(a)

    return chain

def evaluate_approval_controls(doc_id: str, panel_cfg: Dict[str, Any]) -> Dict[str, Any]:
    facts = facts_store.load(doc_id)
    rules = facts.get("approval_chain_rules") or {}
    controls = panel_cfg.get("controls") or {}
    amount = controls.get("amount")
    instrument = controls.get("instrument")

    if amount is None:
        return { "chain": [] }

    chain = _derive_chain(float(amount), instrument, rules)
    return { "chain": chain }
