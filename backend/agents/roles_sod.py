# from __future__ import annotations
# from typing import Dict, Any, List
# from llm.driver import generate_json
# from facts import store as facts_store
# from retrieval.index import DocIndex, Chunk

# SCHEMA = """
# {
#   "roles": ["Spending","Payment","ChequeSigning","BankReconciliation"],
#   "constraints": [
#     {
#       "code": "ConflictRolePair",
#       "pair": ["Spending","ChequeSigning"],
#       "message": "Cheque signing and spending authorities may not be exercised by the same person.",
#       "citations": ["chunk_123"]
#     }
#   ],
#   "notes": "",
#   "ambiguous": false,
#   "candidates": []
# }
# """

# PROMPT = """
# From the policy excerpts, extract:
# - The distinct role types mentioned (e.g., Spending, Payment, ChequeSigning, BankReconciliation).
# - Separation/independence constraints as pairs where the *same person is NOT allowed* (e.g., Spending vs ChequeSigning).
# - If the text explicitly ALLOWS some pairs (e.g., ChequeSigning and Payment may be the same), do NOT include that as a conflict.
# - Include citations by the provided chunk ids for each constraint and role definition.
# Return JSON only, conforming to the schema example.
# """

# def _context(chunks: List[Chunk]) -> str:
#     return "\n\n".join(f"[{c.id} p.{c.page}] {c.text}" for c in chunks[:12])

# def run_roles_sod(doc_id: str, index: DocIndex, user_query: str) -> Dict[str, Any]:
#     # retrieve authority + separation content
#     chunks = index.top_k("roles authority separation of duties cheque signing payment spending bank reconciliation independence")
#     result = generate_json(PROMPT, _context(chunks), SCHEMA)
#     facts = facts_store.load(doc_id)
#     facts["delegation_rules"] = result
#     facts_store.save(doc_id, facts)

#     # Build citations to show in panel
#     citations = []
#     cited_ids = set()
#     for cst in result.get("constraints", []):
#         for ch in cst.get("citations", []):
#             cited_ids.add(ch)
#     for rid in cited_ids:
#         snippet = next((c.text for c in chunks if c.id == rid), "")
#         citations.append({"key": "roles.constraint", "snippet": snippet})

#     panel_id = f"Panel:roles_sod:{doc_id}"
#     patches = [
#         {"op":"add","path":"/panels/-","value": panel_id},
#         {"op":"add","path":f"/panel_configs/{panel_id}","value":{
#             "type":"roles_sod",
#             "title":"Roles & Separation of Duties",
#             "controls": {
#                 "assignments": { "Spending": None, "Payment": None, "ChequeSigning": None }
#             },
#             "data": {
#                 "extracted": result,
#                 "violations": [],
#                 "citations": citations
#             }
#         }}
#     ]
#     msg = "I’ve created a **Roles & SoD** panel. Pick people for Spending / Payment / ChequeSigning to see conflicts."
#     return {"patches": patches, "message": msg}

# def evaluate_roles_controls(doc_id: str, panel_cfg: Dict[str, Any]) -> Dict[str, Any]:
#     """
#     Recompute violations when assignments change, using LLM-extracted constraints.
#     """
#     facts = facts_store.load(doc_id)
#     rules = (facts.get("delegation_rules") or {})
#     assigns = ((panel_cfg.get("controls") or {}).get("assignments") or {})
#     viols: List[Dict[str,Any]] = []

#     # Build quick lookup of conflicts from extracted rules
#     pairs = []
#     for c in rules.get("constraints", []) or []:
#         if c.get("code") == "ConflictRolePair":
#             pr = c.get("pair") or []
#             if len(pr) == 2:
#                 pairs.append((pr[0], pr[1], c.get("message","Conflict")))

#     def same(a: str, b: str) -> bool:
#         pa = assigns.get(a)
#         pb = assigns.get(b)
#         return (pa is not None and pb is not None and pa == pb)

#     for a, b, msg in pairs:
#         if same(a, b):
#             viols.append({"code":"ConflictRolePair", "message": msg, "path": f"/assignments/{b}"})

#     return {"violations": viols}


from __future__ import annotations
from typing import Dict, Any, List, Tuple, Set
import re

from llm.driver import generate_json
from facts import store as facts_store
from retrieval.index import DocIndex, Chunk

# ---------- helpers ----------

