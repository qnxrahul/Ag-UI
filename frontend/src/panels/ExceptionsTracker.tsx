// // panels/ExceptionsTracker.tsx
// import React, { useState } from "react";
// import type { AppState, PatchOp } from "../state/types";

// type StatusRow = { item: string; status: "PASS" | "FAIL" | "UNKNOWN" };

// export default function ExceptionsTracker(props: {
//   state: AppState;
//   panelId: string;
//   cfg: any;
//   sendPatch: (ops: PatchOp[]) => Promise<any> | undefined;
// }) {
//   const { panelId, cfg, sendPatch } = props;
//   const controls = cfg.controls || {};
//   const entry = controls.entry || {};
//   const data = cfg.data || {};
//   const status = data.status || { approvals: [], documentation: [], reporting: [] };
//   const suggestions = data.suggestions || { approvals: [], documentation: [], reporting: [] };
//   const citations = data.citations || [];
//   const extracted = data.extracted || {};

//   const [newApproval, setNewApproval] = useState("");
//   const [newDoc, setNewDoc] = useState("");
//   const [newReport, setNewReport] = useState("");

//   const update = (path: string, value: any) =>
//     sendPatch?.([{ op: "add", path, value }]); // add works for both add/replace because JSON Patch 'add' replaces when existing

//   const setEntryField = (key: string, value: any) =>
//     update(`/panel_configs/${panelId}/controls/entry/${key}`, value);

//   const toggleMapField = (group: "approvals" | "documentation" | "reporting", key: string, value: boolean) =>
//     update(`/panel_configs/${panelId}/controls/entry/${group}/${key}`, value);

//   const addCustomItem = (group: "approvals" | "documentation" | "reporting", label: string, clear: () => void) => {
//     const name = label.trim();
//     if (!name) return;
//     toggleMapField(group, name, false);
//     clear();
//   };

//   const mergeKeys = (group: "approvals" | "documentation" | "reporting") => {
//     const s: string[] = (suggestions[group] || []) as string[];
//     const current: string[] = Object.keys(entry[group] || {});
//     const set = new Set<string>([...s, ...current]);
//     return Array.from(set);
//   };

//   const renderStatus = (rows: StatusRow[]) => {
//     if (!rows?.length) return <div style={{ color: "#888" }}>(no requirements matched yet)</div>;
//     return (
//       <ul style={{ margin: 0, paddingLeft: 18 }}>
//         {rows.map((r, i) => (
//           <li key={i}>
//             <strong>{r.status}</strong> — {r.item}
//           </li>
//         ))}
//       </ul>
//     );
//   };

//   return (
//     <div style={{ display: "grid", gap: 12 }}>
//       <div style={{ display: "grid", gap: 8 }}>
//         <label style={label}>
//           <span>Keywords / short label</span>
//           <input
//             value={entry.keywords ?? ""}
//             placeholder='e.g., "sole source", "emergency purchase"'
//             onChange={(e) => setEntryField("keywords", e.target.value)}
//             style={input}
//           />
//         </label>
//         <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
//           <label style={label}>
//             <span>Amount</span>
//             <input
//               type="number"
//               value={entry.amount ?? ""}
//               placeholder="e.g., 15000"
//               onChange={(e) => setEntryField("amount", e.target.value === "" ? null : Number(e.target.value))}
//               style={input}
//             />
//           </label>
//           <label style={label}>
//             <span>Currency</span>
//             <input
//               value={entry.currency ?? ""}
//               placeholder="e.g., USD"
//               onChange={(e) => setEntryField("currency", e.target.value)}
//               style={input}
//             />
//           </label>
//         </div>
//       </div>

