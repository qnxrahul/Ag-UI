import { useEffect, useRef, useState } from "react";
import { AguiClient, BASE_URL } from "./agui/bridge";
import type { AppState, PatchOp } from "./state/types";
// Legacy imports retained elsewhere if needed


import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import PanelHost from "./panels/PanelHost";

import { Container, Navbar, Button, Form, Row, Col } from "react-bootstrap";



// export default function App() {
//   const [state, setState] = useState<AppState | null>(null);
//   const [uploadInfo, setUploadInfo] = useState<{ docName?: string; threshold?: number; roles?: string[] }>({});
//   const clientRef = useRef<AguiClient | null>(null);

//   useEffect(() => {
//     const client = new AguiClient(setState);
//     clientRef.current = client;
//     client.connect();
//     return () => client.disconnect();
//   }, []);

//   const initialized = !!state;

//   async function softInit() {
//     try {
//       const ops: PatchOp[] = [
//         { op: state?.panels?.length ? "replace" : "add", path: "/panels", value: ["SpendingTriage", "DelegationMatrix"] },

//         ...(state?.delegation?.people?.length ? [] : [
//           { op: "replace", path: "/delegation/people", value: ["Alex", "Priya", "Sam"] }
//         ]),
//         ...(state?.delegation?.roles?.length ? [] : [
//           { op: "replace", path: "/delegation/roles", value: ["Spending", "Payment", "BankReconciliation"] }
//         ]),

//         ...(state?.panel_configs?.SpendingTriage ? [] : [{
//           op: "add", path: "/panel_configs/SpendingTriage",
//           value: { fields: ["amount", "category", "requester", "approver", "flags"], chips: "required_steps", showViolations: true }
//         }])
//       ];
//       if (ops.length) await clientRef.current?.sendPatch(ops);
//     } catch (e) {
//       alert((e as Error).message);
//     }
//   }

//   async function exportCsv() {
//     try {
//       await clientRef.current?.exportCsv();
//     } catch (e) {
//       alert((e as Error).message);
//     }
//   }

//   const lastExportUrl = state?.meta?.last_export_url
//     ? `${BASE_URL}${state.meta.last_export_url}?v=${Math.floor(state.meta.server_timestamp ?? 0)}`
//     : null;
    
//   return (
//     <div style={{ padding: 20 }}>
//       <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
//         <h1 style={{ fontSize: 22, fontWeight: 700 }}>AG-UI PoC Dashboard</h1>
//         <div>
//           <input
//             id="fileInput"
//             type="file"
//             accept=".pdf,.txt"
//             onChange={async (e) => {
//               const f = e.target.files?.[0];
//               if (!f) return;
//               try {
//                 const form = new FormData();
//                 form.append("file", f);
//                 form.append("kind", "auto"); 
//                 const res = await fetch(`${BASE_URL}/ingest/upload`, { method: "POST", body: form });
//                 const data = await res.json();
//                 if (!res.ok) throw new Error(data?.error || "Upload failed");

//                 setUploadInfo({
//                   docName: data.docName,
//                   threshold: data.spend_threshold,
//                   roles: data.roles || []
//                 });

//                 await softInit();
//               } catch (err) {
//                 alert((err as Error).message);
//               } finally {
//                 (e.target as HTMLInputElement).value = "";
//               }
//             }}
//             style={{ marginRight: 8 }}
//           />
//           <button onClick={softInit} style={btnStyle}>
//             Initialize demo
//           </button>
//           <button onClick={exportCsv} style={{ ...btnStyle, marginLeft: 8 }}>
//             Export CSV
//           </button>
//           {lastExportUrl && (
//             <a
//               href={lastExportUrl}
//               target="_blank"
//               rel="noreferrer"
//               style={{ marginLeft: 12, textDecoration: "underline" }}
//             >
//               Download last export
//             </a>
//           )}
//         </div>
//       </header>

//       {uploadInfo?.docName && (
//         <Banner>
//           <div>
//             <strong>Loaded document:</strong> {uploadInfo.docName}
//             {typeof uploadInfo.threshold !== "undefined" && <> &nbsp;·&nbsp; <strong>Threshold:</strong> {uploadInfo.threshold}</>}
//             {uploadInfo.roles && uploadInfo.roles.length > 0 && <> &nbsp;·&nbsp; <strong>Roles:</strong> {uploadInfo.roles.join(", ")}</>}
//           </div>
//           <div style={{ fontSize: 12, color: "#355" }}>
//             Evidence is shown below and stays until you upload a new document.
//           </div>
//         </Banner>
//       )}

