# Shirube Initial Design

- Status: Draft / initial architecture
- Date: 2026-08-18
- Current product direction (Japanese): [`product-direction.ja.md`](product-direction.ja.md)
- Related systems:
  - Wacha: work coordination (`Story -> Task -> Review -> Acceptance`)
  - Ralph: Worker / Reviewer execution loops
  - agent-foundation: reusable agent knowledge, skills, instructions, policy, and runtime adapters

## 1. Purpose

Shirube is an **Agent Control Plane** that turns human intent into evidence-backed outcomes and keeps the reasoning trail required to explain why the system arrived at a given direction.

Shirube owns the upstream and learning state around agent execution:

```text
Project / opportunity discovery
  -> Research / Evidence
  -> human-authorized Mission and Vision (proposed)
  -> recurring Research / Assumption / Decision
  -> Strategy
  -> Outcome
  -> Wacha
  -> Result
  -> Outcome Evaluation
  -> Improvement
```

Shirube is not a replacement for Wacha and is not the Worker / Reviewer runtime.

The core responsibility split is:

```text
Shirube          WHY / WHAT / LEARNING
Wacha            WORK
Ralph            REPEATED WORK EXECUTION
agent-foundation HOW
Product repo     IMPLEMENTATION ARTIFACTS
```

The most important design goal is **traceability**.

A human must be able to start from an Outcome, Vision, Decision, or Wacha Story and answer:

- Why does this exist?
- What evidence supported it?
- What alternatives were considered?
- Who or what made the decision?
- What later changed or superseded it?
- What work was executed because of it?
- Did that work actually achieve the intended Outcome?
- What did the agent system learn from the execution?

### 1.1 Intent hierarchy

The primary intent and delivery hierarchy is:

```text
Mission -> Vision -> Outcome -> Wacha Story -> Wacha Task
   WHY       WHERE     CHANGE        VALUE         WORK
```

- **Mission** expresses the durable reason the Project exists and the human intent it pursues. It should change rarely, but it may be superseded or canceled.
- **Vision** describes the desirable future state that would express the Mission. A time horizon may be attached, but the future state is more important than the date itself.
- **Outcome** describes an observable and evaluable change that indicates progress toward the Vision. It is not a feature or deliverable.
- **Story** describes an independently acceptable slice of value that contributes to an Outcome. The beneficiary may be a customer, operator, developer, agent, or another system.
- **Task** describes concrete work required to complete a Story.

The relationships are usually one-to-many, but this is not a strict storage tree. Research, Evidence, Decisions, execution results, and evaluations form provenance relationships across the hierarchy.

### 1.2 Discovery and reasoning lifecycle

Research does not begin only after a Mission exists. A Project is the durable container for discovery performed before the Mission is formulated. Pre-Mission Research and Evidence may therefore use the Project itself as their subject.

Each phase has a different purpose and should produce durable outputs:

| Phase | Purpose / key question | Typical activities | Durable output |
| --- | --- | --- | --- |
| Project / opportunity discovery | Is there a problem or opportunity worth pursuing, and for whom? | stakeholder interviews, market and domain research, current-state analysis, constraint and risk discovery | Research Requests, Research, Evidence, explicit unknowns, candidate Mission |
| Mission formulation | Why should this Project exist, and what is in or out of scope? | synthesize evidence, identify beneficiaries, clarify intent and constraints, compare strategic alternatives | Mission, scope and constraints, supporting Decisions and provenance |
| Vision formulation | What desirable future state should the Mission lead to? | user and stakeholder research, positioning, scenario analysis, future-state modeling, alternative comparison | Vision, optional target horizon, principles/non-goals, Decisions and rationale |
| Outcome design | What observable change would demonstrate progress toward the Vision? | establish baseline, model causal assumptions, choose indicators and counter-metrics, define evaluation method | Outcome, success criteria, target or threshold, evaluation plan, linked evidence |
| Story shaping | What independently acceptable value can cause or enable the Outcome? | solution discovery, journey/story mapping, prototyping, usability checks, technical/security spikes, dependency analysis | Wacha Story, acceptance criteria, Outcome link, relevant evidence and Decisions |
| Task planning and execution | What concrete work is needed to complete the Story safely? | technical design, decomposition, implementation, tests, review, acceptance | Wacha Tasks, implementation artifacts, reviews, accepted execution result |
| Outcome evaluation and learning | Did the intended change occur, and what should happen next? | collect measurements and feedback, compare against criteria, diagnose gaps and side effects | Outcome Evaluation, Evidence, new Research/Decision/Outcome/Story, improvement artifacts |

This is not a mandatory waterfall. Research may be requested at any phase, and later evidence may revise or supersede a Mission, Vision, Outcome, or Story.

### 1.3 Choosing a research or strategy method

