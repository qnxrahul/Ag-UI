from __future__ import annotations
from typing import TypedDict, List, Dict, Any

try:
    from langgraph.graph import StateGraph, START, END
except Exception:  # pragma: no cover
    StateGraph = None  # type: ignore
    START = END = None  # type: ignore

from ..app import (
    STATE, STATE_LOCK, DOC_INDEXES, detect_intent, broadcast,
)
from ..agents.spending_checker import run_spending_checker
from ..agents.approval_chain import run_approval_chain
from ..agents.roles_sod import run_roles_sod
from ..agents.exceptions_tracker import run_exceptions_tracker
import json, time
import jsonpatch


class Message(TypedDict):
    role: str
    content: str


class GraphState(TypedDict, total=False):
    messages: List[Message]


def _apply_patches(patches: List[Dict[str, Any]]) -> None:
    from ..app import _validate_state
    try:
        import asyncio
    except Exception:
        asyncio = None

    base = json.loads(json.dumps(STATE))
    patched = jsonpatch.apply_patch(base, patches, in_place=False)
    validated = _validate_state(patched).model_dump()
    validated["meta"]["server_timestamp"] = time.time()
    server_op = {"op": "replace", "path": "/meta/server_timestamp", "value": validated["meta"]["server_timestamp"]}
    for k in list(STATE.keys()):
        STATE[k] = validated[k]
    # Broadcast delta
    from ..app import asyncio as _asyncio  # reuse same loop
    async def _go():
        await broadcast("STATE_DELTA", {"ops": patches + [server_op]})
    try:
        loop = _asyncio.get_event_loop()
        if loop.is_running():
            _asyncio.create_task(_go())
        else:
            loop.run_until_complete(_go())
    except Exception:
        pass


def _route_and_apply(state: GraphState) -> GraphState:
    msgs = state.get("messages") or []
    last = ""
    for m in reversed(msgs):
        if (m.get("role") or "").lower() == "user":
            last = (m.get("content") or "").strip()
            break
    intent = detect_intent(last)

    doc_id = (STATE.get("meta", {}) or {}).get("doc_id")
    if not doc_id or doc_id not in DOC_INDEXES:
        # Append assistant notice
        out = list(msgs)
        out.append({"role": "assistant", "content": "Please upload a document first."})
        return {"messages": out}

    index = DOC_INDEXES[doc_id]

    if intent == "spending":
        result = run_spending_checker(doc_id, index, last)
    elif intent == "roles_sod":
        result = run_roles_sod(doc_id, index, last)
    elif intent == "approval_chain":
        result = run_approval_chain(doc_id, index, last)
    elif intent == "controls":
        from ..agents.control_checklists import run_control_checklists
        result = run_control_checklists(doc_id, index, last)
    elif intent == "exceptions":
        result = run_exceptions_tracker(doc_id, index, last)
    else:
        result = run_spending_checker(doc_id, index, last)

    patches = result.get("patches") or []
    if patches:
        try:
            import asyncio as _a
            async def _apply():
                async with STATE_LOCK:
                    _apply_patches(patches)
            loop = _a.get_event_loop()
            if loop.is_running():
                loop.create_task(_apply())
            else:
                loop.run_until_complete(_apply())
        except Exception:
            pass

    out = list(msgs)
    if result.get("message"):
        out.append({"role": "assistant", "content": result.get("message")})
    return {"messages": out}


def build_graph():
    if StateGraph is None:
        return None
    g = StateGraph(GraphState)
    g.add_node("route_apply", _route_and_apply)
    g.add_edge(START, "route_apply")
    g.add_edge("route_apply", END)
    return g.compile()

