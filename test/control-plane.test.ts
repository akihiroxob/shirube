import assert from "node:assert/strict";
import test from "node:test";
import { ShirubeDatabase } from "../src/database.js";
import { ControlPlaneService } from "../src/service.js";

test("creating a mission creates durable change and manager work", () => {
  const database = new ShirubeDatabase(":memory:");
  const service = new ControlPlaneService(database);

  const project = service.createProject({
    name: "Test",
    actor: "human",
    foundationRef: "agent-foundation#test",
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
  const project = service.createProject({ name: "Test", actor: "human" });

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
