import { applyPatch } from "fast-json-patch";
import type { AppState, PatchOp } from "../state/types";

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

type SnapshotEvent = { state: AppState; ts: number };
type DeltaEvent = { ops: PatchOp[] };

export class AguiClient {
  private es?: EventSource;
  private state: AppState | null = null;
  private onChange: (s: AppState) => void;

  constructor(onChange: (s: AppState) => void) {
    this.onChange = onChange;
  }

  connect() {
    if (this.es) return;
    this.es = new EventSource(`${BASE_URL}/agui/stream`);

    this.es.addEventListener("RUN_STARTED", () => {
    });

    this.es.addEventListener("STATE_SNAPSHOT", (e: MessageEvent) => {
      const payload = JSON.parse(e.data) as SnapshotEvent;
      this.state = payload.state;
      this.onChange(this.state);
    });

    this.es.addEventListener("STATE_DELTA", (e: MessageEvent) => {
      const payload = JSON.parse(e.data) as DeltaEvent;
      if (!this.state) return;
      const base = JSON.parse(JSON.stringify(this.state));
      const next = applyPatch(base, payload.ops, false, false).newDocument;
      this.state = next;
      this.onChange(this.state);
    });

    this.es.addEventListener("TOOL_RESULT", (e: MessageEvent) => {
      const payload = JSON.parse(e.data);
      console.log("TOOL_RESULT", payload);
      if (payload?.name === "chat_message" && (window as any).__onChatMessage) {
        (window as any).__onChatMessage(payload.message || "");
      }
    });


    this.es.addEventListener("HEARTBEAT", () => {
    });

    this.es.onerror = (err) => {
      console.error("SSE error", err);
    };
  }

  disconnect() {
    if (this.es) {
      this.es.close();
      this.es = undefined;
    }
  }

  getState() {
    return this.state;
  }

    async sendPatch(ops: PatchOp[]) {
    if (this.state) {
      const base = JSON.parse(JSON.stringify(this.state));
      const next = applyPatch(base, ops, false, false).newDocument as AppState;
      this.state = next;
      this.onChange(this.state);
    }

    const res = await fetch(`${BASE_URL}/agui/patch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ops }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("patch failed:", text);
      throw new Error(`patch failed: ${text}`);
    }
    return res.json();
  }

  async reset(panels: string[]) {
    const res = await fetch(`${BASE_URL}/agui/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panels }),
    });
    if (!res.ok) throw new Error("reset failed");
    return res.json();
  }

    async chatOpen() {
    const res = await fetch(`${BASE_URL}/chat/open`, { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify({}) });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); 
  }

  async chatAsk(session_id: string, prompt: string) {
    const res = await fetch(`${BASE_URL}/chat/ask`, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ session_id, prompt })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async exportCsv() {
    return this.sendPatch([{ op: "add", path: "/meta/exportRequested", value: true }]);
  }
}

export { BASE_URL };

// Lightweight REST helpers for context management
export const ContextAPI = {
  listSources: async (): Promise<{ enterprise: string[]; customer: string[]; merged: boolean }> => {
    const res = await fetch(`${BASE_URL}/context/sources`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  merge: async (payload: { include_enterprise: boolean; include_customer: boolean; name?: string }) => {
    const res = await fetch(`${BASE_URL}/context/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        include_enterprise: payload.include_enterprise,
        include_customer: payload.include_customer,
        name: payload.name || "merged",
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
