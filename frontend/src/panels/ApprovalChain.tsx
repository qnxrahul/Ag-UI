// import React from "react";
// import type { AppState, PatchOp } from "../state/types";
// import Chips from "../components/Chips";

// export default function ApprovalChain(
//   props: { state: AppState; panelId: string; cfg: any; sendPatch: (ops: PatchOp[]) => Promise<any> | undefined }
// ) {
//   const { state, panelId, cfg, sendPatch } = props;
//   const controls = cfg.controls || {};
//   const data = cfg.data || {};
//   const chain: string[] = data.chain || [];
//   const citations = data.citations || [];
//   const rules = data.rules || {};

//   const setAmount = async (v: string) => {
//     const num = v === "" ? null : Number(v);
//     await sendPatch([{
//       op: (controls.amount === undefined ? "add" : "replace"),
//       path: `/panel_configs/${panelId}/controls/amount`,
//       value: num
//     }]);
//   };

//   const setInstrument = async (v: string) => {
//     const val = v === "" ? null : v;
//     await sendPatch([{
//       op: (controls.instrument === undefined ? "add" : "replace"),
//       path: `/panel_configs/${panelId}/controls/instrument`,
//       value: val
//     }]);
//   };

//   return (
//     <div style={{ display: "grid", gap: 12 }}>
//       <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
//         <label style={{ display: "grid", gap: 6 }}>
//           <span>Amount</span>
//           <input
//             type="number"
//             placeholder="e.g., 18000"
//             value={controls.amount ?? ""}
//             onChange={(e) => setAmount(e.target.value)}
//             style={inputStyle}
//           />
//         </label>

//         <label style={{ display: "grid", gap: 6 }}>
//           <span>Instrument (optional)</span>
//           <select
//             value={controls.instrument ?? ""}
//             onChange={(e) => setInstrument(e.target.value)}
//             style={inputStyle}
//           >
//             <option value="">(none)</option>
//             <option value="cheque">cheque</option>
//             <option value="payment">payment</option>
//             <option value="purchase">purchase</option>
//           </select>
//         </label>
//       </div>

//       <div>
//         <div style={{ fontWeight: 600, marginBottom: 6 }}>Proposed Approval Chain</div>
//         <Chips items={chain} />
//       </div>

//       <div>
//         <div style={{ fontWeight: 600, marginBottom: 6 }}>Citations</div>
//         {citations?.length ? (
//           citations.map((c: any, idx: number) => (
//             <div key={idx} style={{ padding: 8, border: "1px solid #eee", borderRadius: 6, background: "#fafafa", marginBottom: 6 }}>
//               <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}><strong>{c.key}</strong></div>
//               <div style={{ whiteSpace: "pre-wrap" }}>{c.snippet || "(no snippet)"}</div>
//             </div>
//           ))
//         ) : (
//           <div style={{ color: "#888" }}>(no citations)</div>
//         )}
//       </div>

//       <details>
//         <summary style={{ cursor: "pointer", color: "#555" }}>Show extracted rules (debug)</summary>
//         <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(rules, null, 2)}</pre>
//       </details>
//     </div>
//   );
// }

// const inputStyle: React.CSSProperties = { padding: 8, border: "1px solid #ccc", borderRadius: 8, width: "100%" };


import React from "react";
import type { AppState, PatchOp } from "../state/types";
import Chips from "../components/Chips";

export default function ApprovalChain(
  props: { state: AppState; panelId: string; cfg: any; sendPatch: (ops: PatchOp[]) => Promise<any> | undefined }
) {
  const { panelId, cfg, sendPatch } = props;
  const controls = cfg.controls || {};
  const data = cfg.data || {};
  const chain: string[] = data.chain || [];
  const citations = data.citations || [];
  const rules = data.rules || {};

  const setAmount = async (v: string) => {
    const num = v === "" ? null : Number(v);
    await sendPatch([{
      op: (controls.amount === undefined ? "add" : "replace"),
      path: `/panel_configs/${panelId}/controls/amount`,
      value: num
    }]);
  };

  const setInstrument = async (v: string) => {
    const val = v === "" ? null : v;
    await sendPatch([{
      op: (controls.instrument === undefined ? "add" : "replace"),
      path: `/panel_configs/${panelId}/controls/instrument`,
      value: val
    }]);
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Amount</span>
          <input
            type="number"
            placeholder="e.g., 18000"
            value={controls.amount ?? ""}
            onChange={(e) => setAmount(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Instrument (optional)</span>
          <select
            value={controls.instrument ?? ""}
            onChange={(e) => setInstrument(e.target.value)}
            style={inputStyle}
          >
            <option value="">(none)</option>
            <option value="cheque">cheque</option>
            <option value="payment">payment</option>
            <option value="purchase">purchase</option>
          </select>
        </label>
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Proposed Approval Chain</div>
        <Chips items={chain} />
      </div>

      {/* Citations (collapsed) */}
      <details className="details">
        <summary className="summary">Citations ({citations?.length || 0})</summary>
        {citations?.length ? (
          citations.map((c: any, idx: number) => (
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
                <span style={{ display:"inline-block", padding:"2px 6px", borderRadius:999, background:"#e0e7ff", color:"#1e3a8a", border:"1px solid #c7d2fe", fontWeight:600 }}>{c.key}</span>
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
        ) : (
          <div style={{ color: "#888" }}>(no citations)</div>
        )}
      </details>

      {/* Debug JSON (collapsed) */}
      <details className="details">
        <summary className="summary">Show extracted rules (debug)</summary>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(rules, null, 2)}</pre>
      </details>
    </div>
  );
}

const inputStyle: React.CSSProperties = { padding: 8, border: "1px solid #ccc", borderRadius: 8, width: "100%" };
