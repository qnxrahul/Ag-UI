from __future__ import annotations
from typing import Dict, Any, List, Set, Optional
from datetime import datetime

from llm.driver import generate_json
from facts import store as facts_store
from retrieval.index import DocIndex, Chunk

DateFmt = "%Y-%m-%d"

# ---------- helpers ----------

def _ctx(chunks: List[Chunk], limit: int = 28) -> str:
    return "\n\n".join(f"[{c.id} p.{c.page}] {c.text}" for c in chunks[:limit])

def _ids_in(chunks: List[Chunk]) -> Set[str]:
    return {c.id for c in chunks}

def _parse_date(s: Optional[str]) -> Optional[datetime]:
    try:
        if not s:
            return None
        return datetime.strptime(s, DateFmt)
    except Exception:
        return None

def _days_between(a: Optional[str], b: Optional[str]) -> Optional[int]:
    da = _parse_date(a); db = _parse_date(b)
    if not da or not db:
        return None
    return (db - da).days

def _validate_rules(extracted: Dict[str, Any], chunks: List[Chunk]) -> bool:
    """
    Minimal structural grounding:
    - At least one rule in any category.
    - Citations must reference chunk ids we provided.
    - For rules with numeric thresholds, values are numbers.
    - Logic kinds restricted to a small vocabulary that our evaluator supports.
    """
    if not isinstance(extracted, dict):
        return False

    ids_ok = _ids_in(chunks)
    ok = False

    def _check_rules(arr: Any) -> bool:
        if not isinstance(arr, list):
            return False
        for r in arr:
            if not isinstance(r, dict):
                return False
            if not r.get("code"): return False
            logic = r.get("logic", {})
            kind = logic.get("kind")
            if kind not in (
                "days_between",
                "due_within_days_after",
                "all_false",
                "bool_equals",
            ):
                return False

            if kind in ("days_between", "due_within_days_after"):
                v = logic.get("value", None)
                if not isinstance(v, (int, float)):
                    return False

            cits = r.get("citations") or []
            if not cits or not all(cid in ids_ok for cid in cits):
                return False

            quotes = r.get("quotes") or []
            if not quotes:
                return False
        return True

    if _check_rules(extracted.get("travel_rules", [])):
        ok = True
    if _check_rules(extracted.get("bank_recon_rules", [])):
        ok = True
    if _check_rules(extracted.get("credit_card_rules", [])):
        ok = True

    return ok

SCHEMA_SKELETON = """
{
  "travel_rules": [
    {
      "code": "string",                      // e.g., "AdvanceLeadTimeMaxDays"
      "label": "string",                     // short human label
      "logic": {
        "kind": "days_between | due_within_days_after | all_false | bool_equals",
        "from": "advance_issued_date|trip_start_date|trip_end_date|claim_submitted_date|excess_returned_date",
        "to":   "advance_issued_date|trip_start_date|trip_end_date|claim_submitted_date|excess_returned_date",
        "anchor": "trip_end_date|trip_start_date",
        "event": "claim_submitted_date|excess_returned_date",
        "field": "has_other_advance",
        "value": 0,
        "op": "<=|>=|=="
      },
      "citations": ["chunk_id", "..."],
      "quotes": ["string", "..."]
    }
  ],
  "bank_recon_rules": [
    {
      "code": "string",                      // e.g., "BankReconDueWithinDays"
      "label": "string",
      "logic": {
        "kind": "days_between | due_within_days_after | all_false | bool_equals",
        "from": "statement_date|recon_completed_date",
        "to":   "statement_date|recon_completed_date",
        "anchor": "statement_date",
        "event": "recon_completed_date",
        "field": "is_preparer_signer|is_preparer_depositor",
        "value": 0,
        "op": "<=|>=|=="
      },
      "citations": ["chunk_id", "..."],
      "quotes": ["string", "..."]
    }
  ],
  "credit_card_rules": [
    {
      "code": "string",                      // e.g., "CardReconIndependence"
      "label": "string",
      "logic": {
        "kind": "days_between | due_within_days_after | all_false | bool_equals",
        "from": "cc_statement_date|cc_recon_completed_date",
        "to":   "cc_statement_date|cc_recon_completed_date",
        "anchor": "cc_statement_date",
        "event": "cc_recon_completed_date",
        "field": "preparer_has_spending_authority",
        "value": 0,
        "op": "<=|>=|=="
      },
      "citations": ["chunk_id", "..."],
      "quotes": ["string", "..."]
    }
  ],
  "ambiguous": "boolean",
  "notes": "string|optional"
}
"""

