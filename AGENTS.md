# Repository Guidelines

Shirube is the Agent Control Plane for upstream intent and system learning.

## Architectural boundary

Keep these boundaries explicit:

- Shirube owns WHY / WHAT / LEARNING.
- Wacha owns executable WORK: Story, Task, Claim, Review, Acceptance.
- Ralph owns repeated Worker / Reviewer execution.
- agent-foundation owns reusable HOW: Skills, Instructions, Knowledge, Policy, Profiles, and runtime adapters.
- Product repositories own implementation artifacts.

Never make Shirube write Wacha's database directly. Integrate through MCP/API/adapters.

## Manager Runner

`src/runner/manager-runner.ts` launches Manager Agents only.

Do not add Worker or Reviewer orchestration to it. Those remain separate Ralph loops.

The runner must stay intentionally thin:
- claim Manager Work
- pin Foundation/Profile
- launch one fresh Manager process
- renew the lease while it runs
- record AgentRun result
- complete Manager Work

Product and technical decisions belong to the Manager Agent, not the runner.

## Durable reasoning

Do not persist hidden chain-of-thought or rely on long chat history as the source of truth.

Persist:
- Research
- Evidence
- Decisions with alternatives and rationale
- Vision
- Outcome success criteria
- provenance relations
- improvement observations/findings/proposals/evaluations

A human must be able to reconstruct "why did this happen?" from these artifacts.

## Improvement invariant

Improvement is a required closed loop:

`Run -> Observe -> Diagnose -> Improve -> Evaluate -> Foundation/Project Context -> next Run`

Generalizable improvements target agent-foundation through normal Wacha/Ralph implementation and review. Shirube records the proposal, evidence, evaluation, and adopted Foundation revision.

## Commands

```bash
npm install
npm run dev
npm test
npm run build
npm run manager-runner
```

Before changing domain boundaries, read `docs/initial-design.md`.