//       {/* Approvals */}
//       <section>
//         <div style={sectionTitle}>Approvals</div>
//         <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
//           <input
//             value={newApproval}
//             onChange={(e) => setNewApproval(e.target.value)}
//             placeholder="Add approval role/title"
//             onKeyDown={(e) => e.key === "Enter" && addCustomItem("approvals", newApproval, () => setNewApproval(""))}
//             style={input}
//           />
//           <button onClick={() => addCustomItem("approvals", newApproval, () => setNewApproval(""))} style={btn}>Add</button>
//         </div>
//         <div style={{ display: "grid", gap: 6 }}>
//           {mergeKeys("approvals").map((k) => (
//             <label key={k} style={row}>
//               <input
//                 type="checkbox"
//                 checked={!!(entry.approvals?.[k])}
//                 onChange={(e) => toggleMapField("approvals", k, e.target.checked)}
//               />
//               <span style={{ marginLeft: 8 }}>{k}</span>
//             </label>
//           ))}
//         </div>
//         <div style={{ marginTop: 8 }}>{renderStatus(status.approvals)}</div>
//       </section>

//       {/* Documentation */}
//       <section>
//         <div style={sectionTitle}>Documentation</div>
//         <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
//           <input
//             value={newDoc}
//             onChange={(e) => setNewDoc(e.target.value)}
//             placeholder="Add required document"
//             onKeyDown={(e) => e.key === "Enter" && addCustomItem("documentation", newDoc, () => setNewDoc(""))}
//             style={input}
//           />
//           <button onClick={() => addCustomItem("documentation", newDoc, () => setNewDoc(""))} style={btn}>Add</button>
//         </div>
//         <div style={{ display: "grid", gap: 6 }}>
//           {mergeKeys("documentation").map((k) => (
//             <label key={k} style={row}>
//               <input
//                 type="checkbox"
//                 checked={!!(entry.documentation?.[k])}
//                 onChange={(e) => toggleMapField("documentation", k, e.target.checked)}
//               />
//               <span style={{ marginLeft: 8 }}>{k}</span>
//             </label>
//           ))}
//         </div>
//         <div style={{ marginTop: 8 }}>{renderStatus(status.documentation)}</div>
//       </section>

//       {/* Reporting */}
//       <section>
//         <div style={sectionTitle}>Reporting</div>
//         <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
//           <input
//             value={newReport}
//             onChange={(e) => setNewReport(e.target.value)}
//             placeholder="Add reporting obligation"
//             onKeyDown={(e) => e.key === "Enter" && addCustomItem("reporting", newReport, () => setNewReport(""))}
//             style={input}
//           />
//           <button onClick={() => addCustomItem("reporting", newReport, () => setNewReport(""))} style={btn}>Add</button>
//         </div>
//         <div style={{ display: "grid", gap: 6 }}>
//           {mergeKeys("reporting").map((k) => (
//             <label key={k} style={row}>
//               <input
//                 type="checkbox"
//                 checked={!!(entry.reporting?.[k])}
//                 onChange={(e) => toggleMapField("reporting", k, e.target.checked)}
//               />
//               <span style={{ marginLeft: 8 }}>{k}</span>
//             </label>
//           ))}
//         </div>
//         <div style={{ marginTop: 8 }}>{renderStatus(status.reporting)}</div>
//       </section>

//       {/* Citations */}
//       <div>
//         <div style={{ fontWeight: 600, marginBottom: 6 }}>Citations</div>
//         {citations?.length ? (
//           citations.map((c: any, idx: number) => (
//             <div key={idx} style={citeBox}>
//               <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
//                 <strong>{c.key}</strong>
//               </div>
//               <div style={{ whiteSpace: "pre-wrap" }}>{c.snippet || "(no snippet)"}</div>
//             </div>
//           ))
//         ) : (
//           <div style={{ color: "#888" }}>(no citations)</div>
//         )}
//       </div>

//       <details>
//         <summary style={{ cursor: "pointer", color: "#555" }}>Show extracted rules (debug)</summary>
//         <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(extracted, null, 2)}</pre>
//       </details>
//     </div>
//   );
// }

