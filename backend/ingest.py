from __future__ import annotations
from typing import Optional
from pdfminer.high_level import extract_text

def extract_text_from_pdf(path: str) -> str:
    try:
        return extract_text(path) or ""
    except Exception:
        return ""
