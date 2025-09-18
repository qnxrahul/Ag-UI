import { BASE_URL } from "./bridge";
import { HttpAgent } from "@ag-ui/client";

export type ToolDef = {
  name: string;
  description: string;
  parameters: { type: "object"; properties: Record<string, any>; required?: string[] };
};

export type ContextItem = { role: string; content: string };

export type RunAgentInput = {
  runId?: string;
  messages: Array<{ role: string; content: string }>;
  tools?: ToolDef[];
  context?: ContextItem[];
  forwardedProps?: Record<string, any>;
};

export type AguiEvent = { event: string; data?: any };

export async function runWithHttpAgent(
  input: RunAgentInput,
  onEvent: (ev: AguiEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const raw = (import.meta as any).env?.VITE_AGENT_URL;
  const endpoint = (typeof raw === "string" && raw.trim()) ? raw.trim() : `${BASE_URL}/agent`;
  const H: any = (HttpAgent as unknown as any);
  let agent: any;
  try { agent = new H({ baseUrl: endpoint }); }
  catch { try { agent = new H({ endpoint }); }
  catch { agent = new H(endpoint); } }
  const uuid = () => (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
  const getThreadId = () => {
    try {
      const k = "agui_thread_id";
      let v = localStorage.getItem(k);
      if (!v) { v = uuid(); localStorage.setItem(k, v); }
      return v;
    } catch { return uuid(); }
  };
  const normalized = {
    threadId: getThreadId(),
    runId: input.runId || uuid(),
    messages: (input.messages || []).map((m) => ({ id: uuid(), role: m.role as any, content: m.content, name: undefined })),
    tools: input.tools || [],
    context: input.context || [],
    forwardedProps: input.forwardedProps,
  } as any;
  const stream: any = agent.run(normalized);

  await new Promise<void>((resolve, reject) => {
    let subscription: any;
    const handleAbort = () => {
      try { subscription?.unsubscribe?.(); } catch {}
      resolve();
    };
    if (signal) {
      if (signal.aborted) return resolve();
      signal.addEventListener("abort", handleAbort, { once: true } as any);
    }

    const cleanup = () => {
      try { if (signal) signal.removeEventListener("abort", handleAbort as any); } catch {}
    };

    try {
      if (stream && typeof stream[Symbol.asyncIterator] === "function") {
        (async () => {
          try {
            for await (const ev of stream) {
              if (ev && typeof onEvent === "function") onEvent(ev as any);
            }
            cleanup();
            resolve();
          } catch (e) {
            cleanup();
            reject(e);
          }
        })();
      } else if (stream && typeof stream.subscribe === "function") {
        subscription = stream.subscribe({
          next: (ev: any) => { if (ev && typeof onEvent === "function") onEvent(ev); },
          error: (err: any) => { cleanup(); reject(err); },
          complete: () => { cleanup(); resolve(); },
        });
      } else {
        cleanup();
        resolve();
      }
    } catch (e) {
      cleanup();
      reject(e);
    }
  });
}

