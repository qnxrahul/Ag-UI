from __future__ import annotations

import asyncio
import sys
import csv
import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
from uuid import uuid4
from fastapi import Request

from agents.roles_sod import run_roles_sod, evaluate_roles_controls
from agents.approval_chain import run_approval_chain, evaluate_approval_controls
from agents.control_checklists import run_control_checklists, evaluate_control_checklists
from agents.exceptions_tracker import run_exceptions_tracker, evaluate_exceptions_controls


import jsonpatch
from fastapi import Body, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi import BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError
from sse_starlette.sse import EventSourceResponse

from dotenv import load_dotenv
try:
    from ag_ui_langgraph import add_langgraph_fastapi_endpoint
except Exception:
    add_langgraph_fastapi_endpoint = None  # type: ignore
import httpx
load_dotenv() 


from agents.spending_checker import (
    evaluate_spending_controls,
    run_spending_checker,
)
from compilers.delegation_compiler import compile_delegation_rules
from compilers.spend_compiler import compile_spend_policy
from evaluators.delegation import validate_delegation
from evaluators.spend import derive_requirements
from facts import store as facts_store
from ingest import extract_text_from_pdf
from retrieval.index import DocIndex, chunk_text_to_paragraphs
from state_models import (
    AppState,
    Citation,
    DelegationState,
    Meta,
    SpendState,
    Violation,
)

app = FastAPI(title="AG-UI PoC Backend", version="0.2.0")
# Prefer Proactor loop on Windows to avoid select() fd limits
try:
    if sys.platform.startswith("win"):
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
except Exception:
    pass

# Attach AG-UI LangGraph endpoint if available
try:
    if add_langgraph_fastapi_endpoint is not None:
        from graph.agent import build_graph
        graph_obj = build_graph()
        if graph_obj is not None:
            add_langgraph_fastapi_endpoint(app, graph_obj, "/agent")
except Exception:
    pass

