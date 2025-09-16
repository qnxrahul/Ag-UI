// import React from "react";
// import type { AppState, PatchOp } from "../state/types";

// type StatusRow = { code: string; label: string; status: "pass" | "fail" | "unknown"; citations?: string[]; quotes?: string[] };

// export default function ControlChecklists(
//   props: { state: AppState; panelId: string; cfg: any; sendPatch: (ops: PatchOp[]) => Promise<any> | undefined }
// ) {
//   const { panelId, cfg, sendPatch } = props;
//   const controls = cfg.controls || {};
//   const rules = cfg.data?.rules || {};
//   const status = cfg.data?.status || { travel: [], bank: [], credit: [] };
//   const citations = cfg.data?.citations || [];

//   // helpers
//   const setCtl = async (section: "travel"|"bank"|"credit", field: string, value: any) => {
//     const path = `/panel_configs/${panelId}/controls/${section}/${field}`;
//     const exists = (((controls[section] || {}) as any)[field] !== undefined);
//     await sendPatch([{ op: exists ? "replace" : "add", path, value }]);
//   };

//   const summarize = (rows: StatusRow[]) => {
//     let pass = 0, fail = 0, unknown = 0;
//     for (const r of rows) {
//       if (r.status === "pass") pass++;
//       else if (r.status === "fail") fail++;
//       else unknown++;
//     }
//     return { pass, fail, unknown };
//   };

//   const sumAll = (() => {
//     const a = summarize(status.travel as StatusRow[]);
//     const b = summarize(status.bank as StatusRow[]);
//     const c = summarize(status.credit as StatusRow[]);
//     return { pass: a.pass+b.pass+c.pass, fail: a.fail+b.fail+c.fail, unknown: a.unknown+b.unknown+c.unknown };
//   })();

//   return (
//     <div style={{ display: "grid", gap: 16 }}>
//       {/* Tiny stacked bar (no libs) */}
//       <div>
//         <div style={{ fontWeight: 600, marginBottom: 6 }}>This month overview</div>
//         <StackedBar pass={sumAll.pass} fail={sumAll.fail} unknown={sumAll.unknown} />
//       </div>

//       {/* TRAVEL */}
//       <Section title="Travel">
//         <div style={grid2}>
//           <Field label="Advance issued">
//             <input type="date" value={controls.travel?.advance_issued_date ?? ""} onChange={(e) => setCtl("travel","advance_issued_date", e.target.value || null)} style={input} />
//           </Field>
//           <Field label="Trip start">
//             <input type="date" value={controls.travel?.trip_start_date ?? ""} onChange={(e) => setCtl("travel","trip_start_date", e.target.value || null)} style={input} />
//           </Field>
//           <Field label="Trip end">
//             <input type="date" value={controls.travel?.trip_end_date ?? ""} onChange={(e) => setCtl("travel","trip_end_date", e.target.value || null)} style={input} />
//           </Field>
//           <Field label="Claim submitted">
//             <input type="date" value={controls.travel?.claim_submitted_date ?? ""} onChange={(e) => setCtl("travel","claim_submitted_date", e.target.value || null)} style={input} />
//           </Field>
//           <Field label="Excess returned (if any)">
//             <input type="date" value={controls.travel?.excess_returned_date ?? ""} onChange={(e) => setCtl("travel","excess_returned_date", e.target.value || null)} style={input} />
//           </Field>
//           <Field label="Another travel advance outstanding?">
//             <input type="checkbox" checked={!!controls.travel?.has_other_advance} onChange={(e) => setCtl("travel","has_other_advance", e.target.checked)} />
//           </Field>
//         </div>
//         <Checklist rows={(status.travel as StatusRow[]) || []} />
//       </Section>

//       {/* BANK RECONCILIATION */}
//       <Section title="Bank Reconciliation">
//         <div style={grid2}>
//           <Field label="Statement date">
//             <input type="date" value={controls.bank?.statement_date ?? ""} onChange={(e) => setCtl("bank","statement_date", e.target.value || null)} style={input} />
//           </Field>
//           <Field label="Reconciliation completed">
//             <input type="date" value={controls.bank?.recon_completed_date ?? ""} onChange={(e) => setCtl("bank","recon_completed_date", e.target.value || null)} style={input} />
//           </Field>
//           <Field label="Is preparer a cheque signer?">
//             <input type="checkbox" checked={!!controls.bank?.is_preparer_signer} onChange={(e) => setCtl("bank","is_preparer_signer", e.target.checked)} />
//           </Field>
//           <Field label="Is preparer the depositor?">
//             <input type="checkbox" checked={!!controls.bank?.is_preparer_depositor} onChange={(e) => setCtl("bank","is_preparer_depositor", e.target.checked)} />
//           </Field>
//         </div>
//         <Checklist rows={(status.bank as StatusRow[]) || []} />
//       </Section>

