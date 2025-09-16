import { Card, ListGroup, Button } from "react-bootstrap";

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
    <Card className="shadow-sm">
      <Card.Body>
        <Card.Title>Agents</Card.Title>
        <ListGroup variant="flush">
          {AGENTS.map((a: AgentItem) => (
            <ListGroup.Item key={a.title} className="d-flex align-items-center justify-content-between">
              <div>
                <div style={{ fontWeight: 600 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{a.desc}</div>
              </div>
              <Button size="sm" variant="primary" onClick={() => onRun(a.prompt)}>Run</Button>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Card.Body>
    </Card>
  );
}
