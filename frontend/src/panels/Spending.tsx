import { useMemo } from "react";
import type { AppState, PatchOp, Category } from "../state/types";
import Chips from "../components/Chips";

export default function Spending(props: { state: AppState; sendPatch: (ops: PatchOp[]) => Promise<any> | undefined }) {
  const { state, sendPatch } = props;
  const people = state.delegation.people || [];

  async function setAmount(v: string) {
    const num = v === "" ? null : Number(v);
    props.sendPatch([{ op: (state.spend.amount === undefined ? "add" : "replace"), path: "/spend/amount", value: num }]);
  }

  async function setCategory(v: Category | "") {
    const val = v === "" ? null : v;
    props.sendPatch([{ op: (state.spend.category === undefined ? "add" : "replace"), path: "/spend/category", value: val }]);
  }

  async function setRequester(v: string) {
    props.sendPatch([{ op: state.spend.requester === undefined ? "add" : "replace", path: "/spend/requester", value: v || null }]);
  }

  async function setApprover(v: string) {
    props.sendPatch([{ op: state.spend.approver === undefined ? "add" : "replace", path: "/spend/approver", value: v || null }]);
  }


  const steps = state.spend.required_steps || [];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Amount">
          <input type="number" placeholder="e.g., 18000" value={state.spend.amount ?? ""} onChange={(e) => setAmount(e.target.value)}
                 style={inputStyle} />
        </Field>
        <Field label="Category">
          <select value={state.spend.category ?? ""} onChange={(e) => setCategory(e.target.value as Category | "")} style={inputStyle}>
            <option value="">(none)</option>
            <option value="ops">ops</option>
            <option value="asset">asset</option>
            <option value="program">program</option>
          </select>
        </Field>
        <Field label="Requester">
          <select value={state.spend.requester ?? ""} onChange={(e) => setRequester(e.target.value)} style={inputStyle}>
            <option value="">(none)</option>
            {people.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Approver">
          <select value={state.spend.approver ?? ""} onChange={(e) => setApprover(e.target.value)} style={inputStyle}>
            <option value="">(none)</option>
            {people.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Required Steps</div>
        <Chips items={steps} />
      </div>
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