# Always provide a fallback /agent endpoint that proxies to /agui/run
@app.post("/agent")
async def agent_fallback(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    port = os.getenv("PORT", "8000")
    run_url = f"http://127.0.0.1:{port}/agui/run"
    async def forward():
        async with httpx.AsyncClient(timeout=None) as client:
            try:
                async with client.stream("POST", run_url, json=body) as resp:
                    if resp.status_code != 200:
                        err = await resp.aread()
                        yield b"event: ERROR\n" + b"data: " + err + b"\n\n"
                        return
                    async for chunk in resp.aiter_bytes():
                        if chunk:
                            yield chunk
            except Exception as e:
                payload = {"status": 502, "body": f"proxy_failure: {type(e).__name__}: {e}"}
                yield b"event: ERROR\n" + b"data: " + json.dumps(payload).encode("utf-8") + b"\n\n"
    return StreamingResponse(forward(), media_type="text/event-stream")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FILES_DIR = Path(__file__).parent / "files"
FILES_DIR.mkdir(parents=True, exist_ok=True)

DOCS_DIR = Path(__file__).parent / "docs"
DOCS_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/files", StaticFiles(directory=str(FILES_DIR)), name="files")

_initial_state = AppState(
    meta=Meta(docName="Demo Policy"),
    panels=[],
    panel_configs={},
    spend=SpendState(),
    delegation=DelegationState(),
    violations=[],
    citations=[],
)
STATE: Dict[str, Any] = _initial_state.model_dump()
STATE_LOCK = asyncio.Lock()

POLICY_DIR = Path(__file__).parent / "policy"
SPEND_POLICY_PATH = POLICY_DIR / "spend_policy.json"
DELEGATION_RULES_PATH = POLICY_DIR / "delegation_rules.json"

# ----------In-memory retrieval registries ----------
# Map of doc_id -> DocIndex
DOC_INDEXES: Dict[str, DocIndex] = {}
CURRENT_DOC_ID: Optional[str] = None 
# ---------------------------------------------------------

# ---- LangGraph configuration (AG-UI) ----
LANGGRAPH_RUN_URL = os.getenv("LANGGRAPH_RUN_URL")
MAX_RUN_SECONDS = float(os.getenv("AGUI_MAX_RUN_SECONDS", "20"))
EARLY_STOP_ON_TOOL = (os.getenv("AGUI_EARLY_STOP_ON_TOOL", "1") != "0")

# ---- Token-aware run cache & metrics ----
RUN_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECS = 300
TOKENS_SAVED_EST: float = 0.0
TOKENS_USED_REPORTED: float = 0.0
THREAD_MEMORY: Dict[str, Dict[str, Any]] = {}

def _estimate_input_tokens(payload: Any) -> int:
    try:
        s = json.dumps(payload, ensure_ascii=False)
        return int(max(1, len(s) / 4))
    except Exception:
        return 0


def _load_spend_policy() -> Dict[str, Any]:
    with open(SPEND_POLICY_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _load_delegation_rules() -> Dict[str, Any]:
    with open(DELEGATION_RULES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


SPEND_POLICY = _load_spend_policy()
DELEGATION_RULES = _load_delegation_rules()


def _save_spend_policy(policy: Dict[str, Any]) -> None:
    SPEND_POLICY_PATH.write_text(json.dumps(policy, indent=2), encoding="utf-8")


def _save_delegation_rules(rules: Dict[str, Any]) -> None:
    DELEGATION_RULES_PATH.write_text(json.dumps(rules, indent=2), encoding="utf-8")

# ---- Chat intent helper (doc-agnostic) ----
def detect_intent(prompt: str) -> str:
    q = (prompt or "").strip().lower()
    if not q:
        return "unknown"
    if "spend" in q or "procure" in q or "rfp" in q or "threshold" in q or "checker" in q:
        return "spending"
    if "roles" in q or "sod" in q or "separation" in q or "delegation" in q or "cheque" in q or "check signing" in q:
        return "roles_sod"
    if "approval" in q and ("chain" in q or "workflow" in q or "matrix" in q):
        return "approval_chain"
    if "control" in q or "calendar" in q or "checklist" in q or "travel" in q or "reconcil" in q or "credit card" in q or "bank" in q:
        return "controls"
    if "exception" in q or "waiver" in q or "sole source" in q or "emergency" in q or "deviation" in q:
        return "exceptions"
    return "unknown"


def _thread_context_summary() -> str:
    try:
        meta = STATE.get("meta", {}) or {}
        doc = meta.get("doc_id") or meta.get("docName") or "(none)"
        cfgs = (STATE.get("panel_configs") or {})
        ptypes = sorted({(cfg or {}).get("type") for cfg in cfgs.values() if isinstance(cfg, dict)})
        return (
            f"doc_id={doc} panels={len(cfgs)} types={','.join([t for t in ptypes if t])}"
        )
    except Exception:
        return ""


def _controls_bucket_snapshot(state: Dict[str, Any]) -> Dict[str, Any]:
    try:
        panel_cfgs = (state or {}).get("panel_configs") or {}
        out: Dict[str, Any] = {}
        for pid, cfg in panel_cfgs.items():
            ptype = (cfg or {}).get("type")
            ctrls = (cfg or {}).get("controls") or {}
            if ptype == "form_spending":
                amt = ctrls.get("amount")
                cat = (ctrls.get("category") or "").strip().lower() or None
                if isinstance(amt, (int, float)):
                    try:
                        amt = int(max(0, round(float(amt) / 1000.0)) * 1000)
                    except Exception:
                        amt = None
                out[pid] = {"type": ptype, "amount_bucket": amt, "category": cat}
            elif ptype == "approval_chain":
                amt = ctrls.get("amount")
                inst = (ctrls.get("instrument") or "").strip().lower() or None
                if isinstance(amt, (int, float)):
                    try:
                        amt = int(max(0, round(float(amt) / 1000.0)) * 1000)
                    except Exception:
                        amt = None
                out[pid] = {"type": ptype, "amount_bucket": amt, "instrument": inst}
            elif ptype == "exceptions_tracker":
                entry = ctrls.get("entry") or {}
                kw = (entry.get("keywords") or "").strip().lower() or None
                out[pid] = {"type": ptype, "kw": kw}
        return out
    except Exception:
        return {}



class Client:
    def __init__(self) -> None:
        self.queue: asyncio.Queue = asyncio.Queue()


clients: Set[Client] = set()
clients_lock = asyncio.Lock()
MAX_SSE_CLIENTS = int(os.getenv("AGUI_MAX_CLIENTS", "100"))


async def broadcast(event: str, payload: Any) -> None:
    # Map to AG-UI standard aliases as well
    events: List[str] = [event]
    if event == "STATE_SNAPSHOT":
        events.append("state.snapshot")
    elif event == "STATE_DELTA":
        events.append("state.delta")
    elif event == "TOOL_RESULT":
        name = (payload or {}).get("name") if isinstance(payload, dict) else None
        events.append("tool.result")
        if name == "ui_card":
            events.append("ui.card")
    async with clients_lock:
        for c in list(clients):
            for ev in events:
                try:
                    await c.queue.put({"event": ev, "data": json.dumps(payload)})
                except Exception:
                    clients.discard(c)


async def sse_generator(client: Client):
    yield {"event": "RUN_STARTED", "data": json.dumps({"ts": time.time()})}
    async with STATE_LOCK:
        snapshot = {"state": STATE, "ts": time.time()}
    yield {"event": "STATE_SNAPSHOT", "data": json.dumps(snapshot)}
    yield {"event": "state.snapshot", "data": json.dumps(snapshot)}
    try:
        while True:
            try:
                message = await asyncio.wait_for(client.queue.get(), timeout=15.0)
                yield message
            except asyncio.TimeoutError:
                yield {"event": "HEARTBEAT", "data": json.dumps({"ts": time.time()})}
    finally:
        async with clients_lock:
            clients.discard(client)


class PatchOp(BaseModel):
    op: str
    path: str
    value: Any | None = None
    from_: str | None = None


class PatchRequest(BaseModel):
    ops: List[PatchOp]


LAST_APPLIED: List[Dict[str, Any]] = []
LAST_ERROR: Dict[str, Any] | None = None


def _normalize_ops(ops_raw: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    ops: List[Dict[str, Any]] = []
    for op in ops_raw:
        op2 = dict(op)
        if "from_" in op2:
            op2["from"] = op2.pop("from_")
        ops.append(op2)
    return ops


def _validate_state(candidate: Dict[str, Any]) -> AppState:
    """Validate dict against AppState; raise ValidationError if invalid."""
    return AppState.model_validate(candidate)


class RunAgentTool(BaseModel):
    name: str
    description: Optional[str] = None
    parameters: Dict[str, Any] = {}


class RunAgentContext(BaseModel):
    role: str
    content: str


class RunAgentMessage(BaseModel):
    role: str
    content: str


class RunAgentInputModel(BaseModel):
    threadId: Optional[str] = None
    runId: Optional[str] = None
    messages: List[RunAgentMessage]
    tools: Optional[List[RunAgentTool]] = None
    context: Optional[List[RunAgentContext]] = None
    forwardedProps: Optional[Dict[str, Any]] = None


# ----------------- AG-UI Tools -----------------
class Tool(BaseModel):
    name: str
    title: str
    description: str | None = None
    schema: Dict[str, Any] = {}


TOOLS: Dict[str, Tool] = {
    "panel.patch": Tool(
        name="panel.patch",
        title="Apply JSON Patch",
        description="Apply JSON Patch ops to app state",
        schema={"type":"object","properties":{"ops":{"type":"array"}},"required":["ops"]},
    ),
    "export.csv": Tool(
        name="export.csv",
        title="Export CSV",
        description="Export a CSV summary and return URL",
        schema={"type":"object","properties":{}},
    ),
    "open.panel": Tool(
        name="open.panel",
        title="Open Panel",
        description="Ensure a panel exists (by type)",
        schema={"type":"object","properties":{"type":{"type":"string"}},"required":["type"]},
    ),
}


@app.get("/agui/tools")
async def list_tools():
    return {"tools": [t.model_dump() for t in TOOLS.values()]}


@app.post("/agui/tools/run")
async def run_tool(body: Dict[str, Any]):
    name = (body or {}).get("name")
    args = (body or {}).get("args") or {}
    if name not in TOOLS:
        return JSONResponse(status_code=404, content={"error": "unknown tool"})

    if name == "panel.patch":
        try:
            patch_req = PatchRequest(ops=[PatchOp(**op) for op in (args.get("ops") or [])])
        except Exception as e:
            return JSONResponse(status_code=400, content={"error": f"invalid ops: {e}"})
        res = await apply_patch(patch_req)
        await broadcast("TOOL_RESULT", {"name":"tool.result","tool":"panel.patch","ok":True})
        return res

    if name == "export.csv":
        async with STATE_LOCK:
            base = json.loads(json.dumps(STATE))
        url = _export_csv_from_state(base)
        await broadcast("TOOL_RESULT", {"name":"tool.result","tool":"export.csv","url":url})
        return {"ok": True, "url": url}

    if name == "open.panel":
        ptype = (args.get("type") or "").strip()
        if not ptype:
            return JSONResponse(status_code=400, content={"error": "missing type"})
        # Use agents to create as needed
        doc_id = STATE.get("meta", {}).get("doc_id")
        if not doc_id or doc_id not in DOC_INDEXES:
            return JSONResponse(status_code=400, content={"error": "No document uploaded yet"})
        index = DOC_INDEXES[doc_id]
        mapping = {
            "form_spending": lambda: run_spending_checker(doc_id, index, "spending"),
            "approval_chain": lambda: run_approval_chain(doc_id, index, "approval chain"),
            "exceptions_tracker": lambda: run_exceptions_tracker(doc_id, index, "exceptions"),
        }
        if ptype not in mapping:
            return JSONResponse(status_code=400, content={"error": "unsupported panel type"})
        result = mapping[ptype]()
        patches = result.get("patches") or []
        if patches:
            await broadcast("TOOL_RESULT", {"name":"tool.result","tool":"open.panel","created":ptype})
            return await apply_patch(PatchRequest(ops=[PatchOp(**op) for op in patches]))
        return {"ok": True}

    return JSONResponse(status_code=400, content={"error": "unhandled tool"})


def _ops_touch_prefix(ops: List[Dict[str, Any]], prefix: str) -> bool:
    return any(o.get("path", "").startswith(prefix) for o in ops)


def _export_csv_from_state(state: Dict[str, Any]) -> str:
    """
    Writes a CSV summarizing current data (legacy + dynamic panels).
    Returns a URL path "/files/<filename>" that can be opened in a browser.
    """
    ts = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    unique = uuid4().hex[:8]
    fname = f"export-{ts}-{unique}.csv"
    fpath = FILES_DIR / fname

    def _get(d, *path, default=None):
        cur = d
        for p in path:
            if cur is None:
                return default
            cur = cur.get(p) if isinstance(cur, dict) else default
        return cur if cur is not None else default

    with fpath.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Section", "Key", "Value"])

        # -------- 1) Legacy top-level blocks (only if populated) --------
        spend = state.get("spend") or {}
        legacy_vals = {
            "amount": spend.get("amount"),
            "category": spend.get("category"),
            "requester": spend.get("requester"),
            "approver": spend.get("approver"),
            "required_steps": ";".join(spend.get("required_steps") or []),
        }
        if any(v not in (None, "", []) for v in legacy_vals.values()):
            for k, v in legacy_vals.items():
                w.writerow(["Legacy Spend", k, v if v is not None else ""])

        delegation = state.get("delegation") or {}
        assignments = delegation.get("assignments") or {}
        if assignments:
            for role, person in assignments.items():
                w.writerow(["Legacy Delegation", role, person])

        # -------- 2) Dynamic panels (current agents) --------
        panel_configs = state.get("panel_configs") or {}
        for pid, cfg in (panel_configs.items()):
            ptype = (cfg or {}).get("type")
            controls = (cfg or {}).get("controls") or {}
            data = (cfg or {}).get("data") or {}

            # Spending checker
            if ptype == "form_spending":
                label = "Spending (panel)"
                w.writerow([label, "amount", controls.get("amount")])
                w.writerow([label, "category", controls.get("category")])
                steps = ";".join(data.get("required_steps") or [])
                w.writerow([label, "required_steps", steps])

            # Approval chain
            elif ptype == "approval_chain":
                label = "Approval Chain"
                w.writerow([label, "amount", controls.get("amount")])
                w.writerow([label, "instrument", controls.get("instrument")])
                chain = ";".join(data.get("chain") or [])
                w.writerow([label, "approver_chain", chain])

                rules = data.get("rules") or {}
                lvls = len(rules.get("levels") or [])
                trigs = len(rules.get("triggers") or [])
                if lvls or trigs:
                    w.writerow([label, "levels_found", lvls])
                    w.writerow([label, "triggers_found", trigs])

            # Roles & SoD
            elif ptype == "roles_sod":
                label = "Roles & SoD"
                assigns = (controls.get("assignments") or {})
                if isinstance(assigns, dict) and assigns:
                    for role, person in assigns.items():
                        w.writerow([label, f"assign:{role}", person])
                # Violations summary (from data.violations)
                viols = data.get("violations") or []
                if isinstance(viols, list) and viols:
                    w.writerow([label, "violations_count", len(viols)])
                    for v in viols[:5]:
                        lhs = v.get("role") or v.get("actor") or "role"
                        rhs = v.get("conflict_with") or v.get("conflict") or "conflict"
                        w.writerow([label, "violation", f"{lhs} ↔ {rhs}"])

            # Control checklists
            elif ptype == "control_checklists":
                label = "Control Checklists"
                status = data.get("status") or {}
                for group in ("travel", "bank", "credit"):
                    items = status.get(group) or []
                    if items:
                        w.writerow([label, f"{group}_count", len(items)])
                        flat = "; ".join(str(x) for x in items)
                        w.writerow([label, f"{group}_items", flat])

            # Exceptions tracker
            elif ptype == "exceptions_tracker":
                label = "Exceptions & Waivers"
                entry = controls.get("entry") or {}
                w.writerow([label, "keywords", entry.get("keywords")])
                w.writerow([label, "amount", entry.get("amount")])
                w.writerow([label, "currency", entry.get("currency")])

                # PASS/FAIL/UNKNOWN rows
                status = data.get("status") or {}
                for group in ("approvals", "documentation", "reporting"):
                    rows = status.get(group) or []
                    if rows:
                        # tallies
                        tally = {"PASS": 0, "FAIL": 0, "UNKNOWN": 0}
                        for r in rows:
                            st = (r.get("status") or "UNKNOWN").upper()
                            if st not in tally: tally[st] = 0
                            tally[st] += 1
                        w.writerow([label, f"{group}_summary", f"PASS:{tally['PASS']} | FAIL:{tally['FAIL']} | UNKNOWN:{tally['UNKNOWN']}"])
                        want = "; ".join((r.get("item") or "") for r in rows if r.get("item"))
                        if want:
                            w.writerow([label, f"{group}_items", want])

            else:
                if ptype:
                    w.writerow([f"Panel ({ptype})", "id", pid])

    return f"/files/{fname}"



@app.get("/health")
async def health():
    return {"ok": True, "ts": time.time()}


@app.get("/agui/state")
async def get_state():
    async with STATE_LOCK:
        return STATE


@app.get("/agui/schema")
async def get_schema():
    return AppState.model_json_schema()


@app.post("/agui/reset")
async def reset_state(body: Dict[str, Any] | None = None):
    global STATE
    panels = (body or {}).get("panels", [])
    fresh = AppState(
        meta=Meta(docName="Demo Policy"),
        panels=list(panels),
        spend=SpendState(),
        delegation=DelegationState(),
        violations=[],
        citations=[],
    ).model_dump()
    async with STATE_LOCK:
        STATE.clear()
        STATE.update(fresh)
    await broadcast("STATE_SNAPSHOT", {"state": STATE, "ts": time.time()})
    return {"ok": True, "state": STATE}


@app.get("/debug/last")
async def debug_last():
    return {"last_applied": LAST_APPLIED, "last_error": LAST_ERROR}


@app.get("/agui/stream")
async def stream(request: Request):
    client = Client()
    async with clients_lock:
        if len(clients) >= MAX_SSE_CLIENTS:
            try:
                # drop an arbitrary existing client to respect cap
                clients.discard(next(iter(clients)))
            except Exception:
                pass
        clients.add(client)
    return EventSourceResponse(sse_generator(client))


@app.post("/agui/run")
async def agui_run(request: Request):
    """
    Proxy AG-UI run calls to a LangGraph deployment and stream SSE back to the client.
    Configure target via env var LANGGRAPH_RUN_URL.
    """
    # Resolve run URL once (prefer configured; fallback to local /agent)
    run_url = LANGGRAPH_RUN_URL or f"http://127.0.0.1:{os.getenv('PORT','8000')}/agent"

    try:
        data = await request.json()
    except Exception:
        data = None
    # Normalize to RunAgentInputModel
    try:
        if not isinstance(data, dict):
            data = {}
        if "messages" not in data and (data.get("prompt") or data.get("message") or data.get("text")):
            text = data.get("prompt") or data.get("message") or data.get("text")
            data = {"messages": [{"role": "user", "content": str(text)}]}
        RunAgentInputModel(**data)
    except Exception as e:
        return StreamingResponse((chunk for chunk in [b"event: ERROR\n" + b"data: \"invalid RunAgentInput\"\n\n"]))

    # ---- Build a semantic cache key (intent + doc + top chunks + normalized prompt) ----
    key = None
    try:
        messages = (data or {}).get("messages") if isinstance(data, dict) else None
        last_msg = None
        if isinstance(messages, list) and messages:
            # pick last user message
            for m in reversed(messages):
                if isinstance(m, dict) and (m.get("role") or "").lower() == "user":
                    last_msg = (m.get("content") or "").strip()
                    break
        norm_prompt = " ".join((last_msg or "").lower().split())
        intent = detect_intent(norm_prompt)
        doc_id = (STATE.get("meta", {}) or {}).get("doc_id")
        top_ids: List[str] = []
        if isinstance(doc_id, str) and doc_id in DOC_INDEXES and norm_prompt:
            try:
                idx = DOC_INDEXES[doc_id]
                # use the prompt directly; fallback to intent label if empty
                base_q = norm_prompt or intent
                # adaptive k: start small, can increase based on simple heuristics later
                k = 6
                for c in idx.top_k(base_q, k=k):
                    top_ids.append(c.id)
            except Exception:
                top_ids = []
        # include bucketing snapshot of controls to widen hit rate
        ctl = _controls_bucket_snapshot(STATE)
        key_obj = {"intent": intent, "doc": doc_id, "ids": top_ids, "prompt": norm_prompt, "controls": ctl}
        key = json.dumps(key_obj, sort_keys=True)
    except Exception:
        # fallback to raw body key
        if isinstance(data, dict):
            try:
                key = json.dumps(data, sort_keys=True)
            except Exception:
                key = None
    # Thread memory/context enrichment
    try:
        model = RunAgentInputModel(**(data or {}))
        tid = model.threadId or "default"
        mem = THREAD_MEMORY.setdefault(tid, {"hints": [], "last": None})
        # Attach context hint
        hint = _thread_context_summary()
        if hint:
            data.setdefault("context", [])
            data["context"].append({"role": "system", "content": hint})
        # Track last user
        if model.messages:
            last_user = next((m for m in reversed(model.messages) if (m.role or "").lower() == "user"), None)
            if last_user:
                mem["last"] = last_user.content
    except Exception:
        pass

    now = time.time()
    if key and key in RUN_CACHE:
        entry = RUN_CACHE.get(key) or {}
        if now - float(entry.get("ts", 0)) <= CACHE_TTL_SECS:
            saved = int(entry.get("saved_est", 0))
            async def replay():
                buf: bytes = entry.get("bytes", b"")
                # Return the exact cached SSE content
                yield buf
            # Update global saved counter (best-effort)
            try:
                global TOKENS_SAVED_EST
                TOKENS_SAVED_EST += float(saved)
            except Exception:
                pass
            return StreamingResponse(replay(), media_type="text/event-stream", headers={
                "X-AGUI-Cache": "HIT",
                "X-AGUI-Saved-Est": str(saved)
            })

    async def proxy_stream():
        async with httpx.AsyncClient(timeout=None) as client:
            try:
                async with client.stream("POST", run_url, json=data) as resp:
                    if resp.status_code != 200:
                        body = await resp.aread()
                        payload = {"status": resp.status_code, "body": body.decode("utf-8", "ignore")}
                        yield b"event: ERROR\n" + b"data: " + json.dumps(payload).encode("utf-8") + b"\n\n"
                        return
                    # Accumulate for caching and inspect usage events
                    buffer = bytearray()
                    decoder = None
                    try:
                        decoder = httpx.Decoder()
                    except Exception:
                        decoder = None
                    start_ts = time.time()
                    saw_tool = False
                    async for chunk in resp.aiter_bytes():
                        if not chunk:
                            continue
                        # enforce latency cap
                        if (time.time() - start_ts) > MAX_RUN_SECONDS:
                            yield b"event: INFO\n" + b"data: {\"reason\":\"time_cap\"}\n\n"
                            break
                        buffer.extend(chunk)
                        # Pass through SSE from LangGraph unchanged
                        yield chunk
                        # Try to capture usage events of form: "event: USAGE" with JSON tokens
                        try:
                            text = chunk.decode("utf-8", "ignore")
                            if "event:" in text and "data:" in text:
                                blocks = text.split("\n\n")
                                for blk in blocks:
                                    if not blk.strip():
                                        continue
                                    ev = None; dt = None
                                    for line in blk.split("\n"):
                                        if line.startswith("event:"):
                                            ev = line[6:].strip().lower()
                                        elif line.startswith("data:"):
                                            dt = line[5:].strip()
                                    if EARLY_STOP_ON_TOOL and ev in ("tool_result", "tool", "ui_card"):
                                        saw_tool = True
                                    if EARLY_STOP_ON_TOOL and saw_tool:
                                        yield b"event: INFO\n" + b"data: {\"reason\":\"early_stop_tool\"}\n\n"
                                        # stop upstream stream
                                        break
                                    if ev in ("usage", "llm_usage") and dt:
                                        try:
                                            obj = json.loads(dt)
                                            used = float(obj.get("total_tokens") or obj.get("total") or 0)
                                            if used:
                                                global TOKENS_USED_REPORTED
                                                TOKENS_USED_REPORTED += used
                                        except Exception:
                                            pass
                        except Exception:
                            pass
                    # end for
                    # Store in cache
                    try:
                        if key is not None:
                            inp_est = _estimate_input_tokens(data)
                            out_est = int(len(buffer) / 4)
                            RUN_CACHE[key] = {"bytes": bytes(buffer), "ts": time.time(), "saved_est": inp_est + out_est}
                    except Exception:
                        pass
            except Exception as e:
                payload = {"status": 502, "body": f"proxy_failure: {type(e).__name__}: {e}"}
                yield b"event: ERROR\n" + b"data: " + json.dumps(payload).encode("utf-8") + b"\n\n"

    return StreamingResponse(proxy_stream(), media_type="text/event-stream", headers={"X-AGUI-Cache": "MISS"})


@app.get("/metrics/tokens")
async def token_metrics():
    return {
        "saved_tokens_est": TOKENS_SAVED_EST,
        "used_tokens_reported": TOKENS_USED_REPORTED,
        "cache_entries": len(RUN_CACHE),
        "cache_ttl_secs": CACHE_TTL_SECS,
    }


@app.post("/ingest/upload")
async def ingest_upload(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    kind: str = Form("auto"),
):
    """ Upload a .pdf or .txt policy doc.
    - Extract text
    - Run the compilers (agents) to produce policy JSONs
    - Persist and reload policies
    - Update meta.docName and broadcast a small delta
    """
    filename = file.filename or "uploaded"
    ext = os.path.splitext(filename)[1].lower()
    save_path = DOCS_DIR / filename
    with save_path.open("wb") as f:
        f.write(await file.read())

    if ext == ".pdf":
        text = extract_text_from_pdf(str(save_path))
    elif ext in (".txt",):
        text = save_path.read_text(encoding="utf-8", errors="ignore")
    else:
        return JSONResponse(
            status_code=400, content={"error": "Only .pdf or .txt supported for now"}
        )

    compiled_spend = None
    compiled_deleg = None

    if kind in ("auto", "spend"):
        compiled_spend = compile_spend_policy(text)
        _save_spend_policy(compiled_spend)

    elif kind in ("llm", "auto_llm"):
        compiled_spend = compile_spend_policy_llm(text)  
        if compiled_spend.get("spend_policy"):
            _save_spend_policy({"spend_policy": compiled_spend["spend_policy"]})

    if kind in ("auto", "delegation", "llm", "auto_llm"):
        compiled_deleg = compile_delegation_rules(text)
        _save_delegation_rules(compiled_deleg)

    global SPEND_POLICY, DELEGATION_RULES
    if compiled_spend is not None:
        SPEND_POLICY = _load_spend_policy()
    if compiled_deleg is not None:
        DELEGATION_RULES = _load_delegation_rules()

    citations: List[Dict[str, Any]] = []
    if compiled_spend and "spend_policy" in compiled_spend:
        ev = compiled_spend["spend_policy"].get("evidence") or []
        for row in ev:
            citations.append(
                {"key": row.get("key", "spend"), "snippet": row.get("snippet", "")}
            )
    if compiled_deleg and "delegation" in compiled_deleg:
        ev = compiled_deleg["delegation"].get("evidence") or []
        for row in ev:
            citations.append(
                {"key": row.get("key", "delegation"), "snippet": row.get("snippet", "")}
            )

    async with STATE_LOCK:
        STATE["meta"]["docName"] = filename
        STATE["citations"] = citations

    await broadcast(
        "STATE_DELTA",
        {
            "ops": [
                {
                    "op": "replace" if "docName" in STATE["meta"] else "add",
                    "path": "/meta/docName",
                    "value": filename,
                },
                {
                    "op": "replace" if "citations" in STATE else "add",
                    "path": "/citations",
                    "value": citations,
                },
            ]
        },
    )

    threshold = None
    if compiled_spend:
        try:
            tiers = compiled_spend["spend_policy"]["tiers"]
            threshold = tiers[1]["range"]["min"]
        except Exception:
            threshold = None

    roles = compiled_deleg["delegation"]["roles"] if compiled_deleg else None

    global CURRENT_DOC_ID, DOC_INDEXES
    doc_id = filename
    CURRENT_DOC_ID = doc_id

    chunks = chunk_text_to_paragraphs(text, page_map=[])
    DOC_INDEXES[doc_id] = DocIndex(doc_id=doc_id, chunks=chunks)

    async with STATE_LOCK:
        STATE["meta"]["doc_id"] = doc_id

    await broadcast(
        "STATE_DELTA",
        {
            "ops": [
                {
                    "op": "add" if "doc_id" not in STATE["meta"] else "replace",
                    "path": "/meta/doc_id",
                    "value": doc_id,
                }
            ]
        },
    )

    # --- Auto-create key panels from the uploaded document (Control Calendar, Exceptions) ---
    try:
        # Reuse the doc index for agents
        result_controls = run_control_checklists(doc_id, index, "control calendar")
        result_exceptions = run_exceptions_tracker(doc_id, index, "exceptions")

        auto_patches = (result_controls.get("patches") or []) + (result_exceptions.get("patches") or [])

        if auto_patches:
            try:
                async with STATE_LOCK:
                    base = json.loads(json.dumps(STATE))
                    patched = jsonpatch.apply_patch(base, auto_patches, in_place=False)
                    validated_model = _validate_state(patched)
                    new_state = validated_model.model_dump()
                    new_state["meta"]["server_timestamp"] = time.time()
                    server_op = {"op": "replace", "path": "/meta/server_timestamp", "value": new_state["meta"]["server_timestamp"]}
                    for k in list(STATE.keys()):
                        STATE[k] = new_state[k]
            except Exception as e:
                LAST_ERROR = {"type": "ingest_auto_panels_apply", "detail": str(e), "patches": auto_patches}
            else:
                await broadcast("STATE_DELTA", {"ops": auto_patches + [server_op]})
    except Exception as e:
        # Do not fail upload on agent errors
        LAST_ERROR = {"type": "ingest_auto_panels", "detail": str(e)}

    # Suggest a guided workflow in chat
    try:
        await broadcast(
            "TOOL_RESULT",
            {
                "name": "chat_message",
                "message": (
                    "I analyzed your document. Choose a workflow to begin: Control Calendar, "
                    "Exceptions Tracker, Approval Chain, or Spending Checker."
                ),
            },
        )
        suggestions = [
            {"label": "Open Control Calendar", "kind": "chat", "prompt": "control calendar"},
            {"label": "Open Exceptions Tracker", "kind": "chat", "prompt": "exceptions"},
            {"label": "Open Approval Chain", "kind": "chat", "prompt": "approval chain"},
            {"label": "Spending Checker", "kind": "chat", "prompt": "spending checker"},
            {"label": "Export CSV", "kind": "export"},
        ]
        await broadcast("TOOL_RESULT", {"name": "action_items", "items": suggestions})
    except Exception:
        pass

    return {
        "ok": True,
        "docName": filename,
        "spend_threshold": threshold,
        "roles": roles,
    }


@app.get("/policy/spend")
async def get_spend_policy():
    return SPEND_POLICY


@app.post("/policy/spend/compile")
async def compile_spend(text: Dict[str, str] = Body(...), persist: bool = True):
    raw = text.get("text", "")
    if not raw.strip():
        return JSONResponse(
            status_code=400, content={"error": "Provide 'text' with policy excerpt"}
        )

    compiled = compile_spend_policy(raw)

    if persist:
        _save_spend_policy(compiled)
        global SPEND_POLICY
        SPEND_POLICY = _load_spend_policy()

    return {"ok": True, "compiled": compiled, "persisted": bool(persist)}


@app.post("/policy/spend/reload")
async def reload_spend_policy():
    global SPEND_POLICY
    SPEND_POLICY = _load_spend_policy()
    return {"ok": True}


@app.get("/policy/delegation")
async def get_delegation_rules():
    return DELEGATION_RULES


@app.post("/policy/delegation/reload")
async def reload_delegation_rules():
    global DELEGATION_RULES
    DELEGATION_RULES = _load_delegation_rules()
    return {"ok": True}


class ChatOpenRequest(BaseModel):
    pass


class ChatOpenResponse(BaseModel):
    session_id: str
    doc_id: Optional[str] = None
    greeting: str


@app.post("/chat/open")
async def chat_open(body: ChatOpenRequest):
    session_id = uuid4().hex[:12]
    greeting = (
        "Hi! I’m your Policy Assistant. Ask me for a **Spending Checker**, "
        "**Roles & SoD**, **Approval Checklist**, or **Timeline**—or just type your question."
    )
    return {
        "session_id": session_id,
        "doc_id": STATE.get("meta", {}).get("doc_id"),
        "greeting": greeting,
    }


class ChatAskRequest(BaseModel):
    session_id: str
    prompt: str


# @app.post("/chat/ask")
# async def chat_ask(body: ChatAskRequest):
#     prompt = body.prompt.strip().lower()
#     doc_id = STATE.get("meta", {}).get("doc_id")
#     if not doc_id or doc_id not in DOC_INDEXES:
#         return JSONResponse(status_code=400, content={"error": "No document uploaded yet"})

#     index = DOC_INDEXES[doc_id]
#     # --- add this near the top of chat_ask() ---
#     q = (body.prompt or "").strip().lower()

#     # after q = body.prompt...
#     # def detect_intent(q: str) -> str:
#     #     buckets = {
#     #         "spending": ["spend", "spending", "procurement", "rfp", "threshold"],
#     #         "roles": ["role", "sod", "separation", "cheque signing", "check signing"],
#     #         "controls": ["control", "calendar", "checklist", "travel", "reconcil", "reconciliation", "credit card", "bank"],
#     #         "exceptions": ["exception", "waiver", "sole source", "emergency", "non-competitive", "deviation", "variance"],
#     #     }
#     #     for name, keys in buckets.items():
#     #         if any(k in q for k in keys):
#     #             return name
#     #     return "chat"

#     # ---- Chat intent helper (doc-agnostic) ----
#     def detect_intent(prompt: str) -> str:
#         q = (prompt or "").strip().lower()
#         if not q:
#             return "unknown"
#         if "spend" in q or "procure" in q or "rfp" in q or "threshold" in q or "checker" in q:
#             return "spending"
#         if "roles" in q or "sod" in q or "separation" in q or "delegation" in q or "cheque" in q or "check signing" in q:
#             return "roles_sod"
#         if "approval" in q and ("chain" in q or "workflow" in q or "matrix" in q):
#             return "approval_chain"
#         if "control" in q or "calendar" in q or "checklist" in q or "travel" in q or "reconcil" in q or "credit card" in q or "bank" in q:
#             return "controls"
#         if "exception" in q or "waiver" in q or "sole source" in q or "emergency" in q or "deviation" in q:
#             return "exceptions"
#         return "unknown"


#     intent = detect_intent(q)



#     if any(k in prompt for k in ["spending","procure","rfp"]):
#         result = run_spending_checker(doc_id, index, body.prompt)
#     elif any(k in prompt for k in ["roles","sod","separation","cheque"]):
#         result = run_roles_sod(doc_id, index, body.prompt)
#     elif intent in ("controls", "control calendar", "calendar", "checklists", "travel controls", "reconciliations"):
#         result = run_control_checklists(doc_id, index, body.prompt)
#     elif intent == "exceptions":
#         result = run_exceptions_tracker(doc_id, index, body.prompt)
#     elif any(k in prompt for k in [
#         "approval", "approval chain", "signing authority",
#         "who approves", "signing matrix", "approval matrix"
#     ]):
#         result = run_approval_chain(doc_id, index, body.prompt)
#     else:
#         # default to spending for now
#         result = run_spending_checker(doc_id, index, body.prompt)



#     # Apply patches to state and broadcast (like /agui/patch does)
#     async with STATE_LOCK:
#         base = json.loads(json.dumps(STATE))
#         patched = jsonpatch.apply_patch(base, result["patches"], in_place=False)
#         # validate & commit
#         validated_model = _validate_state(patched)
#         new_state = validated_model.model_dump()
#         # stamp server timestamp
#         new_state["meta"]["server_timestamp"] = time.time()
#         server_op = {
#             "op": "replace",
#             "path": "/meta/server_timestamp",
#             "value": new_state["meta"]["server_timestamp"],
#         }
#         # commit
#         for k in list(STATE.keys()):
#             STATE[k] = new_state[k]
#     await broadcast("STATE_DELTA", {"ops": result["patches"] + [server_op]})
#     # Also send a TOOL_RESULT so chat UI can show assistant message
#     await broadcast(
#         "TOOL_RESULT", {"name": "chat_message", "message": result.get("message", "")}
#     )

#     return {"ok": True}


@app.post("/chat/ask")
async def chat_ask(request: Request):
    """
    AG-UI compliant chat run: accepts RunAgentInput-like payload or {prompt} and streams events
    via the same path as /agui/run. This enables HttpAgent clients to call legacy chat path
    without JSON responses.
    """
    try:
        data = await request.json()
        if not isinstance(data, dict):
            raise ValueError("Body must be a JSON object")
    except Exception as e:
        return JSONResponse(status_code=422, content={"error": f"Invalid JSON: {e}"})

    # Normalize to RunAgentInput
    if "messages" not in data:
        prompt_raw = data.get("prompt") or data.get("message") or data.get("text")
        if not prompt_raw:
            return JSONResponse(status_code=422, content={"error": "Missing 'messages' or 'prompt'"})
        data = {"messages": [{"role": "user", "content": str(prompt_raw)}]}

    # Inject available tools schema
    try:
        tools = []
        for t in TOOLS.values():
            tools.append({
                "name": t.name,
                "description": t.description or t.title,
                "parameters": t.schema or {"type": "object", "properties": {}}
            })
        data.setdefault("tools", tools)
    except Exception:
        pass

    # Forward to AG-UI run proxy (keeps caching/limits)
    port = os.getenv("PORT", "8000")
    run_url = f"http://127.0.0.1:{port}/agui/run"

    async def stream_forward():
        async with httpx.AsyncClient(timeout=None) as client:
            try:
                async with client.stream("POST", run_url, json=data) as resp:
                    if resp.status_code != 200:
                        body = await resp.aread()
                        payload = {"status": resp.status_code, "body": body.decode("utf-8", "ignore")}
                        yield b"event: ERROR\n" + b"data: " + json.dumps(payload).encode("utf-8") + b"\n\n"
                        return
                    async for chunk in resp.aiter_bytes():
                        if chunk:
                            yield chunk
            except Exception as e:
                payload = {"status": 502, "body": f"proxy_failure: {type(e).__name__}: {e}"}
                yield b"event: ERROR\n" + b"data: " + json.dumps(payload).encode("utf-8") + b"\n\n"

    return StreamingResponse(stream_forward(), media_type="text/event-stream")


# ---------- end chat routes ----------


# @app.post("/agui/patch")
# async def apply_patch(patch_req: PatchRequest):
#     global LAST_APPLIED, LAST_ERROR
#     LAST_ERROR = None
#     ops = _normalize_ops([op.model_dump() for op in patch_req.ops])

#     async with STATE_LOCK:
#         current = json.loads(json.dumps(STATE))
#         try:
#             patched = jsonpatch.apply_patch(current, ops, in_place=False)
#         except jsonpatch.JsonPatchException as e:
#             LAST_ERROR = {"type": "patch", "detail": str(e)}
#             return JSONResponse(
#                 status_code=400, content={"error": f"Invalid patch: {str(e)}"}
#             )

#         try:
#             validated_model = _validate_state(patched)
#             validated = validated_model.model_dump()
#         except ValidationError as ve:
#             LAST_ERROR = {"type": "validation", "detail": json.loads(ve.json())}
#             return JSONResponse(
#                 status_code=400,
#                 content={"error": "Validation failed", "details": LAST_ERROR},
#             )

#         extra_ops: List[Dict[str, Any]] = []

#         if _ops_touch_prefix(ops, "/spend/"):
#             derived = derive_requirements(validated["spend"], SPEND_POLICY)
#             validated["spend"]["required_steps"] = derived["required_steps"]
#             extra_ops.append(
#                 {
#                     "op": "replace",
#                     "path": "/spend/required_steps",
#                     "value": derived["required_steps"],
#                 }
#             )

#         if _ops_touch_prefix(ops, "/delegation/") or _ops_touch_prefix(ops, "/spend/"):
#             del_viol = validate_delegation(validated["delegation"], DELEGATION_RULES)
#         else:
#             del_viol = []

#         if _ops_touch_prefix(ops, "/spend/"):
#             spend_viol = derive_requirements(validated["spend"], SPEND_POLICY)[
#                 "violations"
#             ]
#         else:
#             spend_viol = []
        
#         # inside apply_patch, after you compute `validated` and before broadcasting
#         if _ops_touch_prefix(ops, "/panel_configs/"):
#             for o in ops:
#                 path = o.get("path","")
#                 if path.startswith("/panel_configs/") and "/controls/" in path:
#                     try:
#                         panel_id = path.split("/")[2]
#                     except Exception:
#                         continue
#                     cfg = validated["panel_configs"].get(panel_id, {})
#                     ptype = (cfg or {}).get("type")

#                     if ptype == "control_checklists":
#                         updated = evaluate_control_checklists("default_doc", cfg)  # replace with your actual doc_id if you track it
#                         status = {
#                             "travel": updated.get("travel", []),
#                             "bank":   updated.get("bank", []),
#                             "credit": updated.get("credit", [])
#                         }
#                         validated["panel_configs"][panel_id]["data"]["status"] = status
#                         extra_ops.append({
#                             "op": "replace",
#                             "path": f"/panel_configs/{panel_id}/data/status",
#                             "value": status
#                         })


#         all_viol = (spend_viol or []) + (del_viol or [])
#         validated["violations"] = all_viol
#         extra_ops.append({"op": "replace", "path": "/violations", "value": all_viol})

#         # --- Panel config change listener (NEW) ---
#         for o in ops:
#             p = o.get("path", "")
#             if p.startswith("/panel_configs/") and "/controls/" in p:
#                 # identify panel id
#                 try:
#                     parts = p.split("/")
#                     panel_id = parts[2]  # /panel_configs/<panel_id>/controls/...
#                 except Exception:
#                     panel_id = None

#                 if panel_id:
#                     panel_cfg = validated["panel_configs"].get(panel_id) or {}

#                     # Handle spending form panels
#                     # Handle spending form panels
#                     if panel_cfg.get("type") == "form_spending":
#                         doc_id = validated.get("meta", {}).get("doc_id")
#                         if doc_id:
#                             updates = evaluate_spending_controls(doc_id, panel_cfg)
#                             validated["panel_configs"][panel_id]["data"] = (
#                                 validated["panel_configs"][panel_id].get("data") or {}
#                             )
#                             validated["panel_configs"][panel_id]["data"][
#                                 "required_steps"
#                             ] = updates.get("required_steps", [])
#                             extra_ops.append(
#                                 {
#                                     "op": "replace",
#                                     "path": f"/panel_configs/{panel_id}/data/required_steps",
#                                     "value": updates.get("required_steps", []),
#                                 }
#                             )

#                     # Handle Roles & SoD panels
#                     if panel_cfg.get("type") == "roles_sod":
#                         doc_id = validated.get("meta", {}).get("doc_id")
#                         if doc_id:
#                             updates = evaluate_roles_controls(doc_id, panel_cfg)
#                             validated["panel_configs"][panel_id]["data"] = (
#                                 validated["panel_configs"][panel_id].get("data") or {}
#                             )
#                             validated["panel_configs"][panel_id]["data"][
#                                 "violations"
#                             ] = updates.get("violations", [])
#                             extra_ops.append(
#                                 {
#                                     "op": "replace",
#                                     "path": f"/panel_configs/{panel_id}/data/violations",
#                                     "value": updates.get("violations", []),
#                                 }
#                             )

#                     # Handle Approval Chain panels
#                     if panel_cfg.get("type") == "approval_chain":
#                         doc_id = validated.get("meta", {}).get("doc_id")
#                         if doc_id:
#                             updates = evaluate_approval_controls(doc_id, panel_cfg)
#                             validated["panel_configs"][panel_id]["data"] = (
#                                 validated["panel_configs"][panel_id].get("data") or {}
#                             )
#                             validated["panel_configs"][panel_id]["data"]["chain"] = updates.get("chain", [])
#                             extra_ops.append(
#                                 {
#                                     "op": "replace",
#                                     "path": f"/panel_configs/{panel_id}/data/chain",
#                                     "value": updates.get("chain", []),
#                                 }
#                             )

#         # --- end listener ---

#         export_requested = False
#         for o in ops:
#             if (
#                 o.get("path") == "/meta/exportRequested"
#                 and o.get("op") in ("add", "replace")
#                 and o.get("value") is True
#             ):
#                 export_requested = True
#                 break

#         if export_requested:
#             url = _export_csv_from_state(validated)
#             validated["meta"]["last_export_url"] = url
#             validated["meta"]["exportRequested"] = False
#             extra_ops.extend(
#                 [
#                     {
#                         "op": "add"
#                         if "exportRequested" not in current.get("meta", {})
#                         else "replace",
#                         "path": "/meta/exportRequested",
#                         "value": False,
#                     },
#                     {
#                         "op": "replace"
#                         if "last_export_url" in current.get("meta", {})
#                         else "add",
#                         "path": "/meta/last_export_url",
#                         "value": url,
#                     },
#                 ]
#             )

#         validated["meta"]["server_timestamp"] = time.time()
#         server_op = {
#             "op": "replace",
#             "path": "/meta/server_timestamp",
#             "value": validated["meta"]["server_timestamp"],
#         }

#         for k in list(STATE.keys()):
#             STATE[k] = validated[k]

#     delta_ops = ops + extra_ops + [server_op]
#     LAST_APPLIED = delta_ops
#     await broadcast("STATE_DELTA", {"ops": delta_ops})

#     if export_requested:
#         await broadcast(
#             "TOOL_RESULT",
#             {"name": "export_csv", "url": STATE["meta"].get("last_export_url")},
#         )

#     return {"ok": True, "applied": delta_ops}


@app.post("/agui/patch")
async def apply_patch(patch_req: PatchRequest):
    global LAST_APPLIED, LAST_ERROR
    LAST_ERROR = None
    ops = _normalize_ops([op.model_dump() for op in patch_req.ops])

    async with STATE_LOCK:
        current = json.loads(json.dumps(STATE))
        try:
            patched = jsonpatch.apply_patch(current, ops, in_place=False)
        except jsonpatch.JsonPatchException as e:
            LAST_ERROR = {"type": "patch", "detail": str(e)}
            return JSONResponse(status_code=400, content={"error": f"Invalid patch: {str(e)}"})

        try:
            validated_model = _validate_state(patched)
            validated = validated_model.model_dump()
        except ValidationError as ve:
            LAST_ERROR = {"type": "validation", "detail": json.loads(ve.json())}
            return JSONResponse(status_code=400, content={"error": "Validation failed", "details": LAST_ERROR})

        extra_ops: List[Dict[str, Any]] = []

        # --- Spend derived steps + violations when /spend/* changes
        if _ops_touch_prefix(ops, "/spend/"):
            derived = derive_requirements(validated["spend"], SPEND_POLICY)
            validated["spend"]["required_steps"] = derived["required_steps"]
            extra_ops.append({
                "op": "replace",
                "path": "/spend/required_steps",
                "value": derived["required_steps"],
            })

        # --- Delegation + Spend violations summary
        if _ops_touch_prefix(ops, "/delegation/") or _ops_touch_prefix(ops, "/spend/"):
            del_viol = validate_delegation(validated["delegation"], DELEGATION_RULES)
        else:
            del_viol = []
        if _ops_touch_prefix(ops, "/spend/"):
            spend_viol = derive_requirements(validated["spend"], SPEND_POLICY)["violations"]
        else:
            spend_viol = []
        all_viol = (spend_viol or []) + (del_viol or [])
        validated["violations"] = all_viol
        extra_ops.append({"op": "replace", "path": "/violations", "value": all_viol})

        # --- Dynamic panel control listeners (single place for all panels)
        if _ops_touch_prefix(ops, "/panel_configs/"):
            touched_panels: Set[str] = set()
            for o in ops:
                p = o.get("path", "")
                if p.startswith("/panel_configs/") and "/controls/" in p:
                    parts = p.split("/")
                    if len(parts) >= 4:
                        touched_panels.add(parts[2])


            doc_id = validated.get("meta", {}).get("doc_id") or validated.get("meta", {}).get("docName", "default")


            for panel_id in touched_panels:
                panel_cfg = validated["panel_configs"].get(panel_id) or {}
                ptype = panel_cfg.get("type")

                if ptype == "form_spending":
                    updates = evaluate_spending_controls(doc_id, panel_cfg)
                    validated["panel_configs"][panel_id].setdefault("data", {})
                    validated["panel_configs"][panel_id]["data"]["required_steps"] = updates.get("required_steps", [])
                    extra_ops.append({
                        "op": "replace",
                        "path": f"/panel_configs/{panel_id}/data/required_steps",
                        "value": updates.get("required_steps", []),
                    })

                elif ptype == "roles_sod":
                    updates = evaluate_roles_controls(doc_id, panel_cfg)
                    validated["panel_configs"][panel_id].setdefault("data", {})
                    validated["panel_configs"][panel_id]["data"]["violations"] = updates.get("violations", [])
                    extra_ops.append({
                        "op": "replace",
                        "path": f"/panel_configs/{panel_id}/data/violations",
                        "value": updates.get("violations", []),
                    })

                elif ptype == "control_checklists":
                    updates = evaluate_control_checklists(doc_id, panel_cfg)
                    status = {
                        "travel": updates.get("travel", []),
                        "bank":   updates.get("bank", []),
                        "credit": updates.get("credit", []),
                    }
                    validated["panel_configs"][panel_id].setdefault("data", {})
                    validated["panel_configs"][panel_id]["data"]["status"] = status
                    extra_ops.append({
                        "op": "replace",
                        "path": f"/panel_configs/{panel_id}/data/status",
                        "value": status,
                    })

                elif ptype == "exceptions_tracker":
                    updates = evaluate_exceptions_controls(doc_id, panel_cfg)
                    validated["panel_configs"][panel_id].setdefault("data", {})
                    validated["panel_configs"][panel_id]["data"]["status"] = updates.get("status", {"approvals":[],"documentation":[],"reporting":[]})
                    extra_ops.append({
                        "op": "replace",
                        "path": f"/panel_configs/{panel_id}/data/status",
                        "value": updates.get("status", {"approvals":[],"documentation":[],"reporting":[]}),
                    })

                elif ptype == "approval_chain":
                    updates = evaluate_approval_controls(doc_id, panel_cfg)
                    validated["panel_configs"][panel_id].setdefault("data", {})
                    validated["panel_configs"][panel_id]["data"]["chain"] = updates.get("chain", [])
                    extra_ops.append({
                        "op": "replace",
                        "path": f"/panel_configs/{panel_id}/data/chain",
                        "value": updates.get("chain", []),
                    })




        # --- Export CSV tool
        export_requested = False
        for o in ops:
            if (
                o.get("path") == "/meta/exportRequested"
                and o.get("op") in ("add", "replace")
                and o.get("value") is True
            ):
                export_requested = True
                break

        if export_requested:
            url = _export_csv_from_state(validated)
            validated["meta"]["last_export_url"] = url
            validated["meta"]["exportRequested"] = False
            extra_ops.extend([
                {
                    "op": "add" if "exportRequested" not in current.get("meta", {}) else "replace",
                    "path": "/meta/exportRequested",
                    "value": False,
                },
                {
                    "op": "replace" if "last_export_url" in current.get("meta", {}) else "add",
                    "path": "/meta/last_export_url",
                    "value": url,
                },
            ])

        # --- Server timestamp + commit
        validated["meta"]["server_timestamp"] = time.time()
        server_op = {"op": "replace", "path": "/meta/server_timestamp", "value": validated["meta"]["server_timestamp"]}

        for k in list(STATE.keys()):
            STATE[k] = validated[k]

    delta_ops = ops + extra_ops + [server_op]
    LAST_APPLIED = delta_ops
    await broadcast("STATE_DELTA", {"ops": delta_ops})

    if export_requested:
        await broadcast("TOOL_RESULT", {"name": "export_csv", "url": STATE["meta"].get("last_export_url")})

    return {"ok": True, "applied": delta_ops}
