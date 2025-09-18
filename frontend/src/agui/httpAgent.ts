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
  const agent = new HttpAgent(endpoint);
  const iter = await agent.run(input, { signal });
  for await (const ev of iter) {
    if (!ev) continue;
    if (typeof onEvent === "function") {
      onEvent(ev as any);
    }
  }
}

