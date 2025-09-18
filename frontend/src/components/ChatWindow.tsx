import React, { useEffect, useRef, useState } from "react";
import * as AdaptiveCards from "adaptivecards";
import { BASE_URL, runViaBackend } from "../agui/bridge";
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
      const controller = new AbortController();
      const res = await runViaBackend({ messages: [{ role: "user", content: q }] }, controller.signal);
      if (!res.ok) throw new Error(await res.text());
      // Consume SSE-style stream and surface assistant chat_message events
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
              }
            } catch {}
          }
        }
      }
      // Fallback message if nothing streamed
      setMsgs((m) => (m[m.length - 1]?.role === "assistant" ? m : [...m, { role: "assistant", text: "Okay — processed via LangGraph." }]));
    } catch {
      setMsgs((m) => [...m, { role: "assistant", text: "Sorry — I couldn’t reach the server." }]);
    }
  }

  return (
    <Card className="shadow-sm" style={{ background: "#ffffff" }}>
      <Card.Header className="d-flex align-items-center gap-2" style={{ background: "#ffffff" }}>
        <span>Conversational Assistant</span>
        <Badge bg="secondary">Beta</Badge>
      </Card.Header>
      <Card.Body ref={listRef as any} className="chat-panel">
        <div className="chat-bubbles">
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
