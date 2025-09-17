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
    <Card className="shadow-sm sticky-panel">
      <Card.Body>
        <Card.Title>Agents</Card.Title>
        <Row className="g-1">
          {AGENTS.map((a: AgentItem) => (
            <Col key={a.title} xs={12} sm={6} md={12}>
              <Card className="border-0 agent-card">
                <Card.Body className="d-flex align-items-center justify-content-between py-2 px-2">
                  <div className="text-truncate" style={{ minWidth: 0 }}>
                    <div className="text-truncate" style={{ fontWeight: 600, fontSize: 13, lineHeight: "16px" }}>{a.title}</div>
                    <div className="text-muted d-none d-lg-block text-truncate" style={{ fontSize: 11, lineHeight: "14px", maxWidth: 220 }}>{a.desc}</div>
                  </div>
                  <Button size="sm" variant="primary" style={{ padding: "4px 10px", borderRadius: 9999 }} onClick={() => onRun(a.prompt)}>
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
