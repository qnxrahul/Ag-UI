import React from "react";
import type { PatchOp } from "../state/types";

type Question = { id: string; text: string; status: "OPEN" | "PASS" | "FAIL"; tags?: string[]; citations?: any[] };

export default function DisclosureChecklist(props: { panelId: string; cfg: any; sendPatch: (ops: PatchOp[]) => Promise<any> | undefined }) {
  const { panelId, cfg, sendPatch } = props;
  const controls = cfg.controls || {};
  const questions: Question[] = cfg.data?.questions || [];

  const setControl = async (key: string, value: any) => {
    const path = `/panel_configs/${panelId}/controls/${key}`;
    const exists = controls[key] !== undefined;
    await sendPatch([{ op: exists ? "replace" : "add", path, value }]);
  };

  const setStatus = async (qid: string, status: "OPEN" | "PASS" | "FAIL") => {
    const idx = questions.findIndex((q) => q.id === qid);
    if (idx < 0) return;
    await sendPatch([{ op: "replace", path: `/panel_configs/${panelId}/data/questions/${idx}/status`, value: status }]);
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="row g-2">
        <div className="col-md-4">
          <label className="form-label">Framework</label>
          <input className="form-control" value={controls.framework ?? ""} onChange={(e) => setControl("framework", e.target.value)} />
        </div>
        <div className="col-md-4">
          <label className="form-label">Period</label>
          <input className="form-control" value={controls.period ?? ""} onChange={(e) => setControl("period", e.target.value)} />
        </div>
        <div className="col-md-4">
          <label className="form-label">Company</label>
          <input className="form-control" value={controls.company ?? ""} onChange={(e) => setControl("company", e.target.value)} />
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Questions ({questions.length})</div>
        <ul className="list-group">
          {questions.map((q) => (
            <li key={q.id} className="list-group-item">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{q.text}</div>
                  {!!q.tags?.length && <div className="small text-muted">{q.tags.join(" • ")}</div>}
                </div>
                <div className="btn-group">
                  <button className={`btn btn-sm ${q.status === "PASS" ? "btn-success" : "btn-outline-success"}`} onClick={() => setStatus(q.id, "PASS")}>Pass</button>
                  <button className={`btn btn-sm ${q.status === "FAIL" ? "btn-danger" : "btn-outline-danger"}`} onClick={() => setStatus(q.id, "FAIL")}>Fail</button>
                  <button className={`btn btn-sm ${q.status === "OPEN" ? "btn-secondary" : "btn-outline-secondary"}`} onClick={() => setStatus(q.id, "OPEN")}>Open</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