Frameworks are optional tools selected from the question and uncertainty. Shirube should not require a SWOT, 3C, Five Forces, or STP document for every Project.

| Question to answer | Candidate method | Expected output |
| --- | --- | --- |
| How large is the commercial opportunity? | TAM / SAM / SOM, bottom-up market sizing | estimates, assumptions, calculation basis, confidence and limitations |
| What external changes may affect the Project? | PESTLE, trend and regulatory research | external drivers, risks, opportunities and evidence |
| How attractive or constrained is the industry structure? | Five Forces | forces, supporting evidence, implications and uncertainties |
| How do customer, company, and competitors relate? | 3C | customer needs, internal capabilities, competitor alternatives and strategic implications |
| Which audience should be served and how should it be perceived? | segmentation, targeting, positioning (STP) | segment definitions, selected target, rejected alternatives and positioning choice |
| What problem or progress matters to users? | interviews, observation, Jobs to Be Done, journey mapping | needs, jobs, pains, current behavior, evidence and limitations |
| What strategic situation emerges from existing evidence? | SWOT | synthesized strengths, weaknesses, opportunities and threats; not primary evidence by itself |
| Which future should be prepared for? | scenario planning | scenarios, assumptions, signals and robust choices |
| Is a proposed solution usable or technically feasible? | prototype, usability test, experiment, technical/security spike | findings, measurements, risks and a proceed/change/stop Decision |

The selection rule is:

```text
Decision to make
  -> uncertainty that could change the decision
  -> Research Question
  -> smallest suitable method
  -> Evidence and limitations
  -> Research conclusion
  -> Decision with alternatives and rationale
```

A framework name is never sufficient provenance. Its claims must be traceable to Evidence, and important unknowns and limitations must remain explicit.

### 1.4 Strategy, Decision, and Assumption

These concepts serve different purposes:

- **Strategy** is a coherent set of choices for moving from Vision toward Outcomes. It explains where to focus, how value or advantage will be created, and what will deliberately not be pursued.
- **Decision** records the resolution of one concrete question. It preserves the considered options, selected option, evidence, rationale, trade-offs, and decision authority.
- **Assumption** is the canonical term for an uncertain claim that is currently treated as true. If it is wrong, a Strategy, Decision, Outcome, or Story may need to change. The domain and UI should not use `Hypothesis` as a synonym.

Proposed Strategy content:

```text
Strategy
  id
  projectId
  visionId
  statement
  diagnosis
  focusAreas[]
  valueApproach
  choices[]
  tradeOffs[]
  nonGoals[]
  targetHorizon?
  status: proposed | active | superseded | canceled
  createdBy
  createdAt
  activatedAt?
```

A Strategy should be linked to its supporting Research, Evidence, Decisions, and Assumptions. It may lead to multiple Outcomes. Whether Strategy becomes a first-class artifact or an explicit grouping of Decisions remains an architectural decision.

Proposed additions to Decision content:

```text
Decision
  subject
  question
  context
  options[]
  selectedOption
  rationale
  tradeOffs[]
  consequences[]
  decisionAuthority
  revisitConditions[]
  status
```

Proposed Assumption content:

```text
Assumption
  id
  projectId
  subjectRef
  statement
  impactIfWrong: existential | high | medium | low
  uncertainty: high | medium | low
  decisionProximity: now | soon | later
  validationEffort: high | medium | low
  priority
  confidence?
  validationMethod?
  status: identified | prioritized | testing | supported | refuted | inconclusive | stale | superseded
  reviewBy?
  evidenceFreshUntil?
  createdBy
  createdAt
  evaluatedAt?
```

An Assumption should link to the Evidence that supports or refutes it and to the artifacts that depend on it. `supported` is preferred over `validated` because evidence is contextual and may become stale; it does not prove that an Assumption is permanently true. Assumption is the canonical term. Making it a first-class artifact is the current recommendation because its validation lifecycle crosses all delivery phases, but that representation is not yet an implementation decision.

The Strategy representation must be resolved before finalizing the Manager workflow and its Instructions.

### 1.5 Assumption validation loop

The system should validate Assumptions as a risk-driven learning loop:

```text
Research / observation / human input
  -> identify or update Assumption
  -> deduplicate and link dependents
  -> score risk and priority
  -> design the smallest credible validation
  -> execute research / experiment / delivery work
  -> collect Evidence
  -> evaluate as supported / refuted / inconclusive
  -> propagate the result to dependent artifacts
  -> schedule revalidation when evidence can become stale
```

Priority is not a single 2x2 score. The recommended risk dimensions are:

1. **Impact if wrong**: would this invalidate the Mission, Strategy, major investment, legal/safety position, or only a local choice?
2. **Uncertainty**: how weak, indirect, old, or contradictory is the current Evidence?
3. **Decision proximity**: how soon will an irreversible or expensive Decision depend on it?

