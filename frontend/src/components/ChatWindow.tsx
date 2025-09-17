import React, { useEffect, useRef, useState } from "react";
import { BASE_URL } from "../agui/bridge";
import { Card, Form, InputGroup, Button, Badge } from "react-bootstrap";

type ChatMsg = { role: "assistant" | "user"; text: string };

export default function ChatWindow() {
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role: "assistant", text: "Hi! I’m your Policy Assistant. Ask for a Spending Checker, Roles & SoD, Approval Chain, Control Calendar, or Exceptions — or ask a question about the document." }
  ]);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

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
    return () => {
      try { if (w.__onChatMessage) delete w.__onChatMessage; } catch {}
      try { if (w.__onUserPrompt) delete w.__onUserPrompt; } catch {}
    };
  }, []);

  async function send(q: string) {
    if (!q.trim()) return;
    setMsgs((m) => [...m, { role: "user", text: q }]);

    try {
      const res = await fetch(`${BASE_URL}/chat/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: q })
      });
      const data = await res.json();
      const reply = data?.message || "Okay — I’ve updated the panels.";
      setMsgs((m) => [...m, { role: "assistant", text: reply }]);
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
