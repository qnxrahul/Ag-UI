import { Card, Button, Row, Col } from "react-bootstrap";

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
        <Row className="g-2">
          {AGENTS.map((a: AgentItem) => (
            <Col key={a.title} xs={12} sm={6} md={12}>
              <Card className="border-0" style={{ background: "linear-gradient(180deg,#f8fafc,#eef2ff)" }}>
                <Card.Body className="d-flex align-items-center justify-content-between">
                  <div>
                    <div style={{ fontWeight: 600 }}>{a.title}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{a.desc}</div>
                  </div>
                  <Button size="sm" variant="primary" onClick={() => onRun(a.prompt)}>
                    Run
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Card.Body>
    </Card>
  );
}