`validationEffort` is a sequencing factor rather than risk itself. Within similar risk, prefer the faster or cheaper credible validation. Avoid false numerical precision; use explainable ordinal values plus a written rationale.

When an Assumption is refuted or becomes stale, Shirube must mark dependent Strategy, Decisions, Outcomes, and Stories as requiring review. It must not silently rewrite or delete prior conclusions.

Not every Assumption validation creates an Outcome:

- If the immediate goal is to learn, create a Research Request or validation experiment and record its Evidence.
- If the goal is to cause an observable real-world change, create or revise an Outcome.
- If implementation work is required to test or deliver value, create a Wacha Story linked to the Assumption and, when applicable, the Outcome.

## 2. System boundary

### 2.1 Shirube owns

- Projects from the Agent Control Plane perspective
- Mission state
- Research requests and research results
- Evidence references
- Assumptions, validation state, priority, and dependencies
- Decisions and rationale
- Vision state
- Outcomes and success criteria
- Human decision requests
- provenance / relationship links between artifacts
- links from Outcomes / initiatives to Wacha Stories
- Manager Agent run requests and run history
- append-only Change Log
- observations about agent execution
- improvement findings, proposals, and evaluations
- project-level selection of agent-foundation versions / profiles

### 2.2 Shirube does not own

- Wacha Story / Task lifecycle
- Task Claims
- Worker execution
- Reviewer execution
- Ralph Loop process lifecycle
- source code, commits, PRs, CI, or releases
- reusable skills, instructions, hooks, runtime policies, or general engineering knowledge
- model implementation details

Those responsibilities remain in Wacha, Ralph, product repositories, and agent-foundation.

## 3. Deployment model

The initial implementation should be a **modular monolith plus one small runner process**, not multiple microservices.

```text
shirube repository

apps/
  server/          Web UI + HTTP API + MCP + application services
  manager-runner/  Watches for Manager work and launches Manager Agent

packages/
  intent/
  research/
  decision/
  outcome/
  execution/
  improvement/
  provenance/
  shared/
```

Conceptually:

```text
                         Human
                           |
                        Browser
                           |
                           v
                 +-------------------+
                 |      Shirube      |
                 |                   |
                 | UI / HTTP / MCP   |
                 | DB / Change Log   |
                 +---------+---------+
                           |
                     Manager work
                           |
                           v
                 +-------------------+
                 |  Manager Runner   |
                 |                   |
                 | claim work        |
                 | build runtime     |
                 | launch Manager    |
                 +---------+---------+
                           |
                           v
                     Manager Agent
                      /          \
                     / MCP        \ MCP
                    v              v
               +---------+     +---------+
               | Shirube |     |  Wacha  |
               +---------+     +----+----+
                                    |
                             +------+------+
                             |             |
                         Worker Ralph  Reviewer Ralph
```

The Manager Runner is deliberately separate from Worker / Reviewer Ralph loops.

## 4. External interfaces

### 4.1 Human -> Shirube

Humans use the Browser UI over the normal HTTP application API.

Primary human activities:

- create or edit a Mission
- inspect Research and Evidence
- inspect why a Decision was made
- approve or answer a Human Decision Request
- inspect Vision and Outcomes
- inspect links to Wacha work
- inspect Outcome evaluation
- inspect agent run history
- inspect and approve high-impact improvement proposals

### 4.2 Agent -> Shirube

Agents use Shirube through MCP.

The Browser UI and MCP must operate on the **same application/domain model**. MCP must not maintain a second agent-only state model.

### 4.3 Manager Agent -> Wacha

The Manager Agent uses Wacha through MCP.

The Manager Agent may:

- create Stories / Tasks after an Outcome becomes executable
- inspect work state
- perform Manager acceptance according to Wacha policy
- reject acceptance and describe the remaining gap

Shirube never writes Wacha's database directly.

### 4.4 Manager Runner -> Shirube / Wacha

The Manager Runner is infrastructure, not an autonomous reasoning agent.

It may use an HTTP/application API or a thin transport adapter to:

- poll / consume Shirube Change Log or Manager Work
- observe relevant Wacha changes
- claim Manager work atomically
- record Agent Run lifecycle

It must not make product or technical decisions.

### 4.5 Agent runtime -> agent-foundation

When a Project configures agent-foundation, the Manager Runner resolves its pinned
version and builds the runtime from it.

agent-foundation is the source of truth for reusable HOW:

- Agent Profiles
- Skills
- Instructions
- Knowledge
- Runtime Policy
- Hooks
- Codex / Claude Code adapters

Shirube may store which version/profile should be used for a project. It does not
duplicate their contents.

## 5. Manager Runner responsibility

The previous broad term `Supervisor` is intentionally narrowed in Shirube.

The concrete component is **Manager Runner**.

