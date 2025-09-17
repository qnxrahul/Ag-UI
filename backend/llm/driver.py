from __future__ import annotations
import json, re, os
from typing import Any, Dict, List, Optional
from openai import OpenAI

_CLIENT = None

# --- OpenRouter defaults (can be overridden by environment vars) ---
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free")
OPENROUTER_FALLBACK_MODELS = [
    m.strip() for m in (os.getenv(
        "OPENROUTER_FALLBACK_MODELS",
        "meta-llama/llama-3.1-8b-instruct:free,mistralai/mistral-7b-instruct:free,qwen/qwen2.5-7b-instruct:free"
    ).split(",")) if m.strip()
]

def _has_any_api() -> bool:
    return bool(os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY"))

def _is_openrouter() -> bool:
    return bool(os.getenv("OPENROUTER_API_KEY"))


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

    # If no API keys set, degrade gracefully with an empty extraction
    if not _has_any_api():
        return {}

    last_err = None
    # Prepare model queue
    if _is_openrouter():
        prefer = (model or OPENROUTER_MODEL).strip()
        queue = [m for m in [prefer] + [m for m in OPENROUTER_FALLBACK_MODELS if m != prefer] if m]
    else:
        queue = [model or "gpt-4o-mini"]

    for mdl in queue:
        for _ in range(max_retries + 1):
            try:
                resp = _client().chat.completions.create(
                    model=mdl,
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
            except Exception as api_err:
                last_err = api_err
                # If OpenRouter returns 404 for model (No endpoints found), try next model
                try:
                    msg = str(api_err)
                    if ("404" in msg) and ("No endpoints found" in msg):
                        break  # move to next model in queue
                except Exception:
                    pass
                continue

    # As a last resort, return empty dict so callers can proceed without hard failing
    return {}
