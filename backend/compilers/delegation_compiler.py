from __future__ import annotations
from typing import Any, Dict, List

def _extract_lines(text: str) -> List[str]:
    return [ln.strip() for ln in text.splitlines() if ln.strip()]

def compile_delegation_rules(text: str) -> Dict[str, Any]:
    
    t = text.lower()
    lines = _extract_lines(text)
    evidence: List[Dict[str, str]] = []

    roles: List[str] = []
    def add_role(name: str, hint: str | None = None):
        if name not in roles:
            roles.append(name)
            if hint:
                evidence.append({"key": f"delegation.role.{name}", "snippet": hint})

    def find_line(*needles: str) -> str | None:
        ns = [n.lower() for n in needles]
        for ln in lines:
            low = ln.lower()
            if any(n in low for n in ns):
                return ln
        return None

    if (ln := find_line("spending authority", "spending approval", "purchase approval")):
        add_role("Spending", ln)
    if (ln := find_line("payment authority", "cheque signing", "check signing", "payment approval")):
        add_role("Payment", ln)
    if (ln := find_line("bank reconciliation", "bank recon", "reconciliation of bank")):
        add_role("BankReconciliation", ln)

    if not roles:
        roles = ["Spending", "Payment", "BankReconciliation"]

    constraints: List[Dict[str, Any]] = []

    if (ln := find_line("separation of duties", "separation-of-duties", "duties must be separate")):
        constraints.append({
            "code": "ConflictRolePair",
            "message": "Spending and Payment must be held by different people.",
            "pair": ["Spending", "Payment"]
        })
        evidence.append({"key": "delegation.constraint.ConflictRolePair", "snippet": ln})

    if (ln := find_line("bank reconciliation independent", "reconciliation independent", "independent of payment", "reconciliation must be independent")):
        constraints.append({
            "code": "ReconIndependence",
            "message": "Bank Reconciliation must be prepared by someone different from Payment.",
            "pair": ["BankReconciliation", "Payment"]
        })
        evidence.append({"key": "delegation.constraint.ReconIndependence", "snippet": ln})

    if not constraints:
        constraints = [
            {
                "code": "ConflictRolePair",
                "message": "Spending and Payment must be held by different people.",
                "pair": ["Spending", "Payment"]
            },
            {
                "code": "ReconIndependence",
                "message": "Bank Reconciliation must be prepared by someone different from Payment.",
                "pair": ["BankReconciliation", "Payment"]
            }
        ]

    rules = {
        "delegation": {
            "roles": roles,
            "constraints": constraints,
            "acting_rules": { "require_dates": True },
            "evidence": evidence  
        }
    }
    return rules