Its responsibility ends at launching a Manager Agent and recording the run.

```text
new Manager work
      |
      v
Manager Runner
      |
      +-- atomically claim work
      +-- resolve Agent Profile
      +-- resolve agent-foundation version when configured
      +-- prepare runtime / credentials / MCP endpoints
      +-- launch one fresh Manager Agent run
      +-- record exit/result
      v
     done
```

It does **not**:

- select Wacha Tasks for Workers
- launch Worker Ralph loops
- launch Reviewer Ralph loops
- review code
- make product decisions
- author Research conclusions by itself
- modify Skills or prompts directly

Worker and Reviewer remain separately operated Ralph loops.

## 6. Manager Agent and specialist agents

The Manager Agent is the single upstream coordinator started by Manager Runner.

The Manager Agent may use specialist subagents supplied by the runtime / agent-foundation, for example:

```text
Manager Agent
  |
  +-- Researcher
  +-- Codebase Researcher
  +-- UX Researcher
  +-- Security Researcher
  +-- Outcome Evaluator
  +-- Improvement Analyst
```

These are **Agent Profiles**, not Shirube authorization roles.

The Manager remains responsible for turning specialist output into durable Shirube artifacts and deciding what should happen next within its policy.

A later implementation may allow specialist agents to write Research artifacts directly through MCP, but that is not required for the initial version.

## 7. Core domain model

### 7.1 Project

A Project binds the upstream control plane to external execution systems.

Suggested fields:

```text
Project
  id
  name
  description
  status
  wachaProjectId?
  foundationRef?
  managerProfile
  createdAt
  updatedAt
```

`foundationRef` is optional. When configured, it must be pinned to a version, tag,
or immutable revision for reproducible Agent Runs.

### 7.2 Mission

Mission expresses the highest-level human intent currently being pursued.

```text
Mission
  id
  projectId
  statement
  context
  constraints
  status: draft | active | achieved | canceled | superseded
  createdBy
  createdAt
  updatedAt
```

Mission does not need to be directly measurable.

### 7.3 ResearchRequest

ResearchRequest captures a question that must be answered before the system can confidently proceed.

```text
ResearchRequest
  id
  projectId
  subjectRef
  question
  scope
  reason
  status: requested | in_progress | completed | canceled
  createdBy
  createdAt
```

### 7.4 Research

Research is a durable result, not a chat transcript.

```text
Research
  id
  requestId?
  projectId
  question
  summary
  findings[]
  limitations[]
  confidence?
  createdBy
  createdAt
```

### 7.5 Evidence

Evidence records the external basis for a finding or decision.

```text
Evidence
  id
  projectId
  type: web | repository | document | experiment | metric | human_input | other
  title
  locator
  excerptOrSummary?
  capturedAt
  createdBy
```

Evidence should prefer durable locators where possible: URL, repository path + commit, document id, metric query, experiment id, etc.

### 7.6 Decision

Decision is a first-class artifact because most "why did this happen?" questions resolve to a choice among alternatives.

```text
Decision
  id
  projectId
  subject
  question
  options[]
  selectedOption
  rationale
  status: proposed | decided | superseded | canceled
  decisionAuthority: agent | human | policy
  decidedBy
  decidedAt?
```

A Decision must be linked to the Research / Evidence / prior Decisions it depends on.

### 7.7 Vision

Vision describes a desirable future state derived from Mission, Research, and Decisions.

```text
Vision
  id
  projectId
  statement
  description
  status: proposed | active | achieved | superseded | canceled
  createdBy
  createdAt
  activatedAt?
```

There may be multiple historical Visions, but an initial implementation should keep the active set explicit.

### 7.8 Outcome

Outcome converts Vision into a state that can be evaluated.

```text
Outcome
  id
  projectId
  visionId
  statement
  successCriteria[]
  status: proposed | active | achieved | not_achieved | canceled | superseded
  evaluationSummary?
  createdBy
  createdAt
  evaluatedAt?
```

An Outcome should answer: **How will we know that the intended change actually happened?**

### 7.9 HumanDecisionRequest

HumanDecisionRequest is the common human gate.

```text
HumanDecisionRequest
  id
  projectId
  subjectRef
  question
  context
  options[]
  recommendation?
  rationale?
  blocking: boolean
  status: open | resolved | canceled
  requestedBy
  resolvedBy?
  resolution?
  createdAt
  resolvedAt?
```

Human waiting must block only the dependent branch, not the entire project.

### 7.10 ExternalExecutionLink

This links Shirube intent to Wacha execution without merging the two domains.

```text
ExternalExecutionLink
  id
  projectId
  sourceType: outcome | decision | improvement_proposal
  sourceId
  system: wacha
  externalProjectId
  externalStoryId
  createdAt
```

This lets a human traverse:

