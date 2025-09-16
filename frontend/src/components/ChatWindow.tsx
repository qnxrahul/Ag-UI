import React, { useEffect, useRef, useState } from "react";
import { BASE_URL } from "../agui/bridge";

type ChatMsg = { role: "assistant" | "user"; text: string };

export default function ChatWindow({ onRun }: { onRun: (prompt: string) => void }) {
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
    <div className="card chat">
      <div className="panel-card-title">Conversational Assistant</div>
      <div ref={listRef} className="chat-log">
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>{m.text}</div>
        ))}
      </div>
      <div className="chat-input">
        <input
          className="input"
          placeholder="Type a request… e.g., “spending checker”"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => (e.key === "Enter" ? (send(input), setInput("")) : null)}
        />
        <button className="btn primary" onClick={() => (send(input), setInput(""))}>Send</button>
      </div>
    </div>
  );
}
