// // panels/FormSpending.tsx
// import React from "react";
// import type { AppState, PatchOp } from "../state/types";
// import Chips from "../components/Chips";

// export default function FormSpending(
//   props: { panelId: string; cfg: any; sendPatch: (ops: PatchOp[]) => Promise<any> | undefined }
// ) {
//   const { panelId, cfg, sendPatch } = props;
//   const controls = cfg.controls || {};
//   const data = cfg.data || {};
//   const rules = data.rules || {};
//   const citations = data.citations || [];
//   const steps = data.required_steps || [];

//   const setControl = async (key: string, val: any) => {
//     const path = `/panel_configs/${panelId}/controls/${key}`;
//     await sendPatch([{ op: (controls[key] === undefined ? "add" : "replace"), path, value: val }]);
//   };

//   return (
//     <div style={{ display: "grid", gap: 12 }}>
//       <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
//         <Field label="Amount (USD)">
//           <input type="number" placeholder="e.g., 18000"
//                  value={controls.amount ?? ""} onChange={(e) => setControl("amount", e.target.value === "" ? null : Number(e.target.value))}
//                  style={inputStyle} />
//         </Field>
//         <Field label="Category (optional)">
//           <select value={controls.category ?? ""} onChange={(e) => setControl("category", e.target.value || null)} style={inputStyle}>
//             <option value="">(none)</option>
//             <option value="ops">ops</option>
//             <option value="asset">asset</option>
//             <option value="program">program</option>
//           </select>
//         </Field>
//       </div>

//       <div>
//         <div style={{ fontWeight: 600, marginBottom: 6 }}>Required Steps</div>
//         <Chips items={steps} />
//       </div>

//       <div>
//         <div style={{ fontWeight: 600, marginBottom: 6 }}>Citations</div>
//         {citations?.length
//           ? citations.map((c: any, idx: number) => (
//               <div key={idx} style={{ padding: 8, border: "1px solid #eee", borderRadius: 6, background: "#fafafa", marginBottom: 6 }}>
//                 <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}><strong>{c.key}</strong></div>
//                 <div style={{ whiteSpace: "pre-wrap" }}>{c.snippet || "(no snippet)"}</div>
//               </div>
//             ))
//           : <div style={{ color: "#888" }}>(no citations)</div>}
//       </div>

//       <details>
//         <summary style={{ cursor:"pointer", color:"#555" }}>Show extracted rules (debug)</summary>
//         <pre style={{ whiteSpace:"pre-wrap" }}>{JSON.stringify(rules, null, 2)}</pre>
//       </details>
//     </div>
//   );
// }

// function Field(props: { label: string; children: any }) {
//   return (
//     <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
//       <span style={{ color: "#333" }}>{props.label}</span>
//       {props.children}
//     </label>
//   );
// }
// const inputStyle: React.CSSProperties = { padding: 8, border: "1px solid #ccc", borderRadius: 8, width: "100%" };


import React from "react";
import type { AppState, PatchOp } from "../state/types";
import Chips from "../components/Chips";

export default function FormSpending(
  props: { panelId: string; cfg: any; sendPatch: (ops: PatchOp[]) => Promise<any> | undefined }
) {
  const { panelId, cfg, sendPatch } = props;
  const controls = cfg.controls || {};
  const data = cfg.data || {};
  const rules = data.rules || {};
  const citations = data.citations || [];
  const steps = data.required_steps || [];

  const setControl = async (key: string, val: any) => {
    const path = `/panel_configs/${panelId}/controls/${key}`;
    await sendPatch([{ op: (controls[key] === undefined ? "add" : "replace"), path, value: val }]);
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Amount (USD)">
          <input
            type="number"
            placeholder="e.g., 18000"
            value={controls.amount ?? ""}
            onChange={(e) => setControl("amount", e.target.value === "" ? null : Number(e.target.value))}
            style={inputStyle}
          />
        </Field>
        <Field label="Category (optional)">
          <select
            value={controls.category ?? ""}
            onChange={(e) => setControl("category", e.target.value || null)}
            style={inputStyle}
          >
            <option value="">(none)</option>
            <option value="ops">ops</option>
            <option value="asset">asset</option>
            <option value="program">program</option>
          </select>
        </Field>
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Required Steps</div>
        <Chips items={steps} />
      </div>

      {/* Citations (collapsed) */}
      <details className="details">
        <summary className="summary">Citations ({citations?.length || 0})</summary>
        {citations?.length
          ? citations.map((c: any, idx: number) => (
              <div
                key={idx}
                style={{
                  padding: 8,
                  border: "1px solid #eee",
                  borderRadius: 6,
                  background: "#fafafa",
                  marginTop: 8,
                }}
              >
                <div style={{ display:"flex", alignItems:"center", gap:8, fontSize: 12, color: "#666", marginBottom: 4 }}>
                  <span style={{
                    display:"inline-block", padding:"2px 6px", borderRadius:999,
                    background:"#e0e7ff", color:"#1e3a8a", border:"1px solid #c7d2fe", fontWeight:600
                  }}>{c.key}</span>
                  {typeof c.page === "number" && (
                    <span style={{ marginLeft: 8, color: "#355" }}>p.{c.page}</span>
                  )}
                  {c.chunk_id && (
                    <span style={{ marginLeft: 6, color: "#7a7a7a" }}>({c.chunk_id})</span>
                  )}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{c.snippet || "(no snippet)"}</div>
              </div>
            ))
          : <div style={{ color: "#888" }}>(no citations)</div>}
      </details>

      {/* Debug JSON (collapsed) */}
      <details className="details">
        <summary className="summary">Show extracted rules (debug)</summary>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(rules, null, 2)}</pre>
      </details>
    </div>
  );
}

function Field(props: { label: string; children: any }) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
      <span style={{ color: "#333" }}>{props.label}</span>
      {props.children}
    </label>
  );
}
const inputStyle: React.CSSProperties = { padding: 8, border: "1px solid #ccc", borderRadius: 8, width: "100%" };
