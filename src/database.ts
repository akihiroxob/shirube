import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export class ShirubeDatabase {
  readonly raw: Database.Database;

  constructor(path = process.env.SHIRUBE_DB_PATH ?? ".tmp/shirube.db") {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }
    this.raw = new Database(path);
    this.raw.pragma("journal_mode = WAL");
    this.raw.pragma("foreign_keys = ON");
    this.migrate();
  }

  close() {
    this.raw.close();
  }

  private migrate() {
    this.raw.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        foundation_ref TEXT NOT NULL,
        manager_profile TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_artifacts_project_type
        ON artifacts(project_id, type, created_at);

      CREATE TABLE IF NOT EXISTS artifact_relations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        from_artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
        relation_type TEXT NOT NULL,
        to_artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(from_artifact_id, relation_type, to_artifact_id)
      );

      CREATE TABLE IF NOT EXISTS changes (
        cursor INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        subject_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        actor TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_changes_project_cursor
        ON changes(project_id, cursor);

      CREATE TABLE IF NOT EXISTS manager_work (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        reason_type TEXT NOT NULL,
        subject_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        status TEXT NOT NULL,
        claim_owner TEXT,
        claim_expires_at TEXT,
        attempt INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_manager_work_status
        ON manager_work(status, created_at);

      CREATE TABLE IF NOT EXISTS agent_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        work_id TEXT NOT NULL,
        agent_profile TEXT NOT NULL,
        foundation_ref TEXT NOT NULL,
        runtime TEXT NOT NULL,
        model TEXT,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        result_summary TEXT,
        error_summary TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_agent_runs_project_started
        ON agent_runs(project_id, started_at DESC);
    `);
  }
}
