# Shirube

Agent Control Plane for turning missions into evidence-backed outcomes and continuously improving agent execution.

```text
Shirube          WHY / WHAT / LEARNING
Wacha            WORK
Ralph            repeated Worker / Reviewer execution
agent-foundation HOW
```

Shirube keeps upstream intent and the improvement trail outside product repositories so humans can inspect the same durable state that agents use through MCP.

## Current MVP

The initial implementation includes:

- Project
- Mission
- Research / Evidence
- Decision
- Vision
- Outcome
- Human Decision Request
- provenance relations (`derived_from`, `supported_by`, etc.)
- append-only Change Log
- Manager Work claim / lease
- Agent Run history with an optional pinned `foundationRef`
- Improvement Observation / Finding / Proposal / Evaluation
- HTTP API
- stateless MCP endpoint
- minimal Browser UI
- a small Manager Runner

Worker and Reviewer execution are intentionally **not** included. They remain separate Ralph loops driven by Wacha.

## Architecture

```text
Human
  |
Browser
  v
+----------------------+
| Shirube              |
| UI / API / MCP / DB  |
|                      |
| Mission -> Outcome   |
| Improvement          |
+----------+-----------+
           |
      Manager Work
           v
+----------------------+
| Manager Runner       |
| launches Manager only|
+----------+-----------+
           |
           v
      Manager Agent
       /       \
  MCP /         \ MCP
     v           v
 Shirube        Wacha
                  |
             Worker Ralph
             Reviewer Ralph

agent-foundation -> Skills / Instructions / Policy / Profiles used by agents
```

See [`docs/initial-design.md`](docs/initial-design.md) for the detailed domain and integration design.

## Stack

Shirube intentionally follows Wacha's implementation family:

- TypeScript
- Hono
- SQLite (`better-sqlite3`)
- React + Vite
- Model Context Protocol SDK
- Zod

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

- API / MCP server: `http://localhost:51740`
- Browser UI (development): `http://localhost:51744`
- MCP: `http://localhost:51740/mcp`
- Health: `http://localhost:51740/health`

Production-style build:

```bash
npm run build
npm start
```

The frontend is built into `public/` and served by the Hono server.

## First use

Open `/projects` to see the Project list. Create a Project from `/projects/new`;
after creation, Shirube opens `/projects/:projectId`, where Missions can be added.

`foundationRef` is optional. When agent-foundation is used, it must identify an
immutable Git commit, for example
`https://github.com/example/agent-foundation.git#<40-character commit SHA>`.

Creating a Mission automatically creates `ManagerWork` with reason:

```text
MISSION_REVIEW_REQUIRED
```

This is the wake-up signal for the Manager Runner.

## MCP

The MCP endpoint is stateless and currently assumes a trusted local environment like Wacha's initial adapter.

Use:

```http
Authorization: Bearer <AgentName>
```

Initial tools include:

```text
list_projects
get_project_overview
create_mission
record_research
record_evidence
record_decision
create_vision
create_outcome
request_human_decision
link_artifacts
record_improvement_observation
create_improvement_finding
create_improvement_proposal
record_improvement_evaluation
list_changes
```

Durable Research / Evidence / Decision artifacts are the source of truth. Chat history is not.

## Manager Runner

The Manager Runner watches only Shirube's Manager Work. It does not launch Worker or Reviewer processes.

Configure a command:

```bash
export MANAGER_COMMAND='codex exec "Handle the Shirube manager work identified by SHIRUBE_MANAGER_WORK_ID."'
npm run manager-runner
```

Each run receives environment variables including:

```text
SHIRUBE_MANAGER_WORK_ID
SHIRUBE_PROJECT_ID
SHIRUBE_SUBJECT_TYPE
SHIRUBE_SUBJECT_ID
SHIRUBE_REASON_TYPE
SHIRUBE_AGENT_RUN_ID
SHIRUBE_FOUNDATION_REF  # set only when the Project configures agent-foundation
SHIRUBE_MANAGER_PROFILE
```

When configured, `foundationRef` is recorded on the Agent Run so later behavior
changes can be traced and rolled back.

## Improvement loop

Improvement is a required closed loop:

```text
Run / Wacha Result / Outcome Result
  -> Observation
  -> Finding
  -> Proposal
  -> Evaluation
  -> Project Context or agent-foundation
  -> next Run
```

Generalizable changes should not be written directly to agent-foundation by Shirube. The intended path is:

```text
Improvement Proposal
  -> Wacha Story in agent-foundation project
  -> Worker Ralph
  -> Reviewer Ralph
  -> Manager acceptance
  -> agent-foundation release
  -> Shirube adopts pinned foundationRef
```

## Tests

```bash
npm test
```

The first tests cover Mission wake-up and provenance linking.
