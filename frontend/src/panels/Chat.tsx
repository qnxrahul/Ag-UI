import React, { useEffect, useRef, useState } from "react";
import type { AppState, PatchOp } from "../state/types";
import { AguiClient } from "../agui/bridge";

type ChatMsg = { role: "assistant" | "user"; content: string };

export default function Chat(
  props: { client: AguiClient | null }
) {
  const { client } = props;
  const [session, setSession] = useState<{ session_id: string; doc_id?: string | null } | null>(null);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    (window as any).__onChatMessage = (text: string) => {
      setMsgs(prev => [...prev, { role: "assistant", content: text }]);
    };
  }, []);

  useEffect(() => {
    (async () => {
      if (!client) return;
      const res = await client.chatOpen();
      setSession({ session_id: res.session_id, doc_id: res.doc_id });
      setMsgs([{ role:"assistant", content: res.greeting }]);
    })();
  }, [client]);

  const send = async () => {
    if (!client || !session || !input.trim()) return;
    const text = input.trim();
    setMsgs(prev => [...prev, { role:"user", content: text }]);
    setInput("");
    await client.chatAsk(session.session_id, text);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", gap:12 }}>
      <div style={{ flex:1, overflow:"auto", border:"1px solid #eee", borderRadius:8, padding:12, background:"#fff" }}>
        {msgs.map((m, i) => (
          <div key={i} style={{
            padding:"8px 10px", borderRadius:8, marginBottom:8,
            background: m.role === "assistant" ? "#eef6ff" : "#f7f7f7",
            border: "1px solid " + (m.role === "assistant" ? "#cde3ff" : "#ddd")
          }}>
            <div style={{ fontWeight:600, fontSize:12, color:"#555", marginBottom:4 }}>
              {m.role === "assistant" ? "Assistant" : "You"}
            </div>
            <div style={{ whiteSpace:"pre-wrap" }}>{m.content}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <input value={input} onChange={(e)=>setInput(e.target.value)} placeholder="Ask for 'Spending Checker'..."
               onKeyDown={(e)=>{ if (e.key === "Enter") send(); }}
               style={{ flex:1, padding:10, border:"1px solid #ccc", borderRadius:8 }}/>
        <button onClick={send} style={{ padding:"10px 14px", borderRadius:8, border:"1px solid #ccc", background:"#f7f7f7", cursor:"pointer" }}>
          Send
        </button>
      </div>
      <div style={{ fontSize:12, color:"#666" }}>
        Tip: Try “Spending checker” to create the interactive panel on the right.
      </div>
    </div>
  );
}
