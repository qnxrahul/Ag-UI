// // panels/RolesSoD.tsx
// import React from "react";
// import type { AppState, PatchOp } from "../state/types";

// export default function RolesSoD(
//   props: { state: AppState; panelId: string; cfg: any; sendPatch: (ops: PatchOp[]) => Promise<any> | undefined }
// ) {
//   const { state, panelId, cfg, sendPatch } = props;
//   const people: string[] = state.delegation?.people || [];
//   const controls = cfg.controls || {};
//   const assigns = controls.assignments || {};
//   const data = cfg.data || {};
//   const violations = data.violations || [];
//   const citations = data.citations || [];
//   const extracted = data.extracted || {};

//   const setAssign = async (role: string, person: string | null) => {
//     const path = `/panel_configs/${panelId}/controls/assignments/${role}`;
//     const exists = assigns[role] !== undefined;
//     await sendPatch([{ op: exists ? "replace" : "add", path, value: person }]);
//   };

//   return (
//     <div style={{ display:"grid", gap:12 }}>
//       <table style={{ width:"100%", borderCollapse:"collapse" }}>
//         <thead>
//           <tr><th style={th}>Role</th><th style={th}>Assignee</th></tr>
//         </thead>
//         <tbody>
//           {["Spending","Payment","ChequeSigning"].map((r) => (
//             <tr key={r}>
//               <td style={td}>{r}</td>
//               <td style={td}>
//                 <select value={assigns[r] ?? ""} onChange={(e)=>setAssign(r, e.target.value || null)} style={inputStyle}>
//                   <option value="">(unassigned)</option>
//                   {people.map((p) => <option key={p} value={p}>{p}</option>)}
//                 </select>
//               </td>
//             </tr>
//           ))}
//         </tbody>
//       </table>

//       <div>
//         <div style={{ fontWeight:600, marginBottom:6 }}>Conflicts</div>
//         {violations.length === 0
//           ? <div style={{ color:"#888" }}>(none)</div>
//           : <ul style={{ margin:0, paddingLeft:18 }}>
//               {violations.map((v:any, i:number) => (
//                 <li key={i}><strong>{v.code}:</strong> {v.message}</li>
//               ))}
//             </ul>}
//       </div>

//       <div>
//         <div style={{ fontWeight:600, marginBottom:6 }}>Citations</div>
//         {citations?.length
//           ? citations.map((c:any, idx:number) => (
//               <div key={idx} style={{ padding:8, border:"1px solid #eee", borderRadius:6, background:"#fafafa", marginBottom:6 }}>
//                 <div style={{ fontSize:12, color:"#666", marginBottom:4 }}><strong>{c.key}</strong></div>
//                 <div style={{ whiteSpace:"pre-wrap" }}>{c.snippet || "(no snippet)"}</div>
//               </div>
//             ))
//           : <div style={{ color:"#888" }}>(no citations)</div>}
//       </div>

//       <details>
//         <summary style={{ cursor:"pointer", color:"#555" }}>Show extracted rules (debug)</summary>
//         <pre style={{ whiteSpace:"pre-wrap" }}>{JSON.stringify(extracted, null, 2)}</pre>
//       </details>
//     </div>
//   );
// }

// const th: React.CSSProperties = { textAlign:"left", borderBottom:"1px solid #eee", padding:"8px 6px" };
// const td: React.CSSProperties = { borderBottom:"1px solid #f3f3f3", padding:"8px 6px" };
// const inputStyle: React.CSSProperties = { padding:8, border:"1px solid #ccc", borderRadius:8, width:"100%" };


// // panels/RolesSoD.tsx
// import React from "react";
// import type { AppState, PatchOp } from "../state/types";

// export default function RolesSoD(
//   props: { state: AppState; panelId: string; cfg: any; sendPatch: (ops: PatchOp[]) => Promise<any> | undefined }
// ) {
//   const { state, panelId, cfg, sendPatch } = props;
//   const people: string[] = state.delegation?.people || [];
//   const controls = cfg.controls || {};
//   const assigns = controls.assignments || {};
//   const data = cfg.data || {};
//   const violations = data.violations || [];
//   const citations = data.citations || [];
//   const extracted = data.extracted || {};

