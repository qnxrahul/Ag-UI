AG-UI Audit Use Case — Deloitte/Public Filings + Enterprise & Customer Knowledge

Overview
This application demonstrates how to use an AG-UI (Agent Graph UI) architecture to power an audit workflow over public Deloitte materials (Audit Quality / Transparency) and customer financial statements. It merges multiple knowledge sources (Enterprise and Customer) to drive disclosure validation, control calendars, exceptions tracking, roles/SoD, and approval chains, producing structured workflow screens and audit-ready artifacts.

Key Goals
- Prove how AG-UI improves audit processes versus traditional single-agent/chat apps
- Merge Enterprise knowledge (e.g., Deloitte Audit Quality, Transparency) with Customer knowledge (client 10-K/FS) for better grounding
- Generate disclosure checklist questions with domain knowledge (ASC/IFRS)
- Orchestrate multi-agent runs with approval gates and evidence artifacts

What’s Included
- Backend (FastAPI):
  - Context ingestion (file upload and URL fetch), source merging (Enterprise + Customer), retrieval indices
  - Agents: Spending Checker, Roles & SoD, Approval Chain, Control Checklists, Exceptions Tracker, Disclosure Checklist
  - Run orchestration: start runs, approve gates, artifacts export
  - Comparison metrics: AG-UI vs Traditional token/governance snapshot
- Frontend (React):
  - Workflow screens for Chat, Panels (Spending, Roles, Approval, Controls, Exceptions, Disclosure), Context Merge panel
  - Upload with namespace (Enterprise/Customer) and Compare action

Why AG-UI vs Traditional AI
- Parallel multi-agent execution speeds ingestion→parsing→analytics→reporting
- Reproducible runs with frozen context packs, approval gates, and evidence lineage
- Shared blackboard state and ID-based retrieval (token-efficient, source-grounded)
- Role/tool guardrails provide governance and audit defensibility

Architecture (High Level)
- Context Builder: ingest files/URLs, normalize, chunk, and index with metadata
- Retrievers: per-document indices and a merged MultiDocIndex across namespaces
- Agents: focused units creating “panels” via JSON patch edits to AppState
- Orchestrator: run start/status/gate approval, artifacts (e.g., CSV export)

Quick Start
1) Backend
   - Python 3.13+ with pip available
   - Install deps (if needed):
     - pip install fastapi uvicorn sse-starlette python-multipart python-dotenv jsonpatch rank-bm25
   - Run server:
     - uvicorn backend.app:app --host 0.0.0.0 --port 8000
   - Health check: GET http://localhost:8000/health

2) Frontend (existing React)
   - cd frontend
   - npm install
   - set VITE_BACKEND_URL=http://localhost:8000 in environment
   - npm run dev

3) Ingest Knowledge
   - Upload files with namespace selector in the UI (Enterprise or Customer)
     - Accepts .pdf/.txt
   - Or fetch by URL:
     - POST /ingest/url
       {"url":"https://www.deloitte.com/us/en/pages/regulatory/audit-quality.html","namespace":"enterprise"}

4) Merge Sources
   - Click “Add Merge Panel” then in “Context Merge” choose Enterprise+Customer → Merge
   - Agents will prefer the merged retrieval automatically

5) Generate Workflow Screens
   - In Chat: “disclosure checklist” → creates Disclosure Checklist panel with ASC/IFRS questions
   - Other prompts:
     - “control calendar”, “exceptions”, “approval chain”, “spending”, “roles sod”

6) Orchestrate Runs and Gates
   - Start: POST /runs/start (agents, gates configurable)
   - Approve gates: POST /runs/gate/approve
   - Artifacts: GET /runs/artifacts/{run_id} (includes CSV export link)

7) Show AG-UI Advantages
   - GET /compare/metrics → token estimates and governance comparison vs traditional

Endpoints (Selected)
- GET /context/sources → list enterprise/customer sources, merged status
- POST /context/merge → create/update merged index
- POST /context/add_merge_panel → add Context Merge panel
- POST /ingest/upload → file ingest (.pdf/.txt) with namespace
- POST /ingest/url → fetch and index a public URL under namespace
- POST /chat/open, POST /chat/ask → agent-driven panel creation via intents
- POST /runs/start, POST /runs/gate/approve, GET /runs/status, GET /runs/artifacts/{run_id}
- GET /compare/metrics → AG-UI vs Traditional snapshot

Panels (Workflow Screens)
- Context Merge: shows Enterprise/Customer source counts; merges indices
- Disclosure Checklist: domain questions (Revenue ASC606/IFRS15, Segments ASC280/IFRS8, Goodwill ASC350/IAS36, Fair Value ASC820/IFRS13, Leases ASC842/IFRS16, Derivatives ASC815/IFRS9)
- Control Checklists: control calendar groups (Travel, Bank, Credit) with statuses
- Exceptions Tracker: waivers/deviations with status buckets
- Roles & SoD: assignments and conflicts
- Approval Chain: dynamic chain and rules
- Spending Checker: thresholds and required steps

Sample Deloitte Data
- Saved pages under backend/docs/deloitte:
  - deloitte_us_audit_quality.html
  - deloitte_global_transparency_reports.html
  You can fetch PDFs/HTML via /ingest/url and tag as Enterprise; upload client FS as Customer.

Extending Domain Knowledge
- Expand disclosure heuristics (agents/disclosure_checklist.py) with more rules and tags
- Add parsers for XBRL tables and tie-outs; enrich metadata for retrieval filters
- Wire peer/regulator sources (PCAOB, FRC/CPAB) to broaden analytics

Acceptance Criteria
- Disclosure questions render with statuses; user can set PASS/FAIL/OPEN
- Merged retrieval is preferred; both Enterprise and Customer sources count > 0
- Runs can be started and completed with gates approved; artifacts are created
- Compare endpoint returns AG-UI advantages consistently

License/Notes
- Public Deloitte materials are used purely for demo; respect source terms. Replace with your own enterprise data as needed.

