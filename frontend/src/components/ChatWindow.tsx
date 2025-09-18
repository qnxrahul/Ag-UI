import React, { useEffect, useRef, useState } from "react";
import * as AdaptiveCards from "adaptivecards";
import { BASE_URL, runViaBackend, getTokenMetrics } from "../agui/bridge";
import { runWithHttpAgent } from "../agui/httpAgent";
import type { ToolDef } from "../agui/httpAgent";
import { Card, Form, InputGroup, Button, Badge } from "react-bootstrap";

type ChatMsg = { role: "assistant" | "user"; text: string };
type ActionItem = { label: string; kind: "chat" | "export" | "main"; prompt?: string };

export default function ChatWindow() {
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role: "assistant", text: "Hi! I’m your Policy Assistant. Ask for a Spending Checker, Roles & SoD, Approval Chain, Control Calendar, or Exceptions — or ask a question about the document." }
  ]);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const initialActionsRef = useRef<ActionItem[] | null>(null);
  const [flow, setFlow] = useState<{ name: null | "spending"; step?: string; data?: any }>({ name: null });
  const [loading, setLoading] = useState(false);
  const [lastTokenInfo, setLastTokenInfo] = useState<{ cache: string; savedEst?: number } | null>(null);
  const [totals, setTotals] = useState<{ saved?: number; used?: number } | null>(null);

  async function fetchState() {
    try {
      const res = await fetch(`${BASE_URL}/agui/state`);
      return await res.json();
    } catch {
      return null;
    }
  }

  async function ensureSpendingPanel(): Promise<string | null> {
    // Try to find an existing spending panel; else create via chat and poll
    const findPanelId = (s: any) => {
      const cfgs = (s?.panel_configs) || {};
      for (const pid of Object.keys(cfgs)) {
        if (cfgs[pid]?.type === "form_spending") return pid;
      }
      return null;
    };
    let st = await fetchState();
    let pid = findPanelId(st);
    if (pid) return pid;
    try {
      await runViaBackend({ messages: [{ role: "user", content: "spending checker" }] });
    } catch {}
    // poll up to ~2s
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 250));
      st = await fetchState();
      pid = findPanelId(st);
      if (pid) return pid;
    }
    return null;
  }

  async function patchOps(ops: any[]) {
    try {
      await fetch(`${BASE_URL}/agui/patch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops })
      });
    } catch {}
  }

  async function submitSpendingFlow() {
    const amount = flow?.data?.amount;
    const category = flow?.data?.category || null;
    const pid = await ensureSpendingPanel();
    if (!pid) return;
    const ops: any[] = [];
    if (amount !== undefined) ops.push({ op: "add", path: `/panel_configs/${pid}/controls/amount`, value: amount === null || amount === "" ? null : Number(amount) });
    ops.push({ op: "add", path: `/panel_configs/${pid}/controls/category`, value: category });
    if (ops.length) await patchOps(ops);
    setMsgs((m) => [...m, { role: "assistant", text: "Spending panel updated with your inputs." }]);
    setFlow({ name: null });
  }

  useEffect(() => {
    fetch(`${BASE_URL}/chat/open`, { method: "POST" }).catch(() => {});
    // Fetch token totals on mount and every 10s
    let alive = true;
    const tick = async () => {
      const metrics = await getTokenMetrics();
      if (metrics && alive) {
        setTotals({ saved: metrics.saved_tokens_est, used: metrics.used_tokens_reported });
      }
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  // Bridge SSE TOOL_RESULT and external prompts into this chat window
  useEffect(() => {
    const w = window as any;
    w.__onChatMessage = (text: string) => {
      setMsgs((m: ChatMsg[]) => [...m, { role: "assistant", text }]);
    };
    w.__onUserPrompt = (text: string) => {
      if (!text) return;
      setMsgs((m: ChatMsg[]) => [...m, { role: "user", text }]);
    };
    w.__onActionItems = (items: Array<{ label: string; kind: string; prompt?: string }>) => {
      const parsed: ActionItem[] = items.map((x) => ({ label: x.label, kind: (x.kind as any) || "chat", prompt: x.prompt }));
      setActions(parsed);
      if (!initialActionsRef.current) initialActionsRef.current = parsed;
      setMsgs((m: ChatMsg[]) => [...m, { role: "assistant", text: "Here are some quick actions you can take:" }]);
      try {
        const card = new AdaptiveCards.AdaptiveCard();
        card.version = new AdaptiveCards.Version(1, 5);
        card.hostConfig = new AdaptiveCards.HostConfig({
          spacing: { padding: 8 },
          containerStyles: {
            default: { backgroundColor: "#FFFFFF" },
            emphasis: { backgroundColor: "#F2F8FF" }
          }
        } as any);
        card.onExecuteAction = async (action: any) => {
          const data = (action as any).data || {};
          const kind = data.kind as string;
          const prompt = data.prompt as string | undefined;
          if (kind === "chat" && prompt) {
            (window as any).__onUserPrompt?.(data.label || prompt);
            try {
              await runViaBackend({ messages: [{ role: "user", content: prompt }] });
            } catch {}
          } else if (kind === "export") {
            try {
              await fetch(`${BASE_URL}/agui/patch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ops: [{ op: "add", path: "/meta/exportRequested", value: true }] })
              });
            } catch {}
          }
        };

        const actionsJson = items.map((it) => ({
          type: "Action.Submit",
          title: it.label,
          data: { kind: it.kind, prompt: it.prompt, label: it.label }
        }));

        card.parse({
          type: "AdaptiveCard",
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          version: "1.5",
          body: [
            { type: "TextBlock", text: "Quick Actions", weight: "Bolder", size: "Medium" },
            { type: "Container", items: [ { type: "TextBlock", text: "Choose an option below:", isSubtle: true, wrap: true } ], style: "default" }
          ],
          actions: actionsJson
        } as any);

        const rendered = card.render();
        const host = listRef.current;
        if (host && rendered) {
          const wrap = document.createElement("div");
          wrap.style.marginTop = "6px";
          wrap.appendChild(rendered);
          host.appendChild(wrap);
          host.scrollTo({ top: host.scrollHeight, behavior: "smooth" });
        }
      } catch {}
    };

    // Optional: handle AG-UI structured cards (ui_card)
    w.__onUiCard = (cardJson: any) => {
      try {
        const card = new AdaptiveCards.AdaptiveCard();
        card.version = new AdaptiveCards.Version(1, 5);
        card.onExecuteAction = async (action: any) => {
          const data = (action as any).data || {};
          if (data?.patch && Array.isArray(data.patch)) {
            try {
              await fetch(`${BASE_URL}/agui/patch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ops: data.patch })
              });
            } catch {}
          } else if (typeof data?.prompt === "string") {
            try {
              await runViaBackend({ messages: [{ role: "user", content: data.prompt }] });
            } catch {}
          }
        };
        card.parse(cardJson);
        const rendered = card.render();
        const host = listRef.current;
        if (host && rendered) {
          const wrap = document.createElement("div");
          wrap.style.marginTop = "6px";
          host.appendChild(wrap);
          wrap.appendChild(rendered);
          host.scrollTo({ top: host.scrollHeight, behavior: "smooth" });
        }
      } catch {}
    };
    return () => {
      try { if (w.__onChatMessage) delete w.__onChatMessage; } catch {}
      try { if (w.__onUserPrompt) delete w.__onUserPrompt; } catch {}
      try { if (w.__onActionItems) delete w.__onActionItems; } catch {}
    };
  }, []);

  async function send(q: string) {
    if (!q.trim()) return;
    setMsgs((m) => [...m, { role: "user", text: q }]);

    try {
      setLoading(true);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      let sawAssistant = false;
      let usedHttpAgent = false;
      try {
        // Prefer AG-UI HttpAgent when available
        const tools: ToolDef[] = [
          { name: "panel.patch", description: "Apply JSON Patch", parameters: { type: "object", properties: { ops: { type: "array" } }, required: ["ops"] } },
          { name: "export.csv", description: "Export CSV", parameters: { type: "object", properties: {} } },
          { name: "open.panel", description: "Open panel", parameters: { type: "object", properties: { type: { type: "string" } }, required: ["type"] } },
        ];
        await runWithHttpAgent(
          { runId: crypto.randomUUID(), messages: [{ role: "user", content: q }], tools },
          (ev) => {
            try {
              if ((ev as any)?.name === "chat_message" && (ev as any)?.message) {
                setMsgs((m) => [...m, { role: "assistant", text: (ev as any).message }]);
                sawAssistant = true;
              }
            } catch {}
          },
          controller.signal
        );
        usedHttpAgent = true;
      } catch {
        // Fallback to plain fetch proxy
        const res = await runViaBackend({ messages: [{ role: "user", content: q }] }, controller.signal);
        const cacheHdr = res.headers.get("X-AGUI-Cache") || "";
        const savedHdr = res.headers.get("X-AGUI-Saved-Est") || undefined;
        if (cacheHdr) setLastTokenInfo({ cache: cacheHdr, savedEst: savedHdr ? Number(savedHdr) : undefined });
        if (!res.ok) throw new Error(await res.text());
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (reader) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";
          for (const evt of parts) {
            const lines = evt.split("\n");
            let eventName = "message";
            let dataLine = "";
            for (const line of lines) {
              if (line.startsWith("event:")) eventName = line.slice(6).trim();
              if (line.startsWith("data:")) dataLine += line.slice(5).trim();
            }
            if (eventName && dataLine) {
              try {
                const payload = JSON.parse(dataLine);
                if (payload?.name === "chat_message" && payload?.message) {
                  setMsgs((m) => [...m, { role: "assistant", text: payload.message }]);
                  sawAssistant = true;
                }
              } catch {}
            }
          }
        }
      }
      clearTimeout(timeout);
      // Fallback message if nothing streamed
      setMsgs((m) => (sawAssistant || m[m.length - 1]?.role === "assistant" ? m : [...m, { role: "assistant", text: "Okay — processed via LangGraph." }]));

      // If no state change for spending prompt, fallback to local agent endpoint to create panels
      if (/spend/i.test(q)) {
        try {
          const st = await fetchState();
          const hasSpending = !!Object.values(st?.panel_configs || {}).find((cfg: any) => cfg?.type === "form_spending");
          if (!hasSpending) {
            await fetch(`${BASE_URL}/chat/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: q }) });
          }
        } catch {}
      }
    } catch {
      setMsgs((m) => [...m, { role: "assistant", text: "Sorry — I couldn’t reach the server." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="shadow-sm" style={{ background: "#ffffff" }}>
      <Card.Header className="d-flex align-items-center gap-2" style={{ background: "#ffffff" }}>
        <span>Conversational Assistant</span>
        <Badge bg="secondary">Beta</Badge>
        {lastTokenInfo && (
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#555" }}>
            Cache: {lastTokenInfo.cache}
            {typeof lastTokenInfo.savedEst === "number" && ` · Saved est: ${Math.max(0, Math.floor(lastTokenInfo.savedEst || 0)).toLocaleString()} tok`}
          </span>
        )}
        {totals && (
          <span style={{ marginLeft: 12, fontSize: 12, color: "#555" }}>
            Total saved est: {(Math.floor(totals.saved || 0)).toLocaleString()} · Total used reported: {(Math.floor(totals.used || 0)).toLocaleString()}
          </span>
        )}
      </Card.Header>
      <Card.Body ref={listRef as any} className="chat-panel">
        <div className="chat-bubbles">
          {loading && (
            <div className="bubble bubble-assistant" style={{ opacity: 0.8 }}>
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" /> Processing…
            </div>
          )}
          {msgs.map((m: ChatMsg, i: number) => (
            <div key={i} className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-assistant"}`}>
              {m.text}
            </div>
          ))}
          {actions.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {actions.map((it, i) => (
                <button
                  key={`${it.label}-${i}`}
                  className="btn btn-sm btn-glow"
                  onClick={async () => {
                    if (it.kind === "chat" && it.prompt) {
                      (window as any).__onUserPrompt?.(it.label);
                      try {
                        await runViaBackend({ messages: [{ role: "user", content: it.prompt }] });
                      } catch {}
                      // simple workflow branching
                      if (/spending checker/i.test(it.label)) {
                        setFlow({ name: "spending", step: "input", data: {} });
                        setActions([
                          { label: "Submit Spending Inputs", kind: "main" },
                          { label: "Back to main", kind: "main" },
                        ]);
                      } else if (/control calendar/i.test(it.label)) {
                        setActions([
                          { label: "Open Exceptions Tracker", kind: "chat", prompt: "exceptions" },
                          { label: "Open Approval Chain", kind: "chat", prompt: "approval chain" },
                          { label: "Back to main", kind: "main" },
                        ]);
                      } else if (/exceptions/i.test(it.label)) {
                        setActions([
                          { label: "Open Control Calendar", kind: "chat", prompt: "control calendar" },
                          { label: "Open Spending Checker", kind: "chat", prompt: "spending checker" },
                          { label: "Back to main", kind: "main" },
                        ]);
                      } else if (/approval chain/i.test(it.label)) {
                        setActions([
                          { label: "Open Spending Checker", kind: "chat", prompt: "spending checker" },
                          { label: "Open Control Calendar", kind: "chat", prompt: "control calendar" },
                          { label: "Back to main", kind: "main" },
                        ]);
                      } else {
                        setActions(initialActionsRef.current || []);
                      }
                    } else if (it.kind === "export") {
                      try {
                        await fetch(`${BASE_URL}/agui/patch`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ ops: [{ op: "add", path: "/meta/exportRequested", value: true }] })
                        });
                      } catch {}
                      setActions(initialActionsRef.current || []);
                    } else if (it.kind === "main") {
                      setActions(initialActionsRef.current || []);
                    }
                  }}
                >
                  {it.label}
                </button>
              ))}
            </div>
          )}
          {flow.name === "spending" && flow.step === "input" && (
            <div className="bubble bubble-assistant" style={{ display:"grid", gap: 8 }}>
              <div style={{ fontWeight: 600 }}>Spending inputs</div>
              <label style={{ display:"grid", gap: 4 }}>
                <span style={{ fontSize: 12 }}>Amount</span>
                <input
                  type="number"
                  placeholder="e.g., 18000"
                  value={flow.data?.amount ?? ""}
                  onChange={(e) => setFlow((f: any) => ({ ...f, data: { ...(f?.data||{}), amount: e.target.value } }))}
                  style={{ padding: 6, border: "1px solid #c7d2fe", borderRadius: 8 }}
                />
              </label>
              <label style={{ display:"grid", gap: 4 }}>
                <span style={{ fontSize: 12 }}>Category (optional)</span>
                <select
                  value={flow.data?.category ?? ""}
                  onChange={(e) => setFlow((f: any) => ({ ...f, data: { ...(f?.data||{}), category: e.target.value || null } }))}
                  style={{ padding: 6, border: "1px solid #c7d2fe", borderRadius: 8 }}
                >
                  <option value="">(none)</option>
                  <option value="ops">ops</option>
                  <option value="asset">asset</option>
                  <option value="program">program</option>
                </select>
              </label>
              <div style={{ display:"flex", gap: 8 }}>
                <button className="btn btn-sm btn-glow" onClick={submitSpendingFlow}>Submit</button>
                <button className="btn btn-sm btn-glow" onClick={() => setFlow({ name: null })}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </Card.Body>
      <Card.Footer>
        <InputGroup>
          <Form.Control
            placeholder="Type a request… e.g., “spending checker”"
            value={input}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => (e.key === "Enter" ? (send(input), setInput("")) : null)}
          />
          <Button onClick={() => (send(input), setInput(""))}>Send</Button>
        </InputGroup>
      </Card.Footer>
    </Card>
  );
}