BASE_PROMPT = """
Extract compliance control rules for TRAVEL ADVANCES/CLAIMS and for BANK & CREDIT CARD RECONCILIATIONS from the CONTEXT.

STRICT REQUIREMENTS
- Use ONLY facts present in the text (no invented thresholds). Titles/labels must be verbatim or lightly normalized.
- Output three arrays: travel_rules[], bank_recon_rules[], credit_card_rules[].
- Express each rule using one of these evaluator-friendly logic kinds:
  * days_between: {"kind":"days_between","from":<date_field>,"to":<date_field>,"op":"<=|>=|==","value":<days>}
  * due_within_days_after: {"kind":"due_within_days_after","anchor":<date_field>,"event":<date_field>,"op":"<=|>=|==","value":<days>}
  * all_false: {"kind":"all_false","fields":[<boolean_field>,...]}   // every listed boolean field must be false
  * bool_equals: {"kind":"bool_equals","field":<boolean_field>,"value":true|false}
- Use these date field names (do not invent others):
  TRAVEL: advance_issued_date, trip_start_date, trip_end_date, claim_submitted_date, excess_returned_date
  BANK:   statement_date, recon_completed_date, is_preparer_signer (bool), is_preparer_depositor (bool)
  CARD:   cc_statement_date, cc_recon_completed_date, preparer_has_spending_authority (bool)
- Include citations (chunk ids) and short quotes for EVERY rule.
- If the policy is ambiguous about a control, set ambiguous:true and keep notes.

Return STRICT JSON matching the schema skeleton.
"""

def run_control_checklists(doc_id: str, index: DocIndex, user_query: str) -> Dict[str, Any]:
    """
    Build the Control Checklists panel with LLM-extracted rules.
    """
    chunks = index.top_k(
        "travel advance claim reimbursement return excess within days one week ten days monthly follow up "
        "bank reconciliation independent depositor signer monthly within days escalate "
        "credit card reconciliation monthly spending authority independent verification"
    )
    context = _ctx(chunks, limit=28)

    extracted = generate_json(BASE_PROMPT, context, SCHEMA_SKELETON)

    if not _validate_rules(extracted, chunks):
        strict = BASE_PROMPT + """
ADDITIONAL CONSTRAINTS:
- Your previous output was missing citations, numeric day values, or used unsupported logic kinds.
- Recompute with the allowed logic kinds only and cite chunk ids we provided.
"""
        extracted = generate_json(strict, context, SCHEMA_SKELETON)

    facts = facts_store.load(doc_id)
    facts["control_rules"] = extracted
    facts_store.save(doc_id, facts)

    cited: Set[str] = set()
    for key in ("travel_rules", "bank_recon_rules", "credit_card_rules"):
        for r in extracted.get(key, []) or []:
            for cid in r.get("citations", []) or []:
                cited.add(cid)

    citations = []
    for cid in cited:
        snippet = next((c.text for c in chunks if c.id == cid), "")
        citations.append({"key": "controls.evidence", "snippet": snippet})

    panel_id = f"Panel:control_checklists:{doc_id}"
    patches = [
        {"op": "add", "path": "/panels/-", "value": panel_id},
        {"op": "add", "path": f"/panel_configs/{panel_id}", "value": {
            "type": "control_checklists",
            "title": "Control Calendar & Checklists",
            "controls": {
                "travel": {
                    "advance_issued_date": None,
                    "trip_start_date": None,
                    "trip_end_date": None,
                    "claim_submitted_date": None,
                    "excess_returned_date": None,
                    "has_other_advance": None
                },
                "bank": {
                    "statement_date": None,
                    "recon_completed_date": None,
                    "is_preparer_signer": None,
                    "is_preparer_depositor": None
                },
                "credit": {
                    "cc_statement_date": None,
                    "cc_recon_completed_date": None,
                    "preparer_has_spending_authority": None
                }
            },
            "data": {
                "rules": extracted,
                "status": { "travel": [], "bank": [], "credit": [] },
                "citations": citations
            }
        }}
    ]
    message = "I’ve created a **Control Calendar & Checklists** panel. Enter dates and toggles to see compliance pass/fail with citations."
    return {"patches": patches, "message": message}


