import assert from "node:assert/strict";
import test from "node:test";
import { parseRoute } from "../src/frontend/src/App.js";

test("frontend routes project pages", () => {
  assert.deepEqual(parseRoute("/"), { page: "projects" });
  assert.deepEqual(parseRoute("/projects"), { page: "projects" });
  assert.deepEqual(parseRoute("/projects/new"), { page: "new-project" });
  assert.deepEqual(parseRoute("/projects/project%201"), {
    page: "project",
    projectId: "project 1",
  });
  assert.deepEqual(parseRoute("/unknown"), { page: "not-found" });
});
