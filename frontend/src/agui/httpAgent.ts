import { BASE_URL } from "./bridge";

export type RunInput = { messages: Array<{ role: string; content: string }>; context?: any };

export type AguiEvent = { event: string; data?: any };

export async function runWithHttpAgent(
  input: RunInput,
  onEvent: (ev: AguiEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  try {
    const mod = await import("@ag-ui/client");
    const HttpAgent = (mod as any).HttpAgent as any;
    if (!HttpAgent) throw new Error("HttpAgent not available");
    const url = (import.meta as any).env?.VITE_AGENT_URL || `${BASE_URL}/agui/run`;
    const agent = new HttpAgent(url);
    const iter = await agent.run(input, { signal });
    for await (const ev of iter) {
      if (!ev) continue;
      if (typeof onEvent === "function") {
        onEvent(ev as any);
      }
    }
    return;
  } catch {
    // Swallow and let caller fallback to fetch path
    throw new Error("http_agent_unavailable");
  }
}

