import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { ControlPlaneService } from "./service.js";
import { createMcpServer } from "./mcp/createMcpServer.js";
import {
  artifactInputSchemas,
  artifactTypeSchema,
  projectSchema,
  relationTypeSchema,
} from "./schemas.js";

const actorFromRequest = (authorization?: string) => {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "human";
};

export const createApp = (service: ControlPlaneService) => {
  const app = new Hono();
  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "Mcp-Protocol-Version",
        "Last-Event-ID",
      ],
      exposeHeaders: ["Mcp-Protocol-Version"],
    }),
  );

  app.get("/health", (c) => c.json({ status: "ok", service: "shirube" }));

  app.get("/api/projects", (c) => c.json(service.listProjects()));

  app.post("/api/projects", async (c) => {
    const input = projectSchema.parse(await c.req.json());
    return c.json(
      service.createProject({
        ...input,
        actor: actorFromRequest(c.req.header("Authorization")),
      }),
      201,
    );
  });

  app.get("/api/projects/:projectId/overview", (c) =>
    c.json(service.getProjectOverview(c.req.param("projectId"))),
  );

  app.get("/api/projects/:projectId/artifacts", (c) => {
    const typeRaw = c.req.query("type");
    const type = typeRaw ? artifactTypeSchema.parse(typeRaw) : undefined;
    return c.json(service.listArtifacts(c.req.param("projectId"), type));
  });

  app.post("/api/projects/:projectId/artifacts/:type", async (c) => {
    const type = artifactTypeSchema.parse(c.req.param("type"));
    const body = (await c.req.json()) as {
      title?: string;
      status?: string;
      payload?: unknown;
    };
    if (!body.title?.trim()) throw new Error("title is required");
    const schema = artifactInputSchemas[type];
    const payload = schema.parse(body.payload ?? {});

    return c.json(
      service.createArtifact({
        projectId: c.req.param("projectId"),
        type,
        title: body.title,
        status: body.status,
        payload: payload as Record<string, unknown>,
        actor: actorFromRequest(c.req.header("Authorization")),
      }),
      201,
    );
  });

  app.post("/api/projects/:projectId/relations", async (c) => {
    const body = z
      .object({
        fromArtifactId: z.string().min(1),
        relationType: relationTypeSchema,
        toArtifactId: z.string().min(1),
      })
      .parse(await c.req.json());
    return c.json(
      service.linkArtifacts({
        projectId: c.req.param("projectId"),
        ...body,
        actor: actorFromRequest(c.req.header("Authorization")),
      }),
      201,
    );
  });

  app.get("/api/projects/:projectId/changes", (c) => {
    const afterCursor = Number(c.req.query("afterCursor") ?? "0");
    const limit = Number(c.req.query("limit") ?? "100");
    return c.json(
      service.listChanges(c.req.param("projectId"), afterCursor, limit),
    );
  });

  app.post("/api/manager-work/claim", async (c) => {
    const body = z
      .object({
        owner: z.string().min(1),
        leaseSeconds: z.number().int().min(30).max(3600).default(300),
      })
      .parse(await c.req.json());
    return c.json(service.claimNextManagerWork(body.owner, body.leaseSeconds));
  });

  app.post("/api/manager-work/:id/renew", async (c) => {
    const body = z
      .object({
        owner: z.string().min(1),
        leaseSeconds: z.number().int().min(30).max(3600).default(300),
      })
      .parse(await c.req.json());
    return c.json(
      service.renewManagerWork(c.req.param("id"), body.owner, body.leaseSeconds),
    );
  });

  app.post("/api/manager-work/:id/complete", async (c) => {
    const body = z
      .object({ owner: z.string().min(1), success: z.boolean() })
      .parse(await c.req.json());
    return c.json(
      service.completeManagerWork(c.req.param("id"), body.owner, body.success),
    );
  });

  app.post("/api/agent-runs", async (c) => {
    const body = z
      .object({
        projectId: z.string().min(1),
        workId: z.string().min(1),
        agentProfile: z.string().min(1),
        foundationRef: z.string().min(1),
        runtime: z.string().min(1),
        model: z.string().optional(),
      })
      .parse(await c.req.json());
    return c.json(service.recordAgentRunStart(body), 201);
  });

  app.post("/api/agent-runs/:id/finish", async (c) => {
    const body = z
      .object({
        success: z.boolean(),
        resultSummary: z.string().optional(),
        errorSummary: z.string().optional(),
      })
      .parse(await c.req.json());
    return c.json(
      service.recordAgentRunFinish({
        runId: c.req.param("id"),
        ...body,
      }),
    );
  });

  app.all("/mcp", async (c) => {
    const principalId = actorFromRequest(c.req.header("Authorization"));
    if (principalId === "human") {
      return c.json(
        { error: { message: "Authorization: Bearer <AgentName> is required" } },
        401,
      );
    }
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const server = createMcpServer(service, principalId);
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });

  app.all("/api/*", (c) => c.json({ error: { message: "Not Found" } }, 404));

  const root = fileURLToPath(new URL("../public", import.meta.url));
  app.use("/*", serveStatic({ root }));
  app.get("*", serveStatic({ root, path: "index.html" }));

  app.onError((error, c) => {
    console.error(error);
    const message =
      error instanceof z.ZodError
        ? error.issues.map((issue) => issue.message).join("; ")
        : error instanceof Error
          ? error.message
          : "Internal Server Error";
    return c.json({ error: { message } }, 400);
  });

  return app;
};
