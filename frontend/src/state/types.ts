export type Category = "ops" | "asset" | "program";

export type AppState = {
  meta: {
    docName: string;
    server_timestamp?: number;
    exportRequested?: boolean;
    last_export_url?: string;
  };
  panels: string[];                                
  panel_configs: Record<string, any>;               
  spend: {
    amount?: number | null;
    category?: Category | null;
    flags: string[];
    requester?: string | null;
    approver?: string | null;
    required_steps: string[];
  };
  delegation: {
    people: string[];
    roles: string[];
    assignments: Record<string, string | null>;
    acting: Array<Record<string, any>>;
  };
  violations: Array<{ code: string; message: string; path?: string }>;
  citations: Array<{ key: string; href?: string; snippet?: string }>;
};

export type PatchOp = {
  op: "add" | "replace" | "remove" | "move" | "copy" | "test";
  path: string;
  value?: any;
  from?: string;
};