_SENT_SPLIT = re.compile(r'(?<=[\.\?\!])\s+')
def _sentences(text: str) -> List[str]:
    return [s.strip() for s in _SENT_SPLIT.split(text) if s.strip()]

def _ctx(chunks: List[Chunk], limit: int = 16) -> str:
    return "\n\n".join(f"[{c.id} p.{c.page}] {c.text}" for c in chunks[:limit])

def _role_in_context(role: str, chunks: List[Chunk]) -> bool:
    r = (role or "").strip().lower()
    if not r: return False
    for c in chunks:
        if r in (c.text or "").lower():
            return True
    return False

_NEG_PATTS = [
    r"\bmust\s+be\s+different\b",
    r"\bshall\s+be\s+different\b",
    r"\bmay\s+not\s+be\s+the\s+same\b",
    r"\bcannot\s+be\s+the\s+same\b",
    r"\bnot\s+be\s+the\s+same\s+person\b",
    r"\bindependent\s+of\b",
    r"\bprepared\s+by\s+someone\s+different\b",
    r"\bmust\s+be\s+separate\b",
    r"\bshall\s+be\s+separate\b",
    r"\bsegregation\s+of\s+duties\b",
    r"\bseparation\s+of\s+duties\b",
]
_POS_PATTS = [
    r"\bmay\s+be\s+the\s+same\b",
    r"\bcan\s+be\s+the\s+same\b",
    r"\ballowed\s+to\s+be\s+the\s+same\b",
]

def _constraint_candidates(chunks: List[Chunk]) -> List[Tuple[str, str, str]]:
    """
    Return (kind, chunk_id, sentence) where kind is 'conflict' or 'allow'.
    We use generic English patterns only (no seeded roles).
    """
    out: List[Tuple[str, str, str]] = []
    neg_re = re.compile("|".join(_NEG_PATTS), re.IGNORECASE)
    pos_re = re.compile("|".join(_POS_PATTS), re.IGNORECASE)
    for c in chunks:
        for s in _sentences(c.text or ""):
            if neg_re.search(s):
                out.append(("conflict", c.id, s.strip()))
            elif pos_re.search(s):
                out.append(("allow", c.id, s.strip()))
    seen = set(); dedup: List[Tuple[str,str,str]] = []
    for kind, cid, s in out:
        key = (kind, cid, s)
        if key in seen: continue
        seen.add(key); dedup.append((kind, cid, s))
    return dedup[:40]

def _validate_output(rules: Dict[str, Any], chunks: List[Chunk]) -> bool:
    roles = rules.get("roles") or []
    if not roles:  
        return False
    if not all(_role_in_context(r, chunks) for r in roles):
        return False

    ids_in_ctx = {c.id for c in chunks}
    role_set = set(roles)

    def _ok_pair(pair: List[str]) -> bool:
        return isinstance(pair, list) and len(pair) == 2 and pair[0] in role_set and pair[1] in role_set

    def _ok_cits(obj: Dict[str, Any]) -> bool:
        cits = obj.get("citations") or []
        return bool(cits) and all(cid in ids_in_ctx for cid in cits)

    constr = rules.get("constraints") or []
    allows = rules.get("allows") or []
    if not constr and not allows and not rules.get("ambiguous"):
        return False

    for row in constr:
        if row.get("code") != "ConflictRolePair": return False
        if not _ok_pair(row.get("pair") or []): return False
        if not _ok_cits(row): return False
        qs = row.get("quotes") or []
        if not qs: return False

    for row in allows:
        if not _ok_pair(row.get("pair") or []): return False
        if not _ok_cits(row): return False
        qs = row.get("quotes") or []
        if not qs: return False

    return True

SCHEMA_SKELETON = """
{
  "roles": ["string", "..."],
  "role_evidence": [
    { "role": "string", "citations": ["chunk_id","..."], "quotes": ["string","..."] }
  ],
  "constraints": [
    { "code": "ConflictRolePair", "pair": ["string","string"], "message": "string",
      "citations": ["chunk_id","..."], "quotes": ["string","..."] }
  ],
  "allows": [
    { "pair": ["string","string"], "message": "string",
      "citations": ["chunk_id","..."], "quotes": ["string","..."] }
  ],
  "notes": "string|optional",
  "ambiguous": "boolean",
  "candidates": [
    { "pair": ["string","string"], "reason": "string",
      "citations": ["chunk_id","..."], "quotes": ["string","..."] }
  ]
}
"""