//       {/* CREDIT CARD RECONCILIATION */}
//       <Section title="Credit Card Reconciliation">
//         <div style={grid2}>
//           <Field label="Statement date">
//             <input type="date" value={controls.credit?.cc_statement_date ?? ""} onChange={(e) => setCtl("credit","cc_statement_date", e.target.value || null)} style={input} />
//           </Field>
//           <Field label="Reconciliation completed">
//             <input type="date" value={controls.credit?.cc_recon_completed_date ?? ""} onChange={(e) => setCtl("credit","cc_recon_completed_date", e.target.value || null)} style={input} />
//           </Field>
//           <Field label="Does preparer have spending authority?">
//             <input type="checkbox" checked={!!controls.credit?.preparer_has_spending_authority} onChange={(e) => setCtl("credit","preparer_has_spending_authority", e.target.checked)} />
//           </Field>
//         </div>
//         <Checklist rows={(status.credit as StatusRow[]) || []} />
//       </Section>

//       {/* Citations */}
//       <div>
//         <div style={{ fontWeight: 600, marginBottom: 6 }}>Citations</div>
//         {citations?.length ? citations.map((c: any, i: number) => (
//           <div key={i} style={{ padding: 8, border: "1px solid #eee", borderRadius: 6, background: "#fafafa", marginBottom: 6 }}>
//             <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}><strong>{c.key}</strong></div>
//             <div style={{ whiteSpace: "pre-wrap" }}>{c.snippet || "(no snippet)"}</div>
//           </div>
//         )) : <div style={{ color: "#888" }}>(no citations)</div>}
//       </div>

//       {/* Debug */}
//       <details>
//         <summary style={{ cursor: "pointer", color: "#555" }}>Show extracted rules (debug)</summary>
//         <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(rules, null, 2)}</pre>
//       </details>
//     </div>
//   );
// }

// function Section(props: { title: string; children: any }) {
//   return (
//     <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
//       <div style={{ fontWeight: 600, marginBottom: 10 }}>{props.title}</div>
//       {props.children}
//     </div>
//   );
// }
// function Field(props: { label: string; children: any }) {
//   return (
//     <label style={{ display: "grid", gap: 6 }}>
//       <span style={{ color: "#333" }}>{props.label}</span>
//       {props.children}
//     </label>
//   );
// }

// function Checklist({ rows }: { rows: StatusRow[] }) {
//   if (!rows?.length) return <div style={{ color: "#888" }}>(no extracted rules)</div>;
//   return (
//     <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
//       {rows.map((r, i) => (
//         <li key={i} style={{ marginBottom: 6 }}>
//           <Badge status={r.status} /> {r.label}
//         </li>
//       ))}
//     </ul>
//   );
// }

// function Badge({ status }: { status: "pass" | "fail" | "unknown" }) {
//   const bg = status === "pass" ? "#e8f5e9" : status === "fail" ? "#ffebee" : "#f5f5f5";
//   const fg = status === "pass" ? "#2e7d32" : status === "fail" ? "#c62828" : "#555";
//   return (
//     <span style={{ background: bg, color: fg, border: `1px solid ${fg}33`, padding: "2px 6px", borderRadius: 999, fontSize: 12, marginRight: 8 }}>
//       {status.toUpperCase()}
//     </span>
//   );
// }

// function StackedBar({ pass, fail, unknown }: { pass: number; fail: number; unknown: number }) {
//   const total = Math.max(1, pass + fail + unknown);
//   const w = (n: number) => `${Math.round((n / total) * 100)}%`;
//   return (
//     <div style={{ height: 14, background: "#f0f0f0", borderRadius: 999, overflow: "hidden", display: "flex" }}>
//       <div style={{ width: w(pass), background: "#a5d6a7" }} title={`Pass: ${pass}`} />
//       <div style={{ width: w(fail), background: "#ef9a9a" }} title={`Fail: ${fail}`} />
//       <div style={{ width: w(unknown), background: "#bdbdbd" }} title={`Unknown: ${unknown}`} />
//     </div>
//   );
// }