def _eval_days_between(ctrls: Dict[str, Any], logic: Dict[str, Any]) -> Optional[bool]:
    from_f = logic.get("from"); to_f = logic.get("to")
    op = logic.get("op"); val = logic.get("value")
    if from_f not in ctrls or to_f not in ctrls:
        return None
    d = _days_between(ctrls.get(from_f), ctrls.get(to_f))
    if d is None:
        return None
    if op == "<=": return d <= float(val)
    if op == ">=": return d >= float(val)
    if op == "==": return d == float(val)
    return None

def _eval_due_within_days_after(ctrls: Dict[str, Any], logic: Dict[str, Any]) -> Optional[bool]:
    anchor = logic.get("anchor"); event = logic.get("event")
    op = logic.get("op"); val = logic.get("value")
    if anchor not in ctrls or event not in ctrls:
        return None
    d = _days_between(ctrls.get(anchor), ctrls.get(event))
    if d is None:
        return None
    if op == "<=": return d <= float(val)
    if op == ">=": return d >= float(val)
    if op == "==": return d == float(val)
    return None

def _eval_all_false(ctrls: Dict[str, Any], logic: Dict[str, Any]) -> Optional[bool]:
    fields = logic.get("fields") or []
    if not fields:
        return None
    for f in fields:
        if f not in ctrls: return None
        v = ctrls.get(f)
        if v is None: return None
        if bool(v) is True:
            return False
    return True

def _eval_bool_equals(ctrls: Dict[str, Any], logic: Dict[str, Any]) -> Optional[bool]:
    f = logic.get("field"); expect = logic.get("value")
    if f not in ctrls:
        return None
    v = ctrls.get(f)
    if v is None:
        return None
    return (bool(v) == bool(expect))

def _eval_rule(ctrls: Dict[str, Any], rule: Dict[str, Any]) -> Dict[str, Any]:
    logic = rule.get("logic") or {}
    kind = logic.get("kind")
    res: Optional[bool] = None
    if kind == "days_between":
        res = _eval_days_between(ctrls, logic)
    elif kind == "due_within_days_after":
        res = _eval_due_within_days_after(ctrls, logic)
    elif kind == "all_false":
        res = _eval_all_false(ctrls, logic)
    elif kind == "bool_equals":
        res = _eval_bool_equals(ctrls, logic)
    status = "unknown" if res is None else ("pass" if res else "fail")
    return {
        "code": rule.get("code", ""),
        "label": rule.get("label", rule.get("code", "")),
        "status": status,
        "citations": rule.get("citations", []),
        "quotes": rule.get("quotes", [])
    }

def evaluate_control_checklists(doc_id: str, panel_cfg: Dict[str, Any]) -> Dict[str, Any]:
    facts = facts_store.load(doc_id)
    rules = facts.get("control_rules") or {}

    ctrls = (panel_cfg.get("controls") or {})
    travel = ctrls.get("travel") or {}
    bank = ctrls.get("bank") or {}
    credit = ctrls.get("credit") or {}

    out_travel = [_eval_rule(travel, r) for r in (rules.get("travel_rules") or [])]
    out_bank   = [_eval_rule(bank, r)   for r in (rules.get("bank_recon_rules") or [])]
    out_credit = [_eval_rule(credit, r) for r in (rules.get("credit_card_rules") or [])]

    return { "travel": out_travel, "bank": out_bank, "credit": out_credit }
