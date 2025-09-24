import React from "react";
import type { PatchOp } from "../state/types";

type Question = { id: string; text: string; status: "OPEN" | "PASS" | "FAIL"; tags?: string[]; citations?: any[] };

export default function DisclosureChecklist(props: { panelId: string; cfg: any; sendPatch: (ops: PatchOp[]) => Promise<any> | undefined }) {
  const { panelId, cfg, sendPatch } = props;
  const controls = cfg.controls || {};
  const questions: Question[] = cfg.data?.questions || [];
  const citations: any[] = cfg.data?.citations || [];

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
      <CoverageWidget questions={questions} citations={citations} />
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

function CoverageWidget({ questions, citations }: { questions: Question[]; citations: any[] }) {
  const topic = (q: Question) => (q.tags?.[2] || q.tags?.[0] || "Topic");
  const byTopic: Record<string, { PASS: number; FAIL: number; OPEN: number; ent: number; cust: number }> = {};
  for (const q of questions) {
    const t = topic(q);
    byTopic[t] ||= { PASS: 0, FAIL: 0, OPEN: 0, ent: 0, cust: 0 } as any;
    byTopic[t][q.status] += 1 as any;
  }
  for (const c of citations || []) {
    const src = (c.source || "").toLowerCase();
    if (src === "enterprise") byTopic.__all = (byTopic.__all || { PASS:0, FAIL:0, OPEN:0, ent:0, cust:0 });
  }
  // split source counts using citation sources present
  const srcCounts = { enterprise: 0, customer: 0 };
  for (const c of citations || []) {
    if (c.source === "enterprise") srcCounts.enterprise++;
    if (c.source === "customer") srcCounts.customer++;
  }
  const rows = Object.entries(byTopic);
  if (!rows.length) return null;
  return (
    <div className="card p-2" style={{ background: "#fbfbfb" }}>
      <div className="d-flex justify-content-between align-items-center">
        <strong>Coverage</strong>
        <span className="small text-muted">Citations — Ent: {srcCounts.enterprise} · Cust: {srcCounts.customer}</span>
      </div>
      <div className="mt-2" style={{ display: "grid", gap: 6 }}>
        {rows.map(([t, m]) => {
          const tot = Math.max(1, m.PASS + m.FAIL + m.OPEN);
          const pct = (n: number) => Math.round((n / tot) * 100);
          return (
            <div key={t} style={{ display: "grid", gridTemplateColumns: "160px 1fr", alignItems: "center", gap: 8 }}>
              <div className="small" style={{ fontWeight: 600 }}>{t}</div>
              <div style={{ height: 10, borderRadius: 8, overflow: "hidden", display: "flex", background: "#eee" }}>
                <div title={`PASS ${m.PASS}`} style={{ width: `${pct(m.PASS)}%`, background: "#a5d6a7" }} />
                <div title={`FAIL ${m.FAIL}`} style={{ width: `${pct(m.FAIL)}%`, background: "#ef9a9a" }} />
                <div title={`OPEN ${m.OPEN}`} style={{ width: `${pct(m.OPEN)}%`, background: "#bdbdbd" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