// const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
// const input: React.CSSProperties = { padding: 8, border: "1px solid #ccc", borderRadius: 8, width: "100%" };


import React from "react";
import type { AppState, PatchOp } from "../state/types";

type StatusRow = { code: string; label: string; status: "pass" | "fail" | "unknown"; citations?: string[]; quotes?: string[] };

export default function ControlChecklists(
  props: { state: AppState; panelId: string; cfg: any; sendPatch: (ops: PatchOp[]) => Promise<any> | undefined }
) {
  const { panelId, cfg, sendPatch } = props;
  const controls = cfg.controls || {};
  const rules = cfg.data?.rules || {};
  const status = cfg.data?.status || { travel: [], bank: [], credit: [] };
  const citations = cfg.data?.citations || [];

  const setCtl = async (section: "travel"|"bank"|"credit", field: string, value: any) => {
    const path = `/panel_configs/${panelId}/controls/${section}/${field}`;
    const exists = (((controls[section] || {}) as any)[field] !== undefined);
    await sendPatch([{ op: exists ? "replace" : "add", path, value }]);
  };

  const summarize = (rows: StatusRow[]) => {
    let pass = 0, fail = 0, unknown = 0;
    for (const r of rows) {
      if (r.status === "pass") pass++;
      else if (r.status === "fail") fail++;
      else unknown++;
    }
    return { pass, fail, unknown };
  };

  const sumAll = (() => {
    const a = summarize(status.travel as StatusRow[]);
    const b = summarize(status.bank as StatusRow[]);
    const c = summarize(status.credit as StatusRow[]);
    return { pass: a.pass+b.pass+c.pass, fail: a.fail+b.fail+c.fail, unknown: a.unknown+b.unknown+c.unknown };
  })();

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Tiny stacked bar */}
      <div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>This month overview</div>
        <StackedBar pass={sumAll.pass} fail={sumAll.fail} unknown={sumAll.unknown} />
      </div>

      {/* TRAVEL */}
      <Section title="Travel">
        <div style={grid2}>
          <Field label="Advance issued">
            <input type="date" value={controls.travel?.advance_issued_date ?? ""} onChange={(e) => setCtl("travel","advance_issued_date", e.target.value || null)} style={input} />
          </Field>
          <Field label="Trip start">
            <input type="date" value={controls.travel?.trip_start_date ?? ""} onChange={(e) => setCtl("travel","trip_start_date", e.target.value || null)} style={input} />
          </Field>
          <Field label="Trip end">
            <input type="date" value={controls.travel?.trip_end_date ?? ""} onChange={(e) => setCtl("travel","trip_end_date", e.target.value || null)} style={input} />
          </Field>
          <Field label="Claim submitted">
            <input type="date" value={controls.travel?.claim_submitted_date ?? ""} onChange={(e) => setCtl("travel","claim_submitted_date", e.target.value || null)} style={input} />
          </Field>
          <Field label="Excess returned (if any)">
            <input type="date" value={controls.travel?.excess_returned_date ?? ""} onChange={(e) => setCtl("travel","excess_returned_date", e.target.value || null)} style={input} />
          </Field>
          <Field label="Another travel advance outstanding?">
            <input type="checkbox" checked={!!controls.travel?.has_other_advance} onChange={(e) => setCtl("travel","has_other_advance", e.target.checked)} />
          </Field>
        </div>
        <Checklist rows={(status.travel as StatusRow[]) || []} />
      </Section>

      {/* BANK RECONCILIATION */}
      <Section title="Bank Reconciliation">
        <div style={grid2}>
          <Field label="Statement date">
            <input type="date" value={controls.bank?.statement_date ?? ""} onChange={(e) => setCtl("bank","statement_date", e.target.value || null)} style={input} />
          </Field>
          <Field label="Reconciliation completed">
            <input type="date" value={controls.bank?.recon_completed_date ?? ""} onChange={(e) => setCtl("bank","recon_completed_date", e.target.value || null)} style={input} />
          </Field>
          <Field label="Is preparer a cheque signer?">
            <input type="checkbox" checked={!!controls.bank?.is_preparer_signer} onChange={(e) => setCtl("bank","is_preparer_signer", e.target.checked)} />
          </Field>
          <Field label="Is preparer the depositor?">
            <input type="checkbox" checked={!!controls.bank?.is_preparer_depositor} onChange={(e) => setCtl("bank","is_preparer_depositor", e.target.checked)} />
          </Field>
        </div>
        <Checklist rows={(status.bank as StatusRow[]) || []} />
      </Section>

      {/* CREDIT CARD RECONCILIATION */}
      <Section title="Credit Card Reconciliation">
        <div style={grid2}>
          <Field label="Statement date">
            <input type="date" value={controls.credit?.cc_statement_date ?? ""} onChange={(e) => setCtl("credit","cc_statement_date", e.target.value || null)} style={input} />
          </Field>
          <Field label="Reconciliation completed">
            <input type="date" value={controls.credit?.cc_recon_completed_date ?? ""} onChange={(e) => setCtl("credit","cc_recon_completed_date", e.target.value || null)} style={input} />
          </Field>
          <Field label="Does preparer have spending authority?">
            <input type="checkbox" checked={!!controls.credit?.preparer_has_spending_authority} onChange={(e) => setCtl("credit","preparer_has_spending_authority", e.target.checked)} />
          </Field>
        </div>
        <Checklist rows={(status.credit as StatusRow[]) || []} />
      </Section>

      {/* Citations (collapsed) */}
      <details className="details">
        <summary className="summary">Citations ({citations?.length || 0})</summary>
        {citations?.length ? citations.map((c: any, i: number) => (
          <div key={i} style={{ padding: 8, border: "1px solid #eee", borderRadius: 6, background: "#fafafa", marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}><strong>{c.key}</strong></div>
            <div style={{ whiteSpace: "pre-wrap" }}>{c.snippet || "(no snippet)"}</div>
          </div>
        )) : <div style={{ color: "#888" }}>(no citations)</div>}
      </details>

      {/* Debug (collapsed) */}
      <details className="details">
        <summary className="summary">Show extracted rules (debug)</summary>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(rules, null, 2)}</pre>
      </details>
    </div>
  );
}