```text
Mission
  -> Research
  -> Decision
  -> Vision
  -> Outcome
  -> Wacha Story
  -> Tasks / code / review
```

### 7.11 AgentRun

AgentRun records reproducible execution metadata.

```text
AgentRun
  id
  projectId
  workId
  agentProfile
  foundationRef?
  runtime
  model?
  status: queued | running | succeeded | failed | canceled
  startedAt?
  finishedAt?
  resultSummary?
  errorSummary?
```

Do not treat the full conversation transcript as the primary domain record. Durable conclusions belong in Research, Decision, Outcome, Finding, etc.

### 7.12 ImprovementObservation

Observation records a potentially useful execution signal.

Examples:

- repeated Reviewer rejection
- repeated Acceptance rejection
- repeated Human escalation
- unusually high retry count
- a successful pattern worth generalizing
- Outcome failure despite technically accepted work

```text
ImprovementObservation
  id
  projectId
  sourceType
  sourceRef
  category
  summary
  metricSnapshot?
  createdAt
```

### 7.13 ImprovementFinding

Finding is an analyzed explanation of one or more observations.

```text
ImprovementFinding
  id
  projectId
  summary
  diagnosis
  scope: project | general_candidate
  confidence?
  status: open | resolved | dismissed
  createdBy
  createdAt
```

### 7.14 ImprovementProposal

Proposal describes a concrete system change.

```text
ImprovementProposal
  id
  projectId
  findingId
  targetType: project_context | agent_foundation | workflow | policy | other
  targetRef?
  proposedChange
  expectedEffect
  risks[]
  status: proposed | approved | rejected | implementing | evaluating | adopted | rolled_back
  createdBy
  createdAt
```

### 7.15 ImprovementEvaluation

Evaluation compares the candidate change against the previous behavior.

```text
ImprovementEvaluation
  id
  proposalId
  baselineRef
  candidateRef
  method
  metrics
  result: improved | neutral | regressed | inconclusive
  summary
  createdAt
```

## 8. Provenance model

Shirube must make provenance explicit instead of depending on hidden model reasoning or chat history.

Conversation logs may be imported as human-provided source material, but they are not durable conclusions by themselves. An import must record its source, participants when known, capture time, access classification, and immutable snapshot or locator. Agents then extract candidate Research, Evidence, Decisions, and Assumptions for review. The product must not assume that arbitrary ChatGPT product history is directly accessible through the OpenAI API; conversation import requires an explicit supported adapter or user-provided export.

Use a generic relationship record for cross-artifact traceability.

```text
ArtifactRelation
  id
  projectId
  fromType
  fromId
  relationType
  toType
  toId
  createdBy
  createdAt
```

Initial relation types:

```text
derived_from
supported_by
contradicts
supersedes
requires
blocks
implements
executes_as
evaluates
improves
```

Example:

```text
Vision V-10
  derived_from -> Mission M-1
  supported_by -> Research R-12
  supported_by -> Decision D-8

Outcome O-20
  derived_from -> Vision V-10

Wacha Story S-50
  executes_as <- Outcome O-20
```

The UI should render these relationships as a readable timeline / dependency trail rather than exposing only raw IDs.

## 9. Change Log

All meaningful state transitions must append to a Change Log.

```text
Change
  cursor
  projectId
  type
  subjectType
  subjectId
  actor
  payload
  createdAt
```

Properties:

- append-only
- monotonically consumable cursor
- sufficient data for external runners to detect actionable changes
- not used as a substitute for the current domain state

Example event types:

```text
MISSION_ACTIVATED
RESEARCH_REQUESTED
RESEARCH_COMPLETED
ASSUMPTION_IDENTIFIED
ASSUMPTION_PRIORITIZED
ASSUMPTION_EVALUATED
ASSUMPTION_STALE
DECISION_REQUIRED
DECISION_RESOLVED
VISION_ACTIVATED
OUTCOME_ACTIVATED
OUTCOME_EVALUATION_REQUIRED
OUTCOME_EVALUATED
HUMAN_DECISION_REQUESTED
HUMAN_DECISION_RESOLVED
IMPROVEMENT_REVIEW_REQUIRED
IMPROVEMENT_PROPOSAL_APPROVED
```

## 10. Manager work model

Manager Runner should not infer broad workflow state by itself.

Shirube should expose explicit **ManagerWork** records when Manager reasoning is required.

```text
ManagerWork
  id
  projectId
  reasonType
  subjectRef
  status: available | running | completed | failed | canceled
  claimOwner?
  claimExpiresAt?
  attempt
  createdAt
```

Manager Runner does only:

```text
claim_manager_work
  -> start fresh Manager Agent
  -> record AgentRun
  -> complete / release manager work
```

This allows multiple Manager Runner processes without duplicate execution.

Wacha-originated events that require Manager attention may be bridged into ManagerWork, for example:

