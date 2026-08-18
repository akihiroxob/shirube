# shirube

Agent Control Plane for turning missions into evidence-backed outcomes and continuously improving agent execution.

## Role in the agent system

```text
Shirube          WHY / WHAT / LEARNING
Wacha            WORK
Ralph            REPEATED WORK EXECUTION
agent-foundation HOW
Product repo     IMPLEMENTATION ARTIFACTS
```

Shirube manages the durable upstream and learning state around agent execution.

```text
Mission
  -> Research / Evidence
  -> Decision
  -> Vision
  -> Outcome
  -> Wacha
  -> Result
  -> Outcome Evaluation
  -> Improvement
```

The primary goal is traceability: a human should be able to inspect why a Vision, Outcome, Wacha Story, or improvement exists and follow its supporting evidence and decisions.

## High-level architecture

```text
Human
  |
Browser
  |
  v
Shirube Server
  - Web UI
  - HTTP API
  - MCP
  - Database
  - Change Log
  |
  | Manager work
  v
Manager Runner
  |
  | launches one fresh Manager Agent
  v
Manager Agent
  |              \
  | MCP           \ MCP
  v                v
Shirube           Wacha
                    |
               +----+----+
               |         |
          Worker Ralph Reviewer Ralph
```

Manager Runner launches **Manager Agents only**. Worker and Reviewer execution remain separate Ralph loops.

Reusable agent behavior is not stored in Shirube. Skills, instructions, reusable knowledge, policies, hooks, and runtime adapters live in `agent-foundation`; Shirube stores the selected profile/version and the provenance of changes.

## Core domains

- **Intent**: Mission, Research, Evidence, Decision, Vision, Outcome
- **Execution**: Manager Work, Agent Run, Human Gate, links to Wacha
- **Improvement**: Observation, Finding, Proposal, Evaluation
- **Provenance**: durable relationships explaining why artifacts exist

## Two mandatory loops

### Delivery Loop

```text
Mission
  -> Vision
  -> Outcome
  -> Wacha
  -> Result
  -> Outcome Evaluation
  -> next action
```

### Improvement Loop

```text
Agent Run / Wacha result
  -> Observe
  -> Diagnose
  -> Improvement Proposal
  -> Evaluate
  -> Project Context or agent-foundation
  -> next Agent Run
```

Generalizable improvements should be implemented in `agent-foundation` through normal Wacha / Ralph implementation and review rather than by allowing Shirube to mutate Foundation content directly.

## Initial deployment

Shirube should begin as a modular monolith plus one small runner process.

```text
apps/
  server/          UI + HTTP API + MCP
  manager-runner/  Manager work watcher / launcher

packages/
  project/
  intent/
  research/
  decision/
  outcome/
  execution/
  improvement/
  provenance/
  mcp/
  shared/
```

Avoid premature microservices and message brokers. Use relational persistence, explicit domain state, and an append-only Change Log first.

## Design

See [docs/initial-design.md](docs/initial-design.md) for the initial domain model, interfaces, Manager Runner responsibility, Wacha integration, human gates, and the mandatory improvement loop.

## MVP sequence

1. Intent trail: Mission -> Research -> Decision -> Vision -> Outcome
2. Manager Runner and Agent Run history
3. Outcome -> Wacha handoff and traceability
4. Human Decision Requests
5. Closed improvement loop into project context / agent-foundation

The MVP is successful when a human can provide a Mission, agents can derive and execute evidence-backed Outcomes through Wacha/Ralph, the result can be evaluated, and execution knowledge can improve subsequent runs.