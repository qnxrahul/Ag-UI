from __future__ import annotations
import re
from typing import Any, Dict, List, Optional

_NUM = re.compile(r"""
    (?:
      \$\s*(?P<dollars>\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)
     |
      (?P<plain>\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)
    )
    \s*(?P<k>[kK])?
""", re.VERBOSE)

def _to_amount(match: re.Match) -> float:
    s = match.group("dollars") or match.group("plain")
    s = s.replace(",", "")
    val = float(s)
    if match.group("k"):
        val *= 1000.0
    return val

def _extract_lines(text: str) -> List[str]:
    lines = [ln.strip() for ln in text.splitlines()]
    return [ln for ln in lines if ln]

def _find_first_line_with(lines: List[str], needles: List[str]) -> Optional[str]:
    needles_l = [n.lower() for n in needles]
    for ln in lines:
        low = ln.lower()
        if any(n in low for n in needles_l):
            return ln.strip()
    return None

def extract_threshold(text: str, evidence_out: List[Dict[str, str]]) -> Optional[float]:
    
    lines = _extract_lines(text)
    nums: List[float] = []
    for m in _NUM.finditer(text):
        nums.append(_to_amount(m))
    if not nums:
        return None

    rfp_line = _find_first_line_with(lines, ["rfp", "tender", "competitive bid", "bids", "procurement"])
    dual_line = _find_first_line_with(lines, ["dual signature", "two signatures", "two signatories", "dual signatories"])
    if rfp_line:
        evidence_out.append({"key": "spend.rfp", "snippet": rfp_line})
    if dual_line:
        evidence_out.append({"key": "spend.dual", "snippet": dual_line})

    threshold = max(nums)
    th_opts = {f"{int(threshold):,}", f"{int(threshold)}", f"${int(threshold):,}", f"${int(threshold)}"}
    th_line = None
    for ln in lines:
        raw = ln
        test = raw.replace(" ", "").lower()
        for opt in th_opts:
            if opt.replace(",", "").lower() in test:
                th_line = ln.strip()
                break
        if th_line:
            break
    if th_line:
        evidence_out.append({"key": "spend.threshold", "snippet": th_line})
    return threshold

def compile_spend_policy(text: str) -> Dict[str, Any]:
    """
    Build spend policy JSON from raw text.
    Produces an 'evidence' array with the lines we matched.
    """
    evidence: List[Dict[str, str]] = []
    lines = _extract_lines(text)
    lower = text.lower()

    wants_dual = any(t in lower for t in ["dual signature", "two signatures", "two signatories", "dual signatories"])
    wants_rfp  = any(t in lower for t in ["rfp", "tender", "competitive bid", "bids", "procurement"])

    threshold = extract_threshold(text, evidence) or 20000.0

    base_steps = ["CertifyInvoice", "ManagerApproval"]
    under_steps = list(base_steps)
    over_steps  = list(base_steps)
    if wants_dual:
        over_steps.append("DualSignatures")
    if wants_rfp:
        over_steps.append("RFP")

    policy = {
        "spend_policy": {
            "tiers": [
                {
                    "name": f"Under{int(threshold)}",
                    "range": {"min": 0, "max": round(threshold - 0.01, 2)},
                    "requires": under_steps,
                },
                {
                    "name": f"AtOrOver{int(threshold)}",
                    "range": {"min": threshold, "max": "inf"},
                    "requires": over_steps,
                },
            ],
            "constraints": [
                {
                    "code": "SeparationOfDuties",
                    "message": "Requester and Approver must be different for the same spend.",
                    "appliesTo": ["/spend/requester", "/spend/approver"],
                }
            ],
            "evidence": evidence, 
        }
    }
    return policy