```text
Wacha Task waits for acceptance
  -> ManagerWork: WACHA_ACCEPTANCE_REQUIRED

Wacha Story completed / accepted
  -> ManagerWork: OUTCOME_REEVALUATION_REQUIRED
```

Shirube-originated recurring or event-driven work may include:

```text
RESEARCH_REFRESH_REQUIRED
ASSUMPTION_TRIAGE_REQUIRED
ASSUMPTION_VALIDATION_REQUIRED
DEPENDENT_ARTIFACT_REVIEW_REQUIRED
PROJECT_SUMMARY_REFRESH_REQUIRED
```

Schedules must include budget, scope, freshness, and stop conditions. "Continuously research everything" is not an executable policy.

The exact Wacha-to-Shirube adapter may initially poll Wacha Change Log. No direct database coupling is allowed.

## 11. End-to-end delivery loop

### 11.1 Human intent and recurring discovery

```text
Human creates Project / identifies an opportunity
  -> Human-led or explicitly requested discovery
  -> pre-Mission Research / Evidence stored against Project
  -> Human creates and activates Mission and Vision
  -> recurring and event-driven ManagerWork created
  -> Manager Runner launches Manager Agent
  -> Manager identifies and prioritizes Assumptions and unknowns
  -> Researcher subagents investigate
  -> Research / Evidence persisted
  -> Decisions persisted
  -> Strategy / Vision revision / Outcome proposals produced when needed
```

The current proposal keeps Mission and Vision activation human-authorized. Agents may research and draft them or propose revisions, but must not silently change the active human intent. Mission creation is not the beginning of all research; Project is the pre-Mission discovery container.

### 11.2 Vision to Outcome

```text
Vision active
  -> Manager maintains Research, Evidence, and prioritized Assumptions
  -> Manager proposes measurable Outcomes and their evaluation plans
  -> Decision Policy determines human approval or automatic activation
  -> Outcome active
```

Requiring a human to author every Outcome would make human availability a permanent stop in the loop. The current Level 6 proposal lets agents create Outcome drafts and activate low-risk, reversible, policy-compliant Outcomes automatically. Humans would approve high-impact, strategic, costly, regulated, or difficult-to-reverse Outcomes. The exact policy remains undecided.

### 11.3 Outcome to Wacha

```text
Outcome active
  -> Manager determines executable work
  -> Manager creates Wacha Story / AC / Tasks through Wacha MCP
  -> Shirube stores ExternalExecutionLink
```

The Manager Agent runtime therefore needs authorized access to both Shirube MCP and Wacha MCP. Manager Runner remains a thin launcher: it selects the pinned runtime/Profile, supplies both MCP configurations and scoped credentials, launches one fresh Manager process, and records the run. The runner itself must not decide Outcomes or write Wacha work.

### 11.4 Wacha execution

```text
Wacha Story / Tasks
  -> Worker Ralph Loop
  -> Reviewer Ralph Loop
  -> Wacha Manager acceptance
```

Shirube Manager Runner does not operate the Worker or Reviewer loops.

### 11.5 Outcome evaluation

```text
Wacha work accepted
  -> ManagerWork: OUTCOME_EVALUATION_REQUIRED
  -> Manager / Outcome Evaluator checks success criteria

  -> achieved
       Outcome = achieved

  -> not achieved
       Outcome = not_achieved
       new Research / Decision / Outcome / Wacha work may be created
```

This is the product / delivery loop.

### 11.6 Project summaries and notifications

Detailed artifacts remain the source of truth. The system should also maintain a versioned Project Summary derived from them:

```text
Project Summary
  Mission and active Vision
  current Strategy
  material changes since previous revision
  highest-priority Assumptions
  recent Research conclusions and confidence
  active Outcomes and progress
  decisions or exceptions requiring human attention
```

Summary revisions must link to their source artifacts and must not erase history. A human should be able to open a summary statement and inspect the detailed Research, Evidence, Assumption, and Decision behind it.

Slack is a notification and discussion projection, not the system of record. A research-unit notification should contain what changed, why it matters, confidence/limitations, affected Assumptions or Outcomes, whether human action is required, and a Shirube link. Posting and retries should be handled by an idempotent notification adapter rather than embedded in Manager Runner.

## 12. Mandatory system improvement loop

Improvement is not an optional retrospective feature. It is a required closed loop.

```text
Agent Runs + Wacha results + Outcome results
        |
        v
Observations
        |
        v
Improvement Analysis
        |
        v
Finding
        |
        v
Improvement Proposal
        |
        +-----------------------------+
        |                             |
        v                             v
project-specific                 generalizable
        |                             |
        v                             v
Project Context             agent-foundation change
                                      |
                                      v
                              Evaluation / review
                                      |
                                      v
                               Foundation vNext
                                      |
                                      v
                                 future Agent Runs
```

