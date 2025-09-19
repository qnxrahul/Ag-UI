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

def _ctx(chunks: List[Chunk], limit: int = 20) -> str:
    return "\n\n".join(f"[{c.id} p.{c.page}] {c.text}" for c in chunks[:limit])

# Generic indicator words for exceptions/waivers (doc-agnostic; not role/number seeds)
_EXCEPTION_PATTS = [
    r"\bexception\b",
    r"\bwaiver\b",
    r"\bnotwithstanding\b",
    r"\bemergency\b",
    r"\bsole\s*source\b",
    r"\bnon[-\s]?competitive\b",
    r"\bwithout\s+(?:tender|bids|rfp|competition)\b",
    r"\bdeviation\b",
    r"\bvariance\b",
    r"\bsubject\s+to\s+approval\b",
    r"\bapproval\s+by\b",
    r"\bwith\s+written\s+justification\b",
    r"\bjustification\b",
    r"\breport(?:ed|ing)\b",
]

def _exception_candidates(chunks: List[Chunk]) -> List[Tuple[str, str]]:
    """Return list of (chunk_id, sentence) likely describing exceptions/waivers."""
    patt = re.compile("|".join(_EXCEPTION_PATTS), re.IGNORECASE)
    out: List[Tuple[str, str]] = []
    for c in chunks:
        for s in _sentences(c.text or ""):
            if patt.search(s):
                out.append((c.id, s.strip()))
    seen = set(); dedup: List[Tuple[str,str]] = []
    for cid, s in out:
        key = (cid, s)
        if key in seen: continue
        seen.add(key); dedup.append((cid, s))
    return dedup[:60]

SCHEMA_SKELETON = """
{
  "exception_policies": [
    {
      "name": "string",
      "when": {
        "keyword": "string|optional",
        "amount": { "op": "string (one of: '<','<=','>','>=','==')", "value": "number", "currency": "string|optional" } | null
      },
      "requires": {
        "approvals": ["string","..."],
        "documentation": ["string","..."],
        "reporting": ["string","..."]
      },
      "citations": ["chunk_id","..."],
      "quotes": ["string","..."]
    }
  ],
  "ambiguous": "boolean",
  "notes": "string|optional"
}
"""

BASE_PROMPT = """
From the CONTEXT and CANDIDATE_SENTENCES extract exception/waiver policies ONLY if explicitly supported.

For each policy:
- name: short label from the text (e.g., "Sole source procurement", "Emergency purchase").
- when: describe triggering condition(s). If a numeric threshold is mentioned, include it as {amount:{op,value,currency}}.
        If no numeric condition is mentioned, set amount=null. You may include a simple keyword string that matches the label used in the text.
- requires.approvals: list the titles/roles that must approve a waiver/exception (verbatim from the text).
- requires.documentation: list required docs/justifications (e.g., written justification, quotes, board minute, log entry).
- requires.reporting: list any reporting/notification obligations (e.g., report to board/finance quarterly).
- citations: include chunk ids for the sentences that support the requirements.
- quotes: short exact quotes from those sentences.

STRICTNESS:
- Use ONLY information found in CONTEXT/CANDIDATE_SENTENCES. No speculation.
- If uncertain, set ambiguous=true and explain in notes (but still return what is supported).
Return strict JSON following the schema skeleton.
"""

