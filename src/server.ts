import { serve } from "@hono/node-server";
import { ShirubeDatabase } from "./database.js";
import { ControlPlaneService } from "./service.js";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 51743);
const database = new ShirubeDatabase();
const service = new ControlPlaneService(database);
const app = createApp(service);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Shirube listening on http://localhost:${info.port}`);
  console.log(`MCP endpoint: http://localhost:${info.port}/mcp`);
});

const shutdown = () => {
  database.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