// const label: React.CSSProperties = { display: "grid", gap: 6, fontSize: 14 };
// const input: React.CSSProperties = { padding: 8, border: "1px solid #ccc", borderRadius: 8, width: "100%" };
// const btn: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", background: "#f7f7f7", cursor: "pointer" };
// const row: React.CSSProperties = { display: "flex", alignItems: "center" };
// const sectionTitle: React.CSSProperties = { fontWeight: 600, marginBottom: 6 };
// const citeBox: React.CSSProperties = { padding: 8, border: "1px solid #eee", borderRadius: 6, background: "#fafafa", marginBottom: 6 };


import React, { useState } from "react";
import type { AppState, PatchOp } from "../state/types";

type StatusRow = { item: string; status: "PASS" | "FAIL" | "UNKNOWN" };

export default function ExceptionsTracker(props: {
  state: AppState;
  panelId: string;
  cfg: any;
  sendPatch: (ops: PatchOp[]) => Promise<any> | undefined;
}) {
  const { panelId, cfg, sendPatch } = props;
  const controls = cfg.controls || {};
  const entry = controls.entry || {};
  const data = cfg.data || {};
  const status = data.status || { approvals: [], documentation: [], reporting: [] };
  const suggestions = data.suggestions || { approvals: [], documentation: [], reporting: [] };
  const suggestionsUi = data.suggestions_ui || [];
  const citations = data.citations || [];
  const extracted = data.extracted || {};

  const [newApproval, setNewApproval] = useState("");
  const [newDoc, setNewDoc] = useState("");
  const [newReport, setNewReport] = useState("");

  function jpSeg(s: string) {
    return String(s).replace(/~/g, "~0").replace(/\//g, "~1");
  }


  const update = (path: string, value: any) =>
    sendPatch?.([{ op: "add", path, value }]); 

  const setEntryField = (key: string, value: any) =>
    update(`/panel_configs/${panelId}/controls/entry/${key}`, value);

  const toggleMapField = (
    group: "approvals" | "documentation" | "reporting",
    key: string,
    value: boolean
  ) =>
    update(`/panel_configs/${panelId}/controls/entry/${group}/${jpSeg(key)}`, value);


  const addCustomItem = (
    group: "approvals" | "documentation" | "reporting",
    label: string,
    clear: () => void
  ) => {
    const name = label.trim();
    if (!name) return;
    toggleMapField(group, name, false); 
    clear();
  };

  const mergeKeys = (group: "approvals" | "documentation" | "reporting") => {
    const s: string[] = (suggestions[group] || []) as string[];
    const current: string[] = Object.keys(entry[group] || {});
    const set = new Set<string>([...s, ...current]);
    return Array.from(set);
  };

  const renderStatus = (rows: StatusRow[]) => {
    if (!rows?.length) return <div style={{ color: "#888" }}>(no requirements matched yet)</div>;
    return (
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {rows.map((r, i) => (
          <li key={i}>
            <strong>{r.status}</strong> — {r.item}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <label style={label}>
          <span>Keywords / short label</span>
          <input
            value={entry.keywords ?? ""}
            placeholder='e.g., "sole source", "emergency purchase"'
            onChange={(e) => setEntryField("keywords", e.target.value)}
            style={input}
          />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={label}>
            <span>Amount</span>
            <input
              type="number"
              value={entry.amount ?? ""}
              placeholder="e.g., 15000"
              onChange={(e) => setEntryField("amount", e.target.value === "" ? null : Number(e.target.value))}
              style={input}
            />
          </label>
          <label style={label}>
            <span>Currency</span>
            <input
              value={entry.currency ?? ""}
              placeholder="e.g., USD"
              onChange={(e) => setEntryField("currency", e.target.value)}
              style={input}
            />
          </label>
        </div>
      </div>

      {/* Approvals */}
      <section>
        <div style={sectionTitle}>Approvals</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={newApproval}
            onChange={(e) => setNewApproval(e.target.value)}
            placeholder="Add approval role/title"
            onKeyDown={(e) => e.key === "Enter" && addCustomItem("approvals", newApproval, () => setNewApproval(""))}
            style={input}
          />
        <button onClick={() => addCustomItem("approvals", newApproval, () => setNewApproval(""))} style={btn}>Add</button>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          {mergeKeys("approvals").map((k) => (
            <label key={k} style={row}>
              <input
                type="checkbox"
                checked={!!(entry.approvals?.[k])}
                onChange={(e) => toggleMapField("approvals", k, e.target.checked)}
              />
              <span style={{ marginLeft: 8 }}>{k}</span>
            </label>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>{renderStatus(status.approvals)}</div>
      </section>

      {/* Documentation */}
      <section>
        <div style={sectionTitle}>Documentation</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={newDoc}
            onChange={(e) => setNewDoc(e.target.value)}
            placeholder="Add required document"
            onKeyDown={(e) => e.key === "Enter" && addCustomItem("documentation", newDoc, () => setNewDoc(""))}
            style={input}
          />
          <button onClick={() => addCustomItem("documentation", newDoc, () => setNewDoc(""))} style={btn}>Add</button>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          {mergeKeys("documentation").map((k) => (
            <label key={k} style={row}>
              <input
                type="checkbox"
                checked={!!(entry.documentation?.[k])}
                onChange={(e) => toggleMapField("documentation", k, e.target.checked)}
              />
              <span style={{ marginLeft: 8 }}>{k}</span>
            </label>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>{renderStatus(status.documentation)}</div>
      </section>

      {/* Reporting */}
      <section>
        <div style={sectionTitle}>Reporting</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={newReport}
            onChange={(e) => setNewReport(e.target.value)}
            placeholder="Add reporting obligation"
            onKeyDown={(e) => e.key === "Enter" && addCustomItem("reporting", newReport, () => setNewReport(""))}
            style={input}
          />
          <button onClick={() => addCustomItem("reporting", newReport, () => setNewReport(""))} style={btn}>Add</button>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          {mergeKeys("reporting").map((k) => (
            <label key={k} style={row}>
              <input
                type="checkbox"
                checked={!!(entry.reporting?.[k])}
                onChange={(e) => toggleMapField("reporting", k, e.target.checked)}
              />
              <span style={{ marginLeft: 8 }}>{k}</span>
            </label>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>{renderStatus(status.reporting)}</div>
      </section>

      {/* Citations (collapsed) */}
      <details className="details">
        <summary className="summary">Citations ({citations?.length || 0})</summary>
        {citations?.length ? (
          citations.map((c: any, idx: number) => (
            <div key={idx} style={citeBox}>
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

      {Array.isArray(suggestionsUi) && suggestionsUi.length > 0 && (
        <section>
          <div style={sectionTitle}>Suggestions</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {suggestionsUi.map((s: any, i: number) => (
              <button
                key={i}
                onClick={async () => {
                  const ops = (s?.data?.patch || []) as any[];
                  if (ops?.length) await sendPatch?.(ops as any);
                }}
                style={btn}
              >
                {s?.title || "Apply"}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Debug (collapsed) */}
      <details className="details">
        <summary className="summary">Show extracted rules (debug)</summary>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(extracted, null, 2)}</pre>
      </details>
    </div>
  );
}

const label: React.CSSProperties = { display: "grid", gap: 6, fontSize: 14 };
const input: React.CSSProperties = { padding: 8, border: "1px solid #ccc", borderRadius: 8, width: "100%" };
const btn: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", background: "#f7f7f7", cursor: "pointer" };
const row: React.CSSProperties = { display: "flex", alignItems: "center" };
const sectionTitle: React.CSSProperties = { fontWeight: 600, marginBottom: 6 };
const citeBox: React.CSSProperties = { padding: 8, border: "1px solid #eee", borderRadius: 6, background: "#fafafa", marginBottom: 6 };
