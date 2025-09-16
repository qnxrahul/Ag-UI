// // panels/DynamicPanelRenderer.tsx
// import React from "react";
// import type { AppState, PatchOp } from "../state/types";
// import FormSpending from "./FormSpending";
// import RolesSoD from "./RolesSoD";

// export default function DynamicPanelRenderer(
//   props: { state: AppState; sendPatch: (ops: PatchOp[]) => Promise<any> | undefined }
// ) {
//   const { state, sendPatch } = props;
//   const panelIds = (state.panels || []).filter(id => id.startsWith("Panel:"));

//   if (!panelIds.length) return null;

//   return (
//     <>
//       {panelIds.map((pid) => {
//         const cfg = state.panel_configs?.[pid];
//         if (!cfg) return null;
//         const title = cfg.title || pid;

//         let body: React.ReactNode = null;
//         if (cfg.type === "form_spending") {
//           body = <FormSpending panelId={pid} cfg={cfg} sendPatch={sendPatch} />;
//         } else if (cfg.type === "roles_sod") {
//           body = <RolesSoD state={state} panelId={pid} cfg={cfg} sendPatch={sendPatch} />;
//         } else {
//           body = <pre style={{whiteSpace:"pre-wrap"}}>{JSON.stringify(cfg, null, 2)}</pre>;
//         }

//         return (
//           <Card key={pid} title={title}>
//             {body}
//           </Card>
//         );
//       })}
//     </>
//   );
// }

// function Card(props: { title: string; children: any }) {
//   return (
//     <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 16, background: "#fff" }}>
//       <div style={{ fontWeight: 600, marginBottom: 12 }}>{props.title}</div>
//       {props.children}
//     </div>
//   );
// }


// // panels/DynamicPanelRenderer.tsx
// import React from "react";
// import type { AppState, PatchOp } from "../state/types";
// import FormSpending from "./FormSpending";
// import RolesSoD from "./RolesSoD";
// import ApprovalChain from "./ApprovalChain";

// export default function DynamicPanelRenderer(
//   props: { state: AppState; sendPatch: (ops: PatchOp[]) => Promise<any> | undefined }
// ) {
//   const { state, sendPatch } = props;
//   const panelIds = (state.panels || []).filter(id => id.startsWith("Panel:"));

//   if (!panelIds.length) return null;

//   return (
//     <>
//       {panelIds.map((pid) => {
//         const cfg = state.panel_configs?.[pid];
//         if (!cfg) return null;
//         const title = cfg.title || pid;

//         let body: React.ReactNode = null;
//         if (cfg.type === "form_spending") {
//           body = <FormSpending panelId={pid} cfg={cfg} sendPatch={sendPatch} />;
//         } else if (cfg.type === "roles_sod") {
//           body = <RolesSoD state={state} panelId={pid} cfg={cfg} sendPatch={sendPatch} />;
//         } else if (cfg.type === "approval_chain") {
//           body = <ApprovalChain state={state} panelId={pid} cfg={cfg} sendPatch={sendPatch} />;
//         } else {
//           body = <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(cfg, null, 2)}</pre>;
//         }

//         return (
//           <Card key={pid} title={title}>
//             {body}
//           </Card>
//         );
//       })}
//     </>
//   );
// }

// function Card(props: { title: string; children: any }) {
//   return (
//     <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 16, background: "#fff" }}>
//       <div style={{ fontWeight: 600, marginBottom: 12 }}>{props.title}</div>
//       {props.children}
//     </div>
//   );
// }


import React from "react";
import type { AppState, PatchOp } from "../state/types";
import FormSpending from "./FormSpending";
import RolesSoD from "./RolesSoD";
import ApprovalChain from "./ApprovalChain";
import ControlChecklists from "./ControlChecklists";
import ExceptionsTracker from "./ExceptionsTracker";


export default function DynamicPanelRenderer(
  props: { state: AppState; sendPatch: (ops: PatchOp[]) => Promise<any> | undefined }
) {
  const { state, sendPatch } = props;
  const panelIds = (state.panels || []).filter(id => id.startsWith("Panel:"));

  if (!panelIds.length) return null;

  return (
    <>
      {panelIds.map((pid) => {
        const cfg = state.panel_configs?.[pid];
        if (!cfg) return null;
        const title = cfg.title || pid;

        let body: React.ReactNode = null;
        if (cfg.type === "form_spending") {
          body = <FormSpending panelId={pid} cfg={cfg} sendPatch={sendPatch} />;
        } else if (cfg.type === "roles_sod") {
          body = <RolesSoD state={state} panelId={pid} cfg={cfg} sendPatch={sendPatch} />;
        } else if (cfg.type === "approval_chain") {
          body = <ApprovalChain state={state} panelId={pid} cfg={cfg} sendPatch={sendPatch} />;
        } else if (cfg.type === "control_checklists") {
          body = <ControlChecklists state={state} panelId={pid} cfg={cfg} sendPatch={sendPatch} />;
        } else if (cfg.type === "exceptions_tracker") {
          body = <ExceptionsTracker state={state} panelId={pid} cfg={cfg} sendPatch={sendPatch} />;
        } else {
          body = <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(cfg, null, 2)}</pre>;
        }

        return (
          <Card key={pid} title={title}>
            {body}
          </Card>
        );
      })}
    </>
  );
}

function Card(props: { title: string; children: any }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 16, background: "#fff" }}>
      <div style={{ fontWeight: 600, marginBottom: 12 }}>{props.title}</div>
      {props.children}
    </div>
  );
}

