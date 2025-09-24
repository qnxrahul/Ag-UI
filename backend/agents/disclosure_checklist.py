from __future__ import annotations
from typing import Any, Dict, List


def _suggest_questions_from_text(snippets: List[str]) -> List[Dict[str, Any]]:
    text = "\n".join(snippets).lower()
    questions: List[Dict[str, Any]] = []

    def add(qid: str, text: str, tags: List[str]):
        questions.append({
            "id": qid,
            "text": text,
            "status": "OPEN",
            "tags": tags,
            "citations": [],
        })

    if any(k in text for k in ["revenue", "asc 606", "ifrs 15", "disaggregation"]):
        add("rev_disagg", "Is revenue disaggregation disclosed by type, geography, and timing?", ["ASC606","IFRS15","Revenue"])
        add("rev_contract", "Are contract assets/liabilities rollforwards disclosed and reconciled?", ["ASC606","IFRS15","Revenue"])

    if any(k in text for k in ["segment", "operating segment", "codm"]):
        add("segments", "Are reportable segments, CODM measures, and reconciliations disclosed?", ["ASC280","IFRS8","Segments"])

    if any(k in text for k in ["goodwill", "impairment", "intangible"]):
        add("goodwill", "Are goodwill and intangible rollforwards and impairment tests disclosed?", ["ASC350","IAS36","Goodwill"])

    if any(k in text for k in ["fair value", "level 3", "valuation"]):
        add("fair_value", "Are fair value hierarchy and Level 3 reconciliations disclosed?", ["ASC820","IFRS13","FairValue"])

    if any(k in text for k in ["lease", "right-of-use", "rou asset"]):
        add("leases", "Are lease maturity analyses and ROU asset/liability movements disclosed?", ["ASC842","IFRS16","Leases"])

    if any(k in text for k in ["derivative", "hedge accounting", "oci"]):
        add("derivatives", "Are hedge designations, notional amounts, and OCI impacts disclosed?", ["ASC815","IFRS9","Derivatives"])

    if not questions:
        add("general", "Confirm that all required disclosures per framework are present.", ["General"])

    return questions


def run_disclosure_checklist(doc_id: str, index: Any, prompt: str) -> Dict[str, Any]:
    """
    Build a disclosure checklist panel by sampling top-k chunks from the active
    index (MultiDocIndex or DocIndex) and generating domain-informed questions.
    """
    try:
        # get relevant snippets
        chunks = index.top_k(prompt or "disclosure checklist", k=12)
    except Exception:
        try:
            chunks = index.top_k("financial statements", k=12)
        except Exception:
            chunks = []

    snippets: List[str] = []
    citations: List[Dict[str, Any]] = []
    for ch in chunks:
        snippets.append(ch.text[:2000])
        # source namespace from composite id: "enterprise:file::chunk_1" or "customer:file::chunk_7"
        src = "unknown"
        try:
            prefix = ch.id.split(":", 1)[0]
            if prefix in ("enterprise", "customer"):
                src = prefix
        except Exception:
            pass
        citations.append({"key": ch.id, "source": src, "snippet": ch.text[:240]})

    questions = _suggest_questions_from_text(snippets)

    panel_id = f"disclosure_{doc_id.replace(':','_')[:16]}"
    patches: List[Dict[str, Any]] = []

    cfg = {
        "type": "disclosure_checklist",
        "title": "Disclosure Checklist",
        "controls": {
            "framework": "ASC/IFRS",
            "period": "",
            "company": "",
        },
        "data": {
            "questions": questions,
            "citations": citations,
        },
    }

    patches.append({"op": "add", "path": "/panels/-", "value": panel_id})
    patches.append({"op": "add", "path": f"/panel_configs/{panel_id}", "value": cfg})

    return {
        "patches": patches,
        "message": "I generated a disclosure checklist with domain questions; review and update statuses.",
    }

