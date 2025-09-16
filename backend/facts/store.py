from __future__ import annotations
import json
from pathlib import Path
from typing import Dict, Any, Optional

FACTS_DIR = Path(__file__).resolve().parent.parent / "facts"
FACTS_DIR.mkdir(parents=True, exist_ok=True)

def _path(doc_id: str) -> Path:
    return FACTS_DIR / f"{doc_id}.json"

def load(doc_id: str) -> Dict[str, Any]:
    p = _path(doc_id)
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return {}

def save(doc_id: str, data: Dict[str, Any]) -> None:
    _path(doc_id).write_text(json.dumps(data, indent=2), encoding="utf-8")

def upsert(doc_id: str, key: str, value: Any) -> None:
    d = load(doc_id)
    d[key] = value
    save(doc_id, d)