//   const setAssign = async (role: string, person: string | null) => {
//     const path = `/panel_configs/${panelId}/controls/assignments/${role}`;
//     const exists = assigns[role] !== undefined;
//     await sendPatch([{ op: exists ? "replace" : "add", path, value: person }]);
//   };

//   const roleList: string[] =
//     (cfg?.data?.extracted?.roles as string[]) ||
//     Object.keys((cfg?.controls?.assignments) || {}) ||
//     [];

//   return (
//     <div style={{ display: "grid", gap: 12 }}>
//       <table style={{ width: "100%", borderCollapse: "collapse" }}>
//         <thead>
//           <tr>
//             <th style={th}>Role</th>
//             <th style={th}>Assignee</th>
//           </tr>
//         </thead>
//         <tbody>
//           {roleList.map((r) => (
//             <tr key={r}>
//               <td style={td}>{r}</td>
//               <td style={td}>
//                 <select
//                   value={assigns[r] ?? ""}
//                   onChange={(e) => setAssign(r, e.target.value || null)}
//                   style={inputStyle}
//                 >
//                   <option value="">(unassigned)</option>
//                   {people.map((p) => (
//                     <option key={p} value={p}>
//                       {p}
//                     </option>
//                   ))}
//                 </select>
//               </td>
//             </tr>
//           ))}
//         </tbody>
//       </table>

//       <div>
//         <div style={{ fontWeight: 600, marginBottom: 6 }}>Conflicts</div>
//         {violations.length === 0 ? (
//           <div style={{ color: "#888" }}>(none)</div>
//         ) : (
//           <ul style={{ margin: 0, paddingLeft: 18 }}>
//             {violations.map((v: any, i: number) => (
//               <li key={i}>
//                 <strong>{v.code}:</strong> {v.message}
//               </li>
//             ))}
//           </ul>
//         )}
//       </div>

//       <div>
//         <div style={{ fontWeight: 600, marginBottom: 6 }}>Citations</div>
//         {citations?.length ? (
//           citations.map((c: any, idx: number) => (
//             <div
//               key={idx}
//               style={{
//                 padding: 8,
//                 border: "1px solid #eee",
//                 borderRadius: 6,
//                 background: "#fafafa",
//                 marginBottom: 6,
//               }}
//             >
//               <div
//                 style={{
//                   fontSize: 12,
//                   color: "#666",
//                   marginBottom: 4,
//                 }}
//               >
//                 <strong>{c.key}</strong>
//               </div>
//               <div style={{ whiteSpace: "pre-wrap" }}>
//                 {c.snippet || "(no snippet)"}
//               </div>
//             </div>
//           ))
//         ) : (
//           <div style={{ color: "#888" }}>(no citations)</div>
//         )}
//       </div>

//       <details>
//         <summary style={{ cursor: "pointer", color: "#555" }}>
//           Show extracted rules (debug)
//         </summary>
//         <pre style={{ whiteSpace: "pre-wrap" }}>
//           {JSON.stringify(extracted, null, 2)}
//         </pre>
//       </details>
//     </div>
//   );
// }

// const th: React.CSSProperties = {
//   textAlign: "left",
//   borderBottom: "1px solid #eee",
//   padding: "8px 6px",
// };
// const td: React.CSSProperties = {
//   borderBottom: "1px solid #f3f3f3",
//   padding: "8px 6px",
// };
// const inputStyle: React.CSSProperties = {
//   padding: 8,
//   border: "1px solid #ccc",
//   borderRadius: 8,
//   width: "100%",
// };

// // panels/RolesSoD.tsx
// import React, { useState } from "react";
// import type { AppState, PatchOp } from "../state/types";

// export default function RolesSoD(
//   props: {
//     state: AppState;
//     panelId: string;
//     cfg: any;
//     sendPatch: (ops: PatchOp[]) => Promise<any> | undefined;
//   }
// ) {
//   const { state, panelId, cfg, sendPatch } = props;
//   const people: string[] = state.delegation?.people || [];
//   const [newPerson, setNewPerson] = useState("");
//   const controls = cfg.controls || {};
//   const assigns = controls.assignments || {};
//   const data = cfg.data || {};
//   const violations = data.violations || [];
//   const citations = data.citations || [];
//   const extracted = data.extracted || {};

//   const addPerson = async () => {
//     const name = newPerson.trim();
//     if (!name) return;

