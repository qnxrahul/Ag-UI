from __future__ import annotations
import json, re, os
from typing import Any, Dict, List, Optional
from openai import OpenAI

_CLIENT = None

def _client() -> OpenAI:
    global _CLIENT
    if _CLIENT is None:
        _CLIENT = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _CLIENT

def generate_json(prompt: str, context: str, schema_hint: str, model: str = "gpt-4o-mini", max_retries: int = 2) -> Dict[str, Any]:
    """
    Calls the LLM and returns JSON dict per `schema_hint`. Retries if invalid JSON.
    """
    sys = (
        "You are a careful information extraction system. "
        "Return ONLY a compact, valid JSON object. Do not include explanations."
    )
    user = (
        f"### INSTRUCTIONS\n{prompt}\n\n"
        f"### CONTEXT (verbatim snippets from the policy)\n{context}\n\n"
        f"### JSON SCHEMA (example / required keys)\n{schema_hint}\n\n"
        "Return strict JSON. If uncertain, include an 'ambiguous': true flag and provide 'candidates'."
    )

    last_err = None
    for _ in range(max_retries + 1):
        resp = _client().chat.completions.create(
            model=model,
            messages=[{"role":"system","content":sys}, {"role":"user","content":user}],
            temperature=0.1,
        )
        txt = resp.choices[0].message.content.strip()
        try:
            if txt.startswith("```"):
                txt = re.sub(r"^```[a-z]*\n?", "", txt).rstrip("` \n")
            data = json.loads(txt)
            if not isinstance(data, dict):
                raise ValueError("Top-level JSON must be an object")
            return data
        except Exception as e:
            last_err = e
    raise ValueError(f"LLM did not return valid JSON after retries: {last_err}")
