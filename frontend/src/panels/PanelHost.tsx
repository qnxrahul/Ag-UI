import React, { useEffect, useRef, useState } from "react";
import type { AppState, PatchOp } from "../state/types";

import RolesSoD from "./RolesSoD";
import ExceptionsTracker from "./ExceptionsTracker";
import FormSpending from "./FormSpending";
import ApprovalChain from "./ApprovalChain";
import ControlChecklists from "./ControlChecklists";
import { Accordion } from "react-bootstrap";

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
      default:
        return wrap(<div style={{ color: "#6b7280" }}>(Unsupported panel type)</div>);
    }
  };

  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const prevCount = useRef<number>(0);

  useEffect(() => {
    const validKeys = panelIds.map((_, idx) => String(idx));
    if (prevCount.current === 0 && panelIds.length > 0) {
      // First time panels appear: open the first, keep others closed
      setActiveKeys(["0"]);
    } else {
      // Preserve current open panels, but prune removed indices; new ones remain closed
      setActiveKeys((prev) => prev.filter((k) => validKeys.includes(k)));
    }
    prevCount.current = panelIds.length;
  }, [panelIds]);

  return (
    <div className="panel-stack">
      {panelIds.length === 0 ? (
        <div className="card p-3 text-muted">No panels yet. Ask the assistant for a Spending Checker, Roles & SoD, Approval Chain, Control Calendar, or Exceptions.</div>
      ) : (
        <Accordion alwaysOpen activeKey={activeKeys} onSelect={(k) => {
          if (typeof k === "string") {
            setActiveKeys((prev) => prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]);
          }
        }} className="accordion-kpmg">
          {panelIds.map((id, idx) => renderOne(id, lookup(id), idx))}
        </Accordion>
      )}
    </div>
  );
}
