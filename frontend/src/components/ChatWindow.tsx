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
    <Card className="shadow-sm sticky-panel" style={{ background: "#ffffff" }}>
      <Card.Header className="d-flex align-items-center gap-2" style={{ background: "#ffffff" }}>
        <span>Conversational Assistant</span>
        <Badge bg="secondary">Beta</Badge>
      </Card.Header>
      <Card.Body ref={listRef as any}>
        {msgs.map((m: ChatMsg, i: number) => (
          <div key={i} className={`mb-2 ${m.role === "user" ? "text-end" : "text-start"}`}>
            <span className={`badge ${m.role === "user" ? "bg-primary" : "bg-light text-dark"}`}>
              {m.text}
            </span>
          </div>
        ))}
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