function Section(props: { title: string; children: any }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>{props.title}</div>
      {props.children}
    </div>
  );
}
function Field(props: { label: string; children: any }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ color: "#333" }}>{props.label}</span>
      {props.children}
    </label>
  );
}

function Checklist({ rows }: { rows: StatusRow[] }) {
  if (!rows?.length) return <div style={{ color: "#888" }}>(no extracted rules)</div>;
  return (
    <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
      {rows.map((r, i) => (
        <li key={i} style={{ marginBottom: 6 }}>
          <Badge status={r.status} /> {r.label}
        </li>
      ))}
    </ul>
  );
}

function Badge({ status }: { status: "pass" | "fail" | "unknown" }) {
  const bg = status === "pass" ? "#e8f5e9" : status === "fail" ? "#ffebee" : "#f5f5f5";
  const fg = status === "pass" ? "#2e7d32" : status === "fail" ? "#c62828" : "#555";
  return (
    <span style={{ background: bg, color: fg, border: `1px solid ${fg}33`, padding: "2px 6px", borderRadius: 999, fontSize: 12, marginRight: 8 }}>
      {status.toUpperCase()}
    </span>
  );
}

function StackedBar({ pass, fail, unknown }: { pass: number; fail: number; unknown: number }) {
  const total = Math.max(1, pass + fail + unknown);
  const w = (n: number) => `${Math.round((n / total) * 100)}%`;
  return (
    <div style={{ height: 14, background: "#f0f0f0", borderRadius: 999, overflow: "hidden", display: "flex" }}>
      <div style={{ width: w(pass), background: "#a5d6a7" }} title={`Pass: ${pass}`} />
      <div style={{ width: w(fail), background: "#ef9a9a" }} title={`Fail: ${fail}`} />
      <div style={{ width: w(unknown), background: "#bdbdbd" }} title={`Unknown: ${unknown}`} />
    </div>
  );
}

const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const input: React.CSSProperties = { padding: 8, border: "1px solid #ccc", borderRadius: 8, width: "100%" };
