import type { AppState, PatchOp } from "../state/types";

export default function Delegation(props: { state: AppState; sendPatch: (ops: PatchOp[]) => Promise<any> | undefined }) {
  const { state, sendPatch } = props;
  const people = state.delegation.people || [];
  const roles = state.delegation.roles || [];
  const assignments = state.delegation.assignments || {};

  async function addPerson(name: string) {
    if (!name.trim()) return;
    props.sendPatch([{ op: "add", path: "/delegation/people/-", value: name.trim() }]);
  }

  async function setAssignment(role: string, person: string | null) {
    const exists = Object.prototype.hasOwnProperty.call(assignments, role);
    const op = exists ? "replace" : "add";
    props.sendPatch([{ op, path: `/delegation/assignments/${role}`, value: person }]);
  }


  return (
    <div>
      {/* People editor */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input id="newPerson" placeholder="Add person (Enter)" onKeyDown={async (e) => {
          if (e.key === "Enter") { await addPerson((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ""; }
        }} style={inputStyle} />
        <div style={{ fontSize: 12, color: "#666", alignSelf: "center" }}>
          People: {people.length ? people.join(", ") : "(none)"}
        </div>
      </div>

      {/* Assignments grid */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Role</th>
            <th style={th}>Assignee</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={role}>
              <td style={td}>{role}</td>
              <td style={td}>
                <select
                  value={assignments[role] ?? ""}
                  onChange={(e) => setAssignment(role, e.target.value || null)}
                  style={inputStyle}
                >
                  <option value="">(unassigned)</option>
                  {people.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #eee", padding: "8px 6px" };
const td: React.CSSProperties = { borderBottom: "1px solid #f3f3f3", padding: "8px 6px" };
const inputStyle: React.CSSProperties = { padding: 8, border: "1px solid #ccc", borderRadius: 8, width: "100%" };