BASE_PROMPT = """
Extract ROLES and Separation-of-Duties (SoD) pairs ONLY from the provided CONTEXT and CONSTRAINT_CANDIDATES.

Requirements:
- ROLE NAMES: use verbatim strings that appear in the CONTEXT (keep wording; normalize only capitalization).
- For each role, include `role_evidence` with citations (chunk ids) and short exact quotes.
- For SoD pairs:
  * `constraints`: roles that MUST be held by different people (independent/separate/different person).
  * `allows`: roles that MAY be held by the same person (explicitly allowed).
- Cite chunk ids AND include short quotes supporting each pair. Use ONLY sentences from CONSTRAINT_CANDIDATES as evidence.
- If you are unsure about any pair, set `ambiguous: true` and add a `candidates` entry with pair+reason+citations+quotes.
- Return strict JSON matching the schema skeleton.
"""

def run_roles_sod(doc_id: str, index: DocIndex, user_query: str) -> Dict[str, Any]:
    chunks = index.top_k("roles responsibilities authority separation duties independence cheque signing payment spending reconciliation approval verification")
    context = _ctx(chunks, limit=24)

    cands = _constraint_candidates(chunks)
    cand_block = "\n".join([f"- kind: {k} | chunk: {cid} | sentence: \"{s}\"" for (k, cid, s) in cands]) or "(none)"

    prompt = BASE_PROMPT + "\n\nCONSTRAINT_CANDIDATES:\n" + cand_block
    result = generate_json(prompt, context, SCHEMA_SKELETON)

    if not _validate_output(result, chunks):
        strict = BASE_PROMPT + """
ADDITIONAL CONSTRAINTS:
- Your previous output contained unsupported roles or lacked citations/quotes.
- Recompute using ONLY role names that appear verbatim in CONTEXT and ONLY sentences listed in CONSTRAINT_CANDIDATES.
"""
        result = generate_json(strict + "\n\nCONSTRAINT_CANDIDATES:\n" + cand_block, context, SCHEMA_SKELETON)

    facts = facts_store.load(doc_id)
    facts["delegation_rules"] = result
    facts_store.save(doc_id, facts)

    cited_ids: Set[str] = set()
    for ev in result.get("role_evidence", []) or []:
        for rid in ev.get("citations") or []: cited_ids.add(rid)
    for arr in ("constraints", "allows"):
        for row in result.get(arr, []) or []:
            for rid in row.get("citations") or []: cited_ids.add(rid)

    citations = []
    id_to_page = {c.id: c.page for c in chunks}
    for rid in cited_ids:
        snippet = next((c.text for c in chunks if c.id == rid), "")
        citations.append({"key": "roles.evidence", "snippet": snippet, "page": id_to_page.get(rid), "chunk_id": rid})

    roles = result.get("roles") or []
    assignments = { r: None for r in roles }

    panel_id = f"Panel:roles_sod:{doc_id}"
    patches = [
        {"op":"add","path":"/panels/-","value": panel_id},
        {"op":"add","path":f"/panel_configs/{panel_id}","value":{
            "type":"roles_sod",
            "title":"Roles & Separation of Duties",
            "controls": { "assignments": assignments },
            "data": { "extracted": result, "violations": [], "citations": citations }
        }}
    ]
    msg = "I’ve created a **Roles & SoD** panel. Assign people to the extracted roles to see conflicts based on the document."
    return {"patches": patches, "message": msg}

def evaluate_roles_controls(doc_id: str, panel_cfg: Dict[str, Any]) -> Dict[str, Any]:
    facts = facts_store.load(doc_id)
    rules = (facts.get("delegation_rules") or {})
    assigns = ((panel_cfg.get("controls") or {}).get("assignments") or {})
    viols: List[Dict[str,Any]] = []

    pairs = []
    for c in rules.get("constraints", []) or []:
        if c.get("code") == "ConflictRolePair":
            pr = c.get("pair") or []
            if isinstance(pr, list) and len(pr) == 2 and all(isinstance(x, str) for x in pr):
                pairs.append((pr[0], pr[1], c.get("message","Conflict")))

    def same(a: str, b: str) -> bool:
        pa = assigns.get(a); pb = assigns.get(b)
        return (pa is not None) and (pb is not None) and (pa == pb)

    for a, b, msg in pairs:
        if same(a, b):
            viols.append({"code":"ConflictRolePair", "message": msg, "path": f"/assignments/{b}"})

    return {"violations": viols}