def run_exceptions_tracker(doc_id: str, index: DocIndex, user_query: str) -> Dict[str, Any]:
    chunks = index.top_k("exception waiver emergency sole source non competitive tender deviation variance approval documentation reporting")
    context = _ctx(chunks, limit=24)

    cands = _exception_candidates(chunks)
    cand_block = "\n".join([f"- chunk: {cid} | sentence: \"{s}\"" for (cid, s) in cands]) or "(none)"

    prompt = BASE_PROMPT + "\n\nCANDIDATE_SENTENCES:\n" + cand_block
    result = generate_json(prompt, context, SCHEMA_SKELETON)

    facts = facts_store.load(doc_id)
    facts["exception_rules"] = result
    facts_store.save(doc_id, facts)

    cited_ids: Set[str] = set()
    for row in result.get("exception_policies", []) or []:
        for rid in row.get("citations", []) or []:
            cited_ids.add(rid)
    citations = []
    id_to_page = {c.id: c.page for c in chunks}
    for rid in cited_ids:
        snippet = next((c.text for c in chunks if c.id == rid), "")
        citations.append({"key": "exceptions.evidence", "snippet": snippet, "page": id_to_page.get(rid), "chunk_id": rid})

    suggestions = {
        "approvals": sorted({a for pol in (result.get("exception_policies") or []) for a in (pol.get("requires", {}).get("approvals") or [])}),
        "documentation": sorted({d for pol in (result.get("exception_policies") or []) for d in (pol.get("requires", {}).get("documentation") or [])}),
        "reporting": sorted({r for pol in (result.get("exception_policies") or []) for r in (pol.get("requires", {}).get("reporting") or [])}),
    }

    panel_id = f"Panel:exceptions:{doc_id}"
    # Build UI suggestions: toggle suggested approvals/docs/reporting to true
    suggestions_ui = []
    try:
        sugg = {
            "approvals": sorted({a for pol in (result.get("exception_policies") or []) for a in (pol.get("requires", {}).get("approvals") or [])}),
            "documentation": sorted({d for pol in (result.get("exception_policies") or []) for d in (pol.get("requires", {}).get("documentation") or [])}),
            "reporting": sorted({r for pol in (result.get("exception_policies") or []) for r in (pol.get("requires", {}).get("reporting") or [])}),
        }
        for k in sugg.get("approvals", []):
            suggestions_ui.append({"type":"Action.Submit","title":f"Got approval: {k}","data":{"patch":[{"op":"add","path":f"/panel_configs/{panel_id}/controls/entry/approvals/{k}","value":True}]}})
        for k in sugg.get("documentation", []):
            suggestions_ui.append({"type":"Action.Submit","title":f"Got doc: {k}","data":{"patch":[{"op":"add","path":f"/panel_configs/{panel_id}/controls/entry/documentation/{k}","value":True}]}})
        for k in sugg.get("reporting", []):
            suggestions_ui.append({"type":"Action.Submit","title":f"Done: {k}","data":{"patch":[{"op":"add","path":f"/panel_configs/{panel_id}/controls/entry/reporting/{k}","value":True}]}})
    except Exception:
        pass
    patches = [
        {"op":"add","path":"/panels/-","value": panel_id},
        {"op":"add","path":f"/panel_configs/{panel_id}","value":{
            "type":"exceptions_tracker",
            "title":"Exceptions & Waiver Tracker",
            "controls": {
                "entry": {
                    "keywords": "",     
                    "amount": None,     
                    "currency": "",     
                    "approvals": {},    
                    "documentation": {},
                    "reporting": {}     
                }
            },
            "data": {
                "extracted": result,
                "suggestions": suggestions,
                "status": { "approvals": [], "documentation": [], "reporting": [] },
                "citations": citations,
                "suggestions_ui": suggestions_ui
            }
        }}
    ]
    message = "I’ve created an **Exceptions & Waiver Tracker** panel. Describe the waiver (keywords), enter an amount (if any), and tick what you’ve obtained; the checklist will evaluate against the policy."
    return {"patches": patches, "message": message}

# ---------- evaluation ----------

def _match_amount(cond: Dict[str, Any] | None, amount: float | None) -> bool:
    if not cond or not isinstance(cond, dict):
        return True
    amt = cond.get("amount")
    if not amt:
        return True
    if amount is None:
        return False
    try:
        v = float(amt.get("value"))
    except Exception:
        return True
    op = (amt.get("op") or "").strip()
    a = float(amount)
    if op == "<": return a < v
    if op == "<=": return a <= v
    if op == ">": return a > v
    if op == ">=": return a >= v
    if op == "==": return a == v
    return True

def _match_keyword(cond: Dict[str, Any] | None, kw: str) -> bool:
    if not cond or not isinstance(cond, dict):
        return True
    want = (cond.get("keyword") or "").strip().lower()
    if not want: return True
    return want in (kw or "").strip().lower()

def evaluate_exceptions_controls(doc_id: str, panel_cfg: Dict[str, Any]) -> Dict[str, Any]:
    facts = facts_store.load(doc_id)
    rules = (facts.get("exception_rules") or {})
    entry = ((panel_cfg.get("controls") or {}).get("entry") or {})

    kw = (entry.get("keywords") or "").strip()
    amount = entry.get("amount")
    try:
        amount = None if amount in (None, "",) else float(amount)
    except Exception:
        amount = None

    applicable = []
    for pol in (rules.get("exception_policies") or []):
        when = pol.get("when") or {}
        if _match_keyword(when, kw) and _match_amount(when, amount):
            applicable.append(pol)

    req_approvals = []
    req_docs = []
    req_reporting = []
    for pol in applicable:
        req = pol.get("requires", {}) or {}
        for a in (req.get("approvals") or []):
            if a not in req_approvals: req_approvals.append(a)
        for d in (req.get("documentation") or []):
            if d not in req_docs: req_docs.append(d)
        for r in (req.get("reporting") or []):
            if r not in req_reporting: req_reporting.append(r)

    approvals_state = entry.get("approvals") or {}
    docs_state = entry.get("documentation") or {}
    report_state = entry.get("reporting") or {}

    def eval_items(reqs: List[str], state: Dict[str, Any]) -> List[Dict[str, Any]]:
        out = []
        for item in reqs:
            got = state.get(item)
            if got is True:
                status = "PASS"
            elif got is False:
                status = "FAIL"
            else:
                status = "UNKNOWN"
            out.append({"item": item, "status": status})
        return out

    status = {
        "approvals": eval_items(req_approvals, approvals_state),
        "documentation": eval_items(req_docs, docs_state),
        "reporting": eval_items(req_reporting, report_state)
    }

    return {"status": status}