### 12.1 Generalization gate

Every reusable improvement must answer:

> Is this specific to this project, or should every suitable agent learn it?

Project-specific examples:

- a project domain term
- repository architecture knowledge
- an organization-specific operational rule

Generalizable examples:

- a recurring code-review checklist item
- a safe database migration procedure
- a reliable research workflow
- a reusable failure-diagnosis procedure

Project-specific learning remains in Shirube Project Knowledge / Context.

Generalizable learning becomes an agent-foundation candidate.

### 12.2 Do not let Shirube edit agent-foundation directly

A general improvement should enter the normal work pipeline.

Recommended flow:

```text
ImprovementProposal approved
  -> Manager creates Wacha Story in the agent-foundation project
  -> Worker Ralph implements the foundation change
  -> Reviewer Ralph reviews it
  -> Manager accepts it
  -> release / tag agent-foundation vNext
  -> evaluate / adopt pinned foundationRef in Shirube
```

This keeps improvement changes auditable and subject to the same implementation / review discipline as product code.

### 12.3 Version pinning

Every AgentRun that uses agent-foundation records the exact `foundationRef` used.

Do not silently use `latest`.

This allows questions such as:

- Why did performance change after August 15?
- Which Foundation revision introduced this behavior?
- Did the candidate actually improve rejection rate?
- Can we roll back to the previous behavior?

## 13. Human gate policy

The system should prefer autonomous progress while escalating decisions that exceed its authority.

A Project may define a Decision Policy.

Typical agent-authorized decisions:

- reversible implementation detail
- naming
- normal test strategy
- minor refactoring
- existing-pattern UI implementation
- research method

Typical human-required decisions:

- Mission or product direction change
- pricing / commercial commitment
- destructive production-data operation
- security-policy relaxation
- new external contract / paid service
- major irreversible architecture change
- conflict between important Outcomes or constraints

HumanDecisionRequest should contain a recommendation whenever possible so the human is asked to choose, not to redo the research.

For the Level 6 target, responsibility should default as follows:

| Activity | Agent default | Human responsibility |
| --- | --- | --- |
| Mission / active Vision | research, draft, challenge, propose revision | create or activate; approve material revision |
| Research and Evidence | schedule, execute, summarize, refresh | provide privileged context; challenge material gaps |
| Assumptions | identify, link, score, validate, monitor staleness | set risk appetite; choose among exceptional high-risk validations |
| Strategy | synthesize and recommend | approve creation or material direction change |
| Outcomes | draft, prioritize, evaluate; auto-activate within policy | approve high-impact, costly, regulated, or irreversible Outcomes |
| Wacha Stories / Tasks | create through Wacha and monitor execution | intervene on policy exceptions or disputed acceptance |
| Final evaluation | collect evidence and recommend judgment | validate subjective, strategic, legal, or high-consequence results |

Human gates are based on authority and risk, not fixed workflow steps. Low-risk work should continue while an unrelated high-risk Decision waits for a human.

## 14. Initial MCP surface

Exact names may change, but the initial capability set should resemble:

### Read

```text
get_project
get_mission
list_missions
get_research
list_research
get_assumption
list_assumptions
get_decision
list_decisions
get_vision
list_visions
get_outcome
list_outcomes
get_human_decision_request
list_human_decision_requests
get_improvement_proposal
list_improvement_proposals
get_project_summary
list_changes
```

### Intent writes

```text
create_mission
update_mission
activate_mission
create_research_request
record_research
record_evidence
create_assumption
update_assumption_priority
record_assumption_evaluation
create_decision
record_decision
create_vision
activate_vision
create_outcome
activate_outcome
record_outcome_evaluation
record_project_summary
request_human_decision
```

### Execution / trace writes

```text
link_external_execution
record_agent_run_result
```

### Improvement writes

```text
record_improvement_observation
create_improvement_finding
create_improvement_proposal
record_improvement_evaluation
```

Human-only resolution of HumanDecisionRequest should not be exposed as an unrestricted agent capability.

## 15. Initial Browser UI

The first UI does not need to be a complex graph editor.

Start with five views:

### 15.1 Project dashboard

```text
Active Mission
Active Vision
Current Project Summary
Highest-risk Assumptions
Active Outcomes
Waiting for Human
Manager activity
Wacha execution summary
Recent improvements
```

### 15.2 Intent trail

A readable vertical trail:

```text
Mission
  -> Research
  -> Evidence
  -> Decision
  -> Vision
  -> Outcome
  -> Wacha Story
```

This is the primary "why did we get here?" interface.

### 15.3 Human decisions

Show:

- question
- context
- alternatives
- Manager recommendation
- rationale / evidence
- downstream work currently blocked

### 15.4 Outcome detail

Show:

- statement
- success criteria
- related Wacha execution
- evaluation history
- achieved / not achieved

### 15.5 Improvement detail

Show:

- observed problem or successful pattern
- affected Agent Runs / Wacha events
- diagnosis
- proposed change
- project-specific vs generalizable classification
- evaluation result
- agent-foundation Story / revision / release when applicable

## 16. Suggested repository layout

Do not commit to a framework before the domain boundary is stable, but keep the code organized around deployables and domains.

```text
shirube/
  apps/
    server/
    manager-runner/

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

  docs/
    initial-design.md
    adr/

  tests/
```

The server may be a single deployable containing UI/API/MCP. Splitting into microservices should happen only when independent scaling or release boundaries become real requirements.

## 17. Non-goals for the initial version

Do not add these until the simpler loop works end to end:

- distributed event broker
- Kafka / NATS merely for internal state propagation
- generic workflow DSL
- arbitrary graph database
- automatic Worker / Reviewer orchestration
- dynamic model marketplace
- fully autonomous Foundation mutation
- large-scale multi-tenant authorization system
- storing every LLM token / hidden reasoning trace as domain state

Prefer normal relational persistence, append-only Change Log, explicit domain objects, and external references.

## 18. MVP implementation sequence

### Phase 1: Intent trail

Implement:

- Project
- Mission
- Research / Evidence
- Assumption
- Decision
- Vision
- Outcome
- versioned Project Summary
- ArtifactRelation
- Change Log
- minimal Browser UI
- MCP read/write

Success condition:

> A human creates Mission and Vision, Manager Agents maintain evidence-backed Research and prioritized Assumptions, and Outcome proposals remain traceable to them.

### Phase 2: Manager Runner

Implement:

- ManagerWork
- claim / lease
- AgentRun
- manager-runner process
- agent-foundation profile + version resolution
- one fresh Manager run per work item

Success condition:

> Activating a Mission can autonomously wake one Manager Agent without launching Worker / Reviewer processes.

### Phase 3: Wacha handoff

Implement:

- ExternalExecutionLink
- Manager access to Wacha MCP
- Wacha change adapter
- acceptance / outcome reevaluation ManagerWork

Success condition:

> An Outcome is converted to Wacha work, executed by existing Ralph loops, and traced back to the Outcome.

### Phase 4: Human Gate

Implement:

- HumanDecisionRequest
- dependency/blocking relation
- Browser approval UI
- Manager wake-up after resolution

Success condition:

> Only the dependent branch pauses while unrelated work can continue.

### Phase 5: Improvement loop

Implement:

- ImprovementObservation
- ImprovementFinding
- ImprovementProposal
- ImprovementEvaluation
- generalization gate
- agent-foundation Wacha handoff
- Foundation version adoption / rollback history

Success condition:

> A repeated execution problem can produce an evidence-backed improvement, be implemented in agent-foundation through Wacha/Ralph, evaluated, and used by later Agent Runs.

## 19. Architecture invariants

The following rules should be treated as architectural constraints unless explicitly replaced by an ADR:

1. **Shirube and Wacha keep separate domain state and databases.**
2. **Cross-system integration happens through APIs/MCP/adapters, never direct database writes.**
3. **Manager Runner launches Manager Agents only. Worker and Reviewer remain Ralph concerns.**
4. **agent-foundation is the source of truth for reusable HOW. Shirube stores references and provenance, not copied skill definitions.**
5. **Every important upstream conclusion must be explainable through durable Research / Evidence / Decision relationships.**
6. **Human waiting blocks dependent work, not the entire system.**
7. **Every Agent Run pins its agent-foundation revision.**
8. **Improvement is a closed loop and must feed future execution.**
9. **General Foundation changes go through normal implementation and review, preferably Wacha + Ralph.**
10. **Fresh Agent runs externalize durable state before terminating.**

## 20. Target end state

The intended operating model is:

```text
Human
  |
  | Project framing / Mission / Vision / policy / exceptional decisions
  v
Shirube
  |
  | evidence-backed direction
  v
Manager Agent
  |
  | executable work
  v
Wacha
  |
  +--> Worker Ralph
  +--> Reviewer Ralph
  +--> Manager acceptance
  |
  v
Outcome Evaluation
  |
  +--> new Research / Decision / Work when outcome is not achieved
  |
  v
Improvement Analysis
  |
  +--> Project Knowledge
  |
  +--> agent-foundation improvement through Wacha/Ralph
              |
              v
        future Agent Runs improve
```

The system is complete only when both loops are closed:

```text
Delivery Loop
Mission -> Vision -> Outcome -> Wacha -> Result -> Outcome Evaluation -> next action

Improvement Loop
Run -> Observe -> Diagnose -> Improve -> Evaluate -> Foundation / Project Context -> next Run
```

Shirube is the durable control plane that makes both loops visible, explainable, and governable by humans.
