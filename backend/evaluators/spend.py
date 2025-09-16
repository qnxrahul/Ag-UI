from __future__ import annotations
from typing import Any, Dict, List

def _pick_tier(amount: float | None, tiers: List[Dict[str, Any]]) -> Dict[str, Any] | None:
    if amount is None:
        return None
    for t in tiers:
        _min = t["range"]["min"]
        _max = float("inf") if t["range"]["max"] == "inf" else t["range"]["max"]
        if _min <= float(amount) <= _max:
            return t
    return None

def derive_requirements(spend: Dict[str, Any], policy: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compute required steps + violations given the current /spend state and policy JSON.
    Returns: {"required_steps": [...], "violations": [...]}
    """
    tiers = policy["spend_policy"]["tiers"]
    constraints = policy["spend_policy"].get("constraints", [])

    amount = spend.get("amount")
    tier = _pick_tier(amount, tiers)

    steps: List[str] = []
    if tier:
        steps = list(tier.get("requires", []))

    violations: List[Dict[str, Any]] = []
    if any(c.get("code") == "SeparationOfDuties" for c in constraints):
        req = spend.get("requester")
        app = spend.get("approver")
        if req and app and req == app:
            violations.append({
                "code": "SeparationOfDuties",
                "message": "Requester and Approver must be different.",
                "path": "/spend/approver"
            })

    return {"required_steps": steps, "violations": violations}