//     // de-dupe (case-insensitive)
//     const exists = people.some(p => p.toLowerCase() === name.toLowerCase());
//     if (exists) { setNewPerson(""); return; }

//     const next = [...people, name];

//     // Replace whole array -> avoids duplicate caused by optimistic + SSE echo
//     await sendPatch([{ op: "replace", path: "/delegation/people", value: next }]);
//     setNewPerson("");
//   };


//   function escapeJsonPointer(seg: string) {
//     return seg.replace(/~/g, "~0").replace(/\//g, "~1");
//   }

//   const setAssign = async (role: string, person: string | null) => {
//     const escaped = escapeJsonPointer(role);
//     const path = `/panel_configs/${panelId}/controls/assignments/${escaped}`;
//     const exists = assigns[role] !== undefined;
//     await sendPatch([{ op: exists ? "replace" : "add", path, value: person }]);
//   };


//   const roleList: string[] =
//     (cfg?.data?.extracted?.roles as string[]) ||
//     Object.keys((cfg?.controls?.assignments) || {}) ||
//     [];

//   return (
//     <div style={{ display: "grid", gap: 12 }}>
//       {/* Add person */}
//       <div style={{ display: "flex", gap: 8 }}>
//         <input
//           placeholder="Add person"
//           value={newPerson}
//           onChange={(e) => setNewPerson(e.target.value)}
//           onKeyDown={(e) => {
//             if (e.key === "Enter") addPerson();
//           }}
//           style={inputStyle}
//         />
//         <button
//           onClick={addPerson}
//           style={{
//             padding: "8px 12px",
//             borderRadius: 8,
//             border: "1px solid #ccc",
//             background: "#f7f7f7",
//             cursor: "pointer",
//           }}
//         >
//           Add person
//         </button>
//         <div style={{ alignSelf: "center", fontSize: 12, color: "#666" }}>
//           People: {people.length ? people.join(", ") : "(none)"}
//         </div>
//       </div>

//       <table style={{ width: "100%", borderCollapse: "collapse" }}>
//         <thead>
//           <tr>
//             <th style={th}>Role</th>
//             <th style={th}>Assignee</th>
//           </tr>
//         </thead>
//         <tbody>
//           {roleList.map((r) => (
//             <tr key={r}>
//               <td style={td}>{r}</td>
//               <td style={td}>
//                 <select
//                   value={assigns[r] ?? ""}
//                   onChange={(e) => setAssign(r, e.target.value || null)}
//                   style={inputStyle}
//                 >
//                   <option value="">(unassigned)</option>
//                   {people.map((p) => (
//                     <option key={p} value={p}>
//                       {p}
//                     </option>
//                   ))}
//                 </select>
//               </td>
//             </tr>
//           ))}
//         </tbody>
//       </table>

//       <div>
//         <div style={{ fontWeight: 600, marginBottom: 6 }}>Conflicts</div>
//         {violations.length === 0 ? (
//           <div style={{ color: "#888" }}>(none)</div>
//         ) : (
//           <ul style={{ margin: 0, paddingLeft: 18 }}>
//             {violations.map((v: any, i: number) => (
//               <li key={i}>
//                 <strong>{v.code}:</strong> {v.message}
//               </li>
//             ))}
//           </ul>
//         )}
//       </div>

//       <div>
//         <div style={{ fontWeight: 600, marginBottom: 6 }}>Citations</div>
//         {citations?.length ? (
//           citations.map((c: any, idx: number) => (
//             <div
//               key={idx}
//               style={{
//                 padding: 8,
//                 border: "1px solid #eee",
//                 borderRadius: 6,
//                 background: "#fafafa",
//                 marginBottom: 6,
//               }}
//             >
//               <div
//                 style={{
//                   fontSize: 12,
//                   color: "#666",
//                   marginBottom: 4,
//                 }}
//               >
//                 <strong>{c.key}</strong>
//               </div>
//               <div style={{ whiteSpace: "pre-wrap" }}>
//                 {c.snippet || "(no snippet)"}
//               </div>
//             </div>
//           ))
//         ) : (
//           <div style={{ color: "#888" }}>(no citations)</div>
//         )}
//       </div>

