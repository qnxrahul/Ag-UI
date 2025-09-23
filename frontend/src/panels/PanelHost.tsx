import React from "react";
import type { AppState, PatchOp } from "../state/types";

import RolesSoD from "./RolesSoD";
import ExceptionsTracker from "./ExceptionsTracker";
import FormSpending from "./FormSpending";
import ApprovalChain from "./ApprovalChain";
import ControlChecklists from "./ControlChecklists";
import { Accordion } from "react-bootstrap";
import { ContextAPI } from "../agui/bridge";
import DisclosureChecklist from "./DisclosureChecklist";

export default function PanelHost(props: {
  state: AppState;
  sendPatch: (ops: PatchOp[]) => Promise<any> | undefined;
}) {
  const { state, sendPatch } = props;

  const panelIds: string[] = state.panels || [];

  const lookup = (id: string) => (state.panel_configs as any)?.[id] || null;

  const renderOne = (id: string, cfg: any, idx: number) => {
    if (!cfg) return null;
    const ek = String(idx);
    const wrap = (child: React.ReactNode) => (
      <Accordion.Item key={id} eventKey={ek} className="mb-2">
        <Accordion.Header>{cfg.title || "Panel"}</Accordion.Header>
        <Accordion.Body>
          {child}
        </Accordion.Body>
      </Accordion.Item>
    );
    switch (cfg.type) {
      case "roles_sod":
        return wrap(<RolesSoD state={state} panelId={id} cfg={cfg} sendPatch={sendPatch} />);
      case "exceptions_tracker":
        return wrap(<ExceptionsTracker state={state} panelId={id} cfg={cfg} sendPatch={sendPatch} />);
      case "form_spending":
        return wrap(<FormSpending panelId={id} cfg={cfg} sendPatch={sendPatch} />);
      case "approval_chain":
        return wrap(<ApprovalChain state={state} panelId={id} cfg={cfg} sendPatch={sendPatch} />);
      case "control_checklists":
        return wrap(<ControlChecklists state={state} panelId={id} cfg={cfg} sendPatch={sendPatch} />);
      case "disclosure_checklist":
        return wrap(<DisclosureChecklist panelId={id} cfg={cfg} sendPatch={sendPatch} />);
      case "context_merge":
        return wrap(<ContextMergePanel />);
      default:
        return wrap(<div style={{ color: "#6b7280" }}>(Unsupported panel type)</div>);
    }
  };

  // Uncontrolled accordion; all panels start closed and only one can be open at a time

  return (
    <div className="panel-stack">
      {panelIds.length === 0 ? (
        <div className="card p-3 text-muted">No panels yet. Ask the assistant for a Spending Checker, Roles & SoD, Approval Chain, Control Calendar, or Exceptions.</div>
      ) : (
        <Accordion className="accordion-kpmg">
          {panelIds.map((id, idx) => renderOne(id, lookup(id), idx))}
        </Accordion>
      )}
    </div>
  );
}

function ContextMergePanel() {
  const [loading, setLoading] = React.useState(false);
  const [sources, setSources] = React.useState<{ enterprise: string[]; customer: string[]; merged: boolean } | null>(null);
  const [includeEnt, setIncludeEnt] = React.useState(true);
  const [includeCust, setIncludeCust] = React.useState(true);
  const [name, setName] = React.useState("merged");

  React.useEffect(() => {
    (async () => {
      try {
        const s = await ContextAPI.listSources();
        setSources(s);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const doMerge = async () => {
    setLoading(true);
    try {
      await ContextAPI.merge({ include_enterprise: includeEnt, include_customer: includeCust, name });
      const s = await ContextAPI.listSources();
      setSources(s);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-2">
        <label className="form-label">Merged Index Name</label>
        <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-check">
        <input className="form-check-input" type="checkbox" id="ent" checked={includeEnt} onChange={(e) => setIncludeEnt(e.target.checked)} />
        <label className="form-check-label" htmlFor="ent">Include Enterprise Knowledge</label>
      </div>
      <div className="form-check mb-2">
        <input className="form-check-input" type="checkbox" id="cust" checked={includeCust} onChange={(e) => setIncludeCust(e.target.checked)} />
        <label className="form-check-label" htmlFor="cust">Include Customer Knowledge</label>
      </div>
      <button className="btn btn-primary" disabled={loading} onClick={doMerge}>Merge Sources</button>
      <div className="mt-3 small text-muted">
        {sources ? (
          <>
            <div>Enterprise sources: {sources.enterprise.length}</div>
            <div>Customer sources: {sources.customer.length}</div>
            <div>Merged available: {String(sources.merged)}</div>
          </>
        ) : (
          <div>Loading sources…</div>
        )}
      </div>
    </div>
  );
}
