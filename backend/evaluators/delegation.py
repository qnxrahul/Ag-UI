from __future__ import annotations
from typing import Any, Dict, List, Tuple, Optional
from datetime import datetime

DateFmt = "%Y-%m-%d"  

def _parse_date(s: str) -> Optional[datetime]:
    try:
        return datetime.strptime(s, DateFmt)
    except Exception:
        return None

def validate_delegation(delegation_state: Dict[str, Any], rules: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Returns a list of violations: [{code, message, path?}]
    - people: List[str]
    - roles: List[str]
    - assignments: { role -> person | null }
    - acting: [{ person, role, from, to }]
    """
    violations: List[Dict[str, Any]] = []

    people: List[str] = delegation_state.get("people", []) or []
    roles_in_state: List[str] = delegation_state.get("roles", []) or []
    assignments: Dict[str, Any] = delegation_state.get("assignments", {}) or {}
    acting: List[Dict[str, Any]] = delegation_state.get("acting", []) or []

    roles_allowed: List[str] = rules.get("delegation", {}).get("roles", []) or []
    constraints: List[Dict[str, Any]] = rules.get("delegation", {}).get("constraints", []) or []
    acting_rules: Dict[str, Any] = rules.get("delegation", {}).get("acting_rules", {}) or {}


    for r in roles_in_state:
        if r not in roles_allowed:
            violations.append({
                "code": "UnknownRole",
                "message": f"Role '{r}' is not defined in policy.",
                "path": "/delegation/roles"
            })

    for role_key, person in (assignments.items()):
        if role_key not in roles_allowed:
            violations.append({
                "code": "UnknownRole",
                "message": f"Assignment uses unknown role '{role_key}'.",
                "path": f"/delegation/assignments/{role_key}"
            })
        if person is not None and person not in people:
            violations.append({
                "code": "UnknownAssignee",
                "message": f"'{person}' is not in people list.",
                "path": f"/delegation/assignments/{role_key}"
            })

    def _same_person(role_a: str, role_b: str) -> bool:
        pa = assignments.get(role_a)
        pb = assignments.get(role_b)
        return (pa is not None) and (pa == pb)

    for c in constraints:
        if c.get("code") in ("ConflictRolePair", "ReconIndependence"):
            pair = c.get("pair") or []
            if len(pair) == 2 and _same_person(pair[0], pair[1]):
                violations.append({
                    "code": c.get("code", "RoleConflict"),
                    "message": c.get("message", f"Roles {pair[0]} and {pair[1]} must be held by different people."),
                    "path": f"/delegation/assignments/{pair[1]}"
                })

    if acting:
        require_dates = bool(acting_rules.get("require_dates", False))
        for idx, a in enumerate(acting):
            person = a.get("person")
            role = a.get("role")
            from_s = a.get("from")
            to_s = a.get("to")

            if role not in roles_allowed:
                violations.append({
                    "code": "ActingUnknownRole",
                    "message": f"Acting grant uses unknown role '{role}'.",
                    "path": f"/delegation/acting/{idx}"
                })
            if person not in people:
                violations.append({
                    "code": "ActingUnknownPerson",
                    "message": f"Acting grant names unknown person '{person}'.",
                    "path": f"/delegation/acting/{idx}"
                })

            if require_dates:
                d_from = _parse_date(from_s) if from_s else None
                d_to = _parse_date(to_s) if to_s else None
                if not d_from or not d_to:
                    violations.append({
                        "code": "ActingDatesMissing",
                        "message": "Acting grant must include valid 'from' and 'to' dates (YYYY-MM-DD).",
                        "path": f"/delegation/acting/{idx}"
                    })
                elif d_from > d_to:
                    violations.append({
                        "code": "ActingDateRangeInvalid",
                        "message": "'from' date must be on/before 'to' date.",
                        "path": f"/delegation/acting/{idx}"
                    })

            if assignments.get(role) == person:
                violations.append({
                    "code": "ActingRedundant",
                    "message": f"Acting grant redundant: '{person}' already holds '{role}'.",
                    "path": f"/delegation/acting/{idx}"
                })

    return violations
