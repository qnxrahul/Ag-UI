from __future__ import annotations
import json, re, os
from typing import Any, Dict, List, Optional
from openai import OpenAI

_CLIENT = None

# --- OpenRouter defaults (can be overridden by environment vars) ---
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free")


def _client() -> OpenAI:
    global _CLIENT
    if _CLIENT is None:
        openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
        if openrouter_api_key:
            default_headers = {}
            # Optional but recommended for OpenRouter analytics/rate-limits
            ref = os.getenv("OPENROUTER_REFERRER") or os.getenv("OPENROUTER_SITE_URL")
            title = os.getenv("OPENROUTER_TITLE") or os.getenv("OPENROUTER_APP_TITLE")
            if ref:
                default_headers["HTTP-Referer"] = ref
            if title:
                default_headers["X-Title"] = title
            _CLIENT = OpenAI(api_key=openrouter_api_key, base_url=OPENROUTER_BASE_URL, default_headers=default_headers or None)
        else:
            # Fallback: regular OpenAI
            _CLIENT = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _CLIENT


def generate_json(prompt: str, context: str, schema_hint: str, model: str | None = None, max_retries: int = 2) -> Dict[str, Any]:
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
    # Choose default model based on client in use
    use_model = model or (OPENROUTER_MODEL if os.getenv("OPENROUTER_API_KEY") else "gpt-4o-mini")
    for _ in range(max_retries + 1):
        resp = _client().chat.completions.create(
            model=use_model,
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