//       {initialized && state && (
//         <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 20, marginTop: 20 }}>
//           <div style={{ height: "calc(100vh - 140px)", position:"sticky", top: 20 }}>
//             <Card title="Conversational Assistant">
//               <Chat client={clientRef.current} />
//             </Card>
//           </div>

//           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
//             {uploadInfo?.docName && (
//               <Card title="Policy Evidence (extracted from document)">
//                 <PolicyEvidence citations={state.citations} />
//               </Card>
//             )}

//             <Card title="Spending">
//               <Spending state={state} sendPatch={(ops) => clientRef.current?.sendPatch(ops)} />
//             </Card>

//             <Card title="Delegation">
//               <Delegation state={state} sendPatch={(ops) => clientRef.current?.sendPatch(ops)} />
//             </Card>

//             <Card title="Violations">
//               <Violations violations={state.violations} />
//             </Card>

//             {/* Dynamic agent-driven panels */}
//             <DynamicPanelRenderer state={state} sendPatch={(ops) => clientRef.current?.sendPatch(ops)} />
//           </div>
//         </div>
//       )}

//     </div>
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

// const btnStyle: React.CSSProperties = {
//   padding: "8px 12px",
//   borderRadius: 8,
//   border: "1px solid #ccc",
//   cursor: "pointer",
//   background: "#f7f7f7",
// };

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [docName, setDocName] = useState<string>("");
  const clientRef = useRef<AguiClient | null>(null);

  useEffect(() => {
    const client = new AguiClient(setState);
    clientRef.current = client;
    client.connect();
    return () => client.disconnect();
  }, []);

  useEffect(() => {
    if (state?.meta?.docName) setDocName(state.meta.docName);
  }, [state?.meta?.docName]);

  const sendPatch = (ops: PatchOp[]) => clientRef.current?.sendPatch(ops);

  async function softInit() {
    try {
      const ops: PatchOp[] = [
        { op: state?.panels?.length ? "replace" : "add", path: "/panels", value: [] }
      ];
      if (ops.length) await sendPatch(ops);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function exportCsv() {
    try { await clientRef.current?.exportCsv(); } catch (e) { alert((e as Error).message); }
  }

  // helper for sidebar clicks 
  async function runAgentPrompt(p: string) {
    try {
      await fetch(`${BASE_URL}/chat/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p })
      });
    } catch (e) { /* no-op; UI listens via SSE */ }
  }

  const lastExportUrl = state?.meta?.last_export_url
    ? `${BASE_URL}${state.meta.last_export_url}?v=${Math.floor(state.meta.server_timestamp ?? 0)}`
    : null;

  return (
    <>
      <Navbar className="mb-2 nav-gradient" expand="md" variant="dark">
        <Container fluid>
          <Navbar.Brand style={{ fontWeight: 800, letterSpacing: 0.2 }}>AG-UI PoC Dashboard</Navbar.Brand>
          <Form className="d-flex align-items-center gap-2">
            <Form.Control
              type="file"
              size="sm"
              accept=".pdf,.txt"
              onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                const f = e.target.files?.[0]; if (!f) return;
                try {
                  const form = new FormData();
                  form.append("file", f);
                  form.append("kind", "auto");
                  const res = await fetch(`${BASE_URL}/ingest/upload`, { method: "POST", body: form });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data?.error || "Upload failed");
                  setDocName(data.docName || f.name);
                  await softInit();
                } catch (err) { alert((err as Error).message); }
                finally { e.target.value = ""; }
              }}
              style={{ maxWidth: 260 }}
            />
            <Button className="btn-glow" size="sm" onClick={softInit}>Initialize</Button>
            <Button className="btn-glow" size="sm" onClick={exportCsv}>Export CSV</Button>
            {lastExportUrl && (
              <Button as="a" href={lastExportUrl} target="_blank" rel="noreferrer" variant="light" size="sm" style={{ opacity:.9 }}>
                Download last export
              </Button>
            )}
          </Form>
        </Container>
      </Navbar>

      {docName && (
        <Container fluid className="mb-2">
          <div className="alert alert-info py-2 mb-2">
            <strong>Loaded document:</strong> {docName}
          </div>
        </Container>
      )}

      <Container fluid>
        <Row className="g-3">
          <Col xs={12} md={3} lg={3} xl={3}>
            <Sidebar onRun={runAgentPrompt} />
          </Col>
          <Col xs={12} md={4} lg={4} xl={4}>
            <ChatWindow />
          </Col>
          <Col xs={12} md={5} lg={5} xl={5}>
            {state ? (
              <PanelHost state={state} sendPatch={sendPatch!} />
            ) : (
              <div className="card p-3">(connecting…)</div>
            )}
          </Col>
        </Row>
      </Container>
    </>
  );
}