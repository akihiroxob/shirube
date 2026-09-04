# Shirube Runner Protocol

- Status: Initial contract
- Scope: Manager execution only

## Purpose

Shirube does not push commands into an execution host.

A Runner is an outbound-only process that repeatedly asks Shirube for available Manager Work, atomically claims one item, launches one fresh Manager Agent, renews the claim lease while it runs, records the AgentRun, and completes the work.

This keeps the control plane independent from the machine that provides compute.

```text
                 Control plane
              +-----------------+
              |     Shirube     |
              |                 |
Mission ----> | ManagerWork     |
              | available       |
              +--------+--------+
                       ^
                       |
                 HTTPS / claim
                       |
              +--------+--------+
              |     Runner      |
              | Pi / Mac / VPS  |
              +--------+--------+
                       |
                       | spawn
                       v
                 Manager Agent
                       |
                  Shirube / Wacha MCP
```

The Runner host does not need an inbound port, public IP address, tunnel, or direct callback from Shirube. It only needs outbound access to the Shirube endpoint and any systems the Manager Agent uses.

## Responsibilities

### Shirube

- create explicit ManagerWork when Manager reasoning is required
- expose ManagerWork for atomic claim
- maintain claim owner, lease expiration, and attempt fencing
- reclaim expired work
- record AgentRun lifecycle
- preserve durable Manager results as Shirube artifacts

### Runner

- poll for ManagerWork
- atomically claim one work item
- load the Project execution profile
- launch one fresh Manager process
- renew the lease while the process is alive
- terminate the process if the lease is lost
- record AgentRun completion
- complete ManagerWork
- return to polling

### Manager Agent

- perform reasoning and product/technical decisions
- use Shirube MCP for WHY / WHAT / LEARNING
- use Wacha MCP for executable WORK
- write durable conclusions to the owning systems

The Runner must remain infrastructure. It must not make Manager decisions.

## Claim loop

```text
forever
  |
  +-> claim ManagerWork
        |
        +-- none ----------> sleep -> retry
        |
        +-- claimed
              |
              +-> record AgentRun start
              +-> spawn Manager
              +-> renew lease periodically
              |
              +-- lease lost -> stop Manager -> retry later
              |
              +-- Manager exits
                    |
                    +-> record AgentRun finish
                    +-> complete ManagerWork
                    +-> retry
```

The current implementation uses:

```text
POST /api/manager-work/claim
POST /api/manager-work/:id/renew
POST /api/manager-work/:id/complete
POST /api/agent-runs
POST /api/agent-runs/:id/finish
GET  /api/projects/:projectId/overview
```

These transport endpoints are Manager-specific today. The protocol boundary is intentionally broader than a particular host: a Raspberry Pi, laptop, VPS, container host, or future runner implementation can use the same lifecycle.

## Lease and attempt fencing

A claim has both a lease and an incrementing attempt number.

```text
Runner A claims work
  attempt = 1
  lease expires

Runner B reclaims work
  attempt = 2

Runner A can no longer renew, finish AgentRun, or complete attempt 1.
```

This prevents a stale process from committing completion after another Runner has legitimately taken ownership.

A Runner must stop its Manager process when lease renewal fails.

## Runtime environment

The bundled Manager Runner accepts:

```text
SHIRUBE_URL
SHIRUBE_RUNNER_ID
SHIRUBE_RUNNER_TOKEN
SHIRUBE_RUNNER_POLL_MS
SHIRUBE_RUNNER_LEASE_SECONDS
MANAGER_COMMAND
```

Backward-compatible environment names remain supported:

```text
MANAGER_RUNNER_ID
MANAGER_POLL_MS
MANAGER_LEASE_SECONDS
```

Each Manager process receives:

```text
SHIRUBE_MANAGER_WORK_ID
SHIRUBE_PROJECT_ID
SHIRUBE_SUBJECT_TYPE
SHIRUBE_SUBJECT_ID
SHIRUBE_REASON_TYPE
SHIRUBE_AGENT_RUN_ID
SHIRUBE_MANAGER_PROFILE
SHIRUBE_FOUNDATION_REF  # only when configured
```

## Remote deployment

A useful deployment model is:

```text
Public / hosted network
+-----------------------+
| Shirube               |
| Wacha                 |
| durable state         |
+-----------+-----------+
            ^
            | outbound HTTPS
            |
Home / private network
+-----------+-----------+
| Runner                |
| Raspberry Pi          |
| Codex / Claude runtime|
+-----------------------+
```

The private Runner never has to accept unsolicited inbound traffic.

For an Internet-exposed Shirube, authenticate the Runner connection. `SHIRUBE_RUNNER_TOKEN` is sent by the bundled Runner as a Bearer token and can be validated by the deployment ingress/proxy. Shirube should eventually own first-class Runner credentials rather than treating an ingress shared secret as the final authentication model.

## Raspberry Pi operation

The Runner is a long-lived lightweight process. It is suitable for systemd, Docker, or another process supervisor.

A typical host only needs:

- Node.js compatible with Shirube
- the Manager runtime (`codex`, `claude`, etc.)
- credentials for Shirube/Wacha and the source repositories it must access
- outbound HTTPS connectivity

It does not need Kubernetes or a container orchestrator merely to participate in claim-based execution.

## Relationship to Ralph

The outer Runner loop and Ralph loops solve different problems.

```text
Runner Loop
  claim execution
  launch fresh Manager
  observe exit
  repeat

Ralph Loop
  repeatedly execute Worker / Reviewer work
  using Wacha as durable coordination state
```

Shirube starts only Manager execution. Worker and Reviewer remain separate Ralph loops driven by Wacha.

## Future extension

If Shirube later needs other execution roles, avoid turning ManagerWork into an untyped generic job queue too early.

Prefer a small common claim lifecycle with role-specific work contracts:

```text
Execution Claim Protocol
  claim
  renew
  complete
  attempt fencing

ManagerWork
  Manager-specific payload and invariants

future work type
  its own payload and invariants
```

This preserves domain boundaries while allowing Runner implementations to share transport and lease mechanics.