//       <details>
//         <summary style={{ cursor: "pointer", color: "#555" }}>
//           Show extracted rules (debug)
//         </summary>
//         <pre style={{ whiteSpace: "pre-wrap" }}>
//           {JSON.stringify(extracted, null, 2)}
//         </pre>
//       </details>
//     </div>
//   );
// }

// const th: React.CSSProperties = {
//   textAlign: "left",
//   borderBottom: "1px solid #eee",
//   padding: "8px 6px",
// };
// const td: React.CSSProperties = {
//   borderBottom: "1px solid #f3f3f3",
//   padding: "8px 6px",
// };
// const inputStyle: React.CSSProperties = {
//   padding: 8,
//   border: "1px solid #ccc",
//   borderRadius: 8,
//   width: "100%",
// };


import React, { useState } from "react";
import type { AppState, PatchOp } from "../state/types";

export default function RolesSoD(
  props: {
    state: AppState;
    panelId: string;
    cfg: any;
    sendPatch: (ops: PatchOp[]) => Promise<any> | undefined;
  }
) {
  const { state, panelId, cfg, sendPatch } = props;
  const people: string[] = state.delegation?.people || [];
  const [newPerson, setNewPerson] = useState("");
  const controls = cfg.controls || {};
  const assigns = controls.assignments || {};
  const data = cfg.data || {};
  const violations = data.violations || [];
  const citations = data.citations || [];
  const extracted = data.extracted || {};

  const addPerson = async () => {
    const name = newPerson.trim();
    if (!name) return;

    const exists = people.some((p) => p.toLowerCase() === name.toLowerCase());
    if (exists) {
      setNewPerson("");
      return;
    }
    const next = [...people, name];

    await sendPatch([{ op: "replace", path: "/delegation/people", value: next }]);
    setNewPerson("");
  };

  function escapeJsonPointer(seg: string) {
    return seg.replace(/~/g, "~0").replace(/\//g, "~1");
  }

  const setAssign = async (role: string, person: string | null) => {
    const escaped = escapeJsonPointer(role);
    const path = `/panel_configs/${panelId}/controls/assignments/${escaped}`;
    const exists = assigns[role] !== undefined;
    await sendPatch([{ op: exists ? "replace" : "add", path, value: person }]);
  };

  const roleList: string[] =
    (cfg?.data?.extracted?.roles as string[]) ||
    Object.keys((cfg?.controls?.assignments) || {}) ||
    [];

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Add person */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          placeholder="Add person"
          value={newPerson}
          onChange={(e) => setNewPerson(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addPerson();
          }}
          style={inputStyle}
        />
        <button
          onClick={addPerson}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "#f7f7f7",
            cursor: "pointer",
          }}
        >
          Add person
        </button>
        <div style={{ alignSelf: "center", fontSize: 12, color: "#666" }}>
          People: {people.length ? people.join(", ") : "(none)"}
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Role</th>
            <th style={th}>Assignee</th>
          </tr>
        </thead>
        <tbody>
          {roleList.map((r) => (
            <tr key={r}>
              <td style={td}>{r}</td>
              <td style={td}>
                <select
                  value={assigns[r] ?? ""}
                  onChange={(e) => setAssign(r, e.target.value || null)}
                  style={inputStyle}
                >
                  <option value="">(unassigned)</option>
                  {people.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Conflicts</div>
        {violations.length === 0 ? (
          <div style={{ color: "#888" }}>(none)</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {violations.map((v: any, i: number) => (
              <li key={i}>
                <strong>{v.code}:</strong> {v.message}
              </li>
            ))}
          </ul>
        )}
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
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
                <strong>{c.key}</strong>
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>
                {c.snippet || "(no snippet)"}
              </div>
            </div>
          ))
        ) : (
          <div style={{ color: "#888" }}>(no citations)</div>
        )}
      </details>

      {/* Debug JSON (collapsed) */}
      <details className="details">
        <summary className="summary">Show extracted rules (debug)</summary>
        <pre style={{ whiteSpace: "pre-wrap" }}>
          {JSON.stringify(extracted, null, 2)}
        </pre>
      </details>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #eee",
  padding: "8px 6px",
};
const td: React.CSSProperties = {
  borderBottom: "1px solid #f3f3f3",
  padding: "8px 6px",
};
const inputStyle: React.CSSProperties = {
  padding: 8,
  border: "1px solid #ccc",
  borderRadius: 8,
  width: "100%",
};
