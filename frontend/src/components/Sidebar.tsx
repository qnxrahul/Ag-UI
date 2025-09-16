

type AgentItem = { title: string; prompt: string; desc: string };

const AGENTS: AgentItem[] = [
  { title: "Spending Checker", prompt: "spending checker", desc: "Extract thresholds & steps; interactive amount." },
  { title: "Roles & SoD", prompt: "roles sod", desc: "Roles, constraints and conflicts; assign people." },
  { title: "Approval Chain", prompt: "approval chain", desc: "Who must approve based on rules." },
  { title: "Control Calendar", prompt: "control calendar", desc: "Bank/credit reconciliations & travel checks." },
  { title: "Exceptions Tracker", prompt: "exceptions", desc: "Waiver pre-reqs: approvals, docs, reporting." },
];

export default function Sidebar({ onRun }: { onRun: (prompt: string) => void }) {
  return (
    <div className="card sidebar" style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>Agents</div>
      <div style={{ display: "grid", gap: 8 }}>
        {AGENTS.map((a) => (
          <button key={a.title} className="agent" onClick={() => onRun(a.prompt)}>
            <h4>{a.title}</h4>
            <p>{a.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
