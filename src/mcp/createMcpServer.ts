import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ControlPlaneService } from "../service.js";
import { artifactInputSchemas, relationTypeSchema } from "../schemas.js";
import type { ArtifactType } from "../domain.js";

const toResult = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  structuredContent: value as Record<string, unknown>,
});

export const createMcpServer = (
  service: ControlPlaneService,
  principalId: string,
) => {
  const server = new McpServer(
    { name: "shirube", version: "0.1.0" },
    {
      instructions:
        "Agent Control Plane. Persist durable Mission, Research, Evidence, Decision, Vision, Outcome, provenance, and improvement artifacts. Do not use chat history as the source of truth.",
    },
  );

  server.registerTool(
    "list_projects",
    {
      title: "List Projects",
      description: "List Shirube Projects.",
      inputSchema: {},
    },
    () => Promise.resolve(toResult(service.listProjects())),
  );

  server.registerTool(
    "get_project_overview",
    {
      title: "Get Project Overview",
      description: "Get the current intent trail, improvement artifacts, Manager work, and Agent runs.",
      inputSchema: { projectId: z.string().min(1) },
    },
    ({ projectId }) =>
      Promise.resolve(toResult(service.getProjectOverview(projectId))),
  );

  server.registerTool(
    "create_mission",
    {
      title: "Create Mission",
      description:
        "Create a durable human intent. Creating a Mission also creates Manager work for upstream reasoning.",
      inputSchema: {
        projectId: z.string().min(1),
        title: z.string().min(1),
        statement: z.string().min(1),
        context: z.string().optional(),
        constraints: z.array(z.string()).optional(),
      },
    },
    ({ projectId, title, ...payload }) =>
      Promise.resolve(
        toResult(
          service.createArtifact({
            projectId,
            type: "mission",
            title,
            payload,
            actor: principalId,
          }),
        ),
      ),
  );

  const registerArtifactTool = (
    name: string,
    title: string,
    description: string,
    type: Exclude<ArtifactType, "mission">,
    schema: z.ZodTypeAny,
  ) => {
    server.registerTool(
      name,
      {
        title,
        description,
        inputSchema: {
          projectId: z.string().min(1),
          title: z.string().min(1),
          payload: schema,
          status: z.string().min(1).optional(),
        },
      },
      (input: {
        projectId: string;
        title: string;
        payload: unknown;
        status?: string;
      }) =>
        Promise.resolve(
          toResult(
            service.createArtifact({
              projectId: input.projectId,
              type,
              title: input.title,
              payload: input.payload as Record<string, unknown>,
              status: input.status,
              actor: principalId,
            }),
          ),
        ),
    );
  };

  registerArtifactTool(
    "record_research",
    "Record Research",
    "Persist a research conclusion; store evidence separately and link it.",
    "research",
    artifactInputSchemas.research,
  );
  registerArtifactTool(
    "record_evidence",
    "Record Evidence",
    "Persist durable evidence with a locator.",
    "evidence",
    artifactInputSchemas.evidence,
  );
  registerArtifactTool(
    "record_decision",
    "Record Decision",
    "Persist alternatives, selected option, and rationale.",
    "decision",
    artifactInputSchemas.decision,
  );
  registerArtifactTool(
    "create_vision",
    "Create Vision",
    "Persist a future-state Vision derived from Mission and evidence.",
    "vision",
    artifactInputSchemas.vision,
  );
  registerArtifactTool(
    "create_outcome",
    "Create Outcome",
    "Persist an evaluable Outcome with success criteria.",
    "outcome",
    artifactInputSchemas.outcome,
  );
  registerArtifactTool(
    "request_human_decision",
    "Request Human Decision",
    "Create a durable human gate with alternatives and a recommendation.",
    "human_decision_request",
    artifactInputSchemas.human_decision_request,
  );
  registerArtifactTool(
    "record_improvement_observation",
    "Record Improvement Observation",
    "Record an execution signal that may deserve system improvement.",
    "improvement_observation",
    artifactInputSchemas.improvement_observation,
  );
  registerArtifactTool(
    "create_improvement_finding",
    "Create Improvement Finding",
    "Persist a diagnosis and classify it as project-specific or generalizable candidate.",
    "improvement_finding",
    artifactInputSchemas.improvement_finding,
  );
  registerArtifactTool(
    "create_improvement_proposal",
    "Create Improvement Proposal",
    "Propose a concrete change to project context, agent-foundation, workflow, or policy.",
    "improvement_proposal",
    artifactInputSchemas.improvement_proposal,
  );
  registerArtifactTool(
    "record_improvement_evaluation",
    "Record Improvement Evaluation",
    "Compare candidate behavior with a baseline before adoption.",
    "improvement_evaluation",
    artifactInputSchemas.improvement_evaluation,
  );

  server.registerTool(
    "link_artifacts",
    {
      title: "Link Artifacts",
      description:
        "Create a provenance relation such as derived_from or supported_by.",
      inputSchema: {
        projectId: z.string().min(1),
        fromArtifactId: z.string().min(1),
        relationType: relationTypeSchema,
        toArtifactId: z.string().min(1),
      },
    },
    (input) =>
      Promise.resolve(
        toResult(service.linkArtifacts({ ...input, actor: principalId })),
      ),
  );

  server.registerTool(
    "list_changes",
    {
      title: "List Changes",
      description: "Read append-only changes after a durable cursor.",
      inputSchema: {
        projectId: z.string().min(1),
        afterCursor: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      },
    },
    ({ projectId, afterCursor, limit }) =>
      Promise.resolve(
        toResult(service.listChanges(projectId, afterCursor, limit)),
      ),
  );

  return server;
};
