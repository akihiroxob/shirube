import assert from "node:assert/strict";
import test from "node:test";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { ShirubeDatabase } from "../src/database.js";
import { toResult } from "../src/mcp/createMcpServer.js";
import { ControlPlaneService } from "../src/service.js";

const foundationRef =
  `https://github.com/example/agent-foundation.git#${"a".repeat(40)}`;

test("creating a mission creates durable change and manager work", () => {
  const database = new ShirubeDatabase(":memory:");
  const service = new ControlPlaneService(database);

  const project = service.createProject({
    name: "Test",
    actor: "human",
    foundationRef,
  });
  const mission = service.createArtifact({
    projectId: project.id,
    type: "mission",
    title: "Reach outcome",
    payload: { statement: "Reach a measurable outcome", constraints: [] },
    actor: "human",
  });

  assert.equal(mission.type, "mission");
  assert.equal(service.listArtifacts(project.id, "mission").length, 1);

  const changes = service.listChanges(project.id);
  assert.ok(changes.some((change) => change.type === "MISSION_CREATED"));

  const overview = service.getProjectOverview(project.id);
  assert.equal(overview.managerWork.length, 1);
  assert.equal(overview.managerWork[0]?.reasonType, "MISSION_REVIEW_REQUIRED");

  database.close();
});

test("provenance links research to a decision", () => {
  const database = new ShirubeDatabase(":memory:");
  const service = new ControlPlaneService(database);
  const project = service.createProject({
    name: "Test",
    actor: "human",
    foundationRef,
  });

  const research = service.createArtifact({
    projectId: project.id,
    type: "research",
    title: "Research",
    payload: { question: "Q", summary: "S", findings: [], limitations: [] },
    actor: "researcher",
  });
  const decision = service.createArtifact({
    projectId: project.id,
    type: "decision",
    title: "Decision",
    payload: {
      question: "Q",
      options: ["A", "B"],
      selectedOption: "A",
      rationale: "Evidence",
      decisionAuthority: "agent",
    },
    actor: "manager",
  });

  service.linkArtifacts({
    projectId: project.id,
    fromArtifactId: decision.id,
    relationType: "supported_by",
    toArtifactId: research.id,
    actor: "manager",
  });

  assert.equal(service.listRelations(project.id).length, 1);
  database.close();
});

test("MCP results keep structuredContent as an object", () => {
  const result = toResult([{ id: "project-1" }]);
  assert.equal(CallToolResultSchema.safeParse(result).success, true);
  assert.deepEqual(result.structuredContent, {
    result: [{ id: "project-1" }],
  });
});

test("foundationRef rejects a mutable branch", () => {
  const database = new ShirubeDatabase(":memory:");
  const service = new ControlPlaneService(database);

  assert.throws(
    () =>
      service.createProject({
        name: "Test",
        actor: "human",
        foundationRef: "https://github.com/example/agent-foundation.git#main",
      }),
    /immutable.*commit SHA/,
  );
  database.close();
});

test("foundationRef can be omitted", () => {
  const database = new ShirubeDatabase(":memory:");
  const service = new ControlPlaneService(database);

  const project = service.createProject({ name: "Test", actor: "human" });
  assert.equal(project.foundationRef, null);
  assert.equal(service.getProject(project.id).foundationRef, null);
  service.createArtifact({
    projectId: project.id,
    type: "mission",
    title: "Mission",
    payload: { statement: "Test" },
    actor: "human",
  });
  const work = service.claimNextManagerWork("runner-a", 300)!;
  const run = service.recordAgentRunStart({
    projectId: project.id,
    workId: work.id,
    workAttempt: work.attempt,
    owner: "runner-a",
    agentProfile: project.managerProfile,
    runtime: "test",
  });
  assert.equal(run.foundationRef, null);
  database.close();
});

test("ManagerWork attempts fence stale runners and AgentRun writes are idempotent", () => {
  const database = new ShirubeDatabase(":memory:");
  const service = new ControlPlaneService(database);
  const project = service.createProject({
    name: "Test",
    actor: "human",
    foundationRef,
  });
  service.createArtifact({
    projectId: project.id,
    type: "mission",
    title: "Mission",
    payload: { statement: "Test" },
    actor: "human",
  });

  const firstClaim = service.claimNextManagerWork("runner-a", 300)!;
  const runInput = {
    projectId: project.id,
    workId: firstClaim.id,
    workAttempt: firstClaim.attempt,
    owner: "runner-a",
    agentProfile: project.managerProfile,
    foundationRef: project.foundationRef,
    runtime: "test",
  };
  const firstRun = service.recordAgentRunStart(runInput);
  assert.equal(service.recordAgentRunStart(runInput).id, firstRun.id);
  assert.equal(service.listAgentRuns(project.id).length, 1);

  database.raw
    .prepare("UPDATE manager_work SET claim_expires_at = ? WHERE id = ?")
    .run("2000-01-01T00:00:00.000Z", firstClaim.id);
  const secondClaim = service.claimNextManagerWork("runner-b", 300)!;
  assert.equal(secondClaim.id, firstClaim.id);
  assert.equal(secondClaim.attempt, firstClaim.attempt + 1);
  assert.throws(
    () => service.renewManagerWork(firstClaim.id, "runner-a", firstClaim.attempt),
    /expired or owned by another claim/,
  );
  assert.throws(
    () =>
      service.recordAgentRunFinish({
        runId: firstRun.id,
        owner: "runner-a",
        workAttempt: firstClaim.attempt,
        success: true,
      }),
    /expired or owned by another claim/,
  );

  const secondRun = service.recordAgentRunStart({
    ...runInput,
    workAttempt: secondClaim.attempt,
    owner: "runner-b",
  });
  assert.notEqual(secondRun.id, firstRun.id);
  assert.equal(
    service.listAgentRuns(project.id).find((run) => run.id === firstRun.id)?.status,
    "canceled",
  );

  const finishInput = {
    runId: secondRun.id,
    owner: "runner-b",
    workAttempt: secondClaim.attempt,
    success: true,
  };
  service.recordAgentRunFinish(finishInput);
  service.recordAgentRunFinish(finishInput);
  assert.equal(
    service
      .listChanges(project.id)
      .filter((change) => change.type === "AGENT_RUN_SUCCEEDED").length,
    1,
  );
  service.completeManagerWork(
    secondClaim.id,
    "runner-b",
    secondClaim.attempt,
    true,
  );
  assert.throws(
    () =>
      service.completeManagerWork(
        firstClaim.id,
        "runner-a",
        firstClaim.attempt,
        true,
      ),
    /expired or owned by another claim/,
  );
  database.close();
});

test("different projects can be claimed in parallel", () => {
  const database = new ShirubeDatabase(":memory:");
  const service = new ControlPlaneService(database);
  for (const name of ["A", "B"]) {
    const project = service.createProject({
      name,
      actor: "human",
      foundationRef,
    });
    service.createArtifact({
      projectId: project.id,
      type: "mission",
      title: `Mission ${name}`,
      payload: { statement: name },
      actor: "human",
    });
  }

  const first = service.claimNextManagerWork("runner-a", 300);
  const second = service.claimNextManagerWork("runner-b", 300);
  assert.ok(first);
  assert.ok(second);
  assert.notEqual(first.projectId, second.projectId);
  database.close();
});
