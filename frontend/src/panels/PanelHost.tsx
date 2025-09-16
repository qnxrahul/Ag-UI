import React from "react";
import type { AppState, PatchOp } from "../state/types";

import RolesSoD from "./RolesSoD";
import ExceptionsTracker from "./ExceptionsTracker";
import FormSpending from "./FormSpending";
import ApprovalChain from "./ApprovalChain";
import ControlChecklists from "./ControlChecklists";
import { Card } from "react-bootstrap";

export default function PanelHost(props: {
  state: AppState;
  sendPatch: (ops: PatchOp[]) => Promise<any> | undefined;
}) {
  const { state, sendPatch } = props;

  const panelIds: string[] = state.panels || [];

  const lookup = (id: string) => (state.panel_configs as any)?.[id] || null;

  const renderOne = (id: string, cfg: any) => {
    if (!cfg) return null;
    const wrap = (child: React.ReactNode) => (
      <Card key={id} className="mb-3 shadow-sm">
        <Card.Header>{cfg.title || "Panel"}</Card.Header>
        <Card.Body>{child}</Card.Body>
      </Card>
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
      default:
        return wrap(<div style={{ color: "#6b7280" }}>(Unsupported panel type)</div>);
    }
  };

  return (
    <div className="panel-stack">
      {panelIds.length === 0 ? (
        <Card className="p-3 text-muted">No panels yet. Ask the assistant for a Spending Checker, Roles & SoD, Approval Chain, Control Calendar, or Exceptions.</Card>
      ) : (
        panelIds.map((id) => renderOne(id, lookup(id)))
      )}
    </div>
  );
}
