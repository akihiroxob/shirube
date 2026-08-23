import { randomUUID } from "node:crypto";
import { ShirubeDatabase } from "./database.js";
import {
  ARTIFACT_TYPES,
  RELATION_TYPES,
  isPinnedFoundationRef,
  type AgentRun,
  type Artifact,
  type ArtifactRelation,
  type ArtifactType,
  type Change,
  type ManagerWork,
  type Project,
  type RelationType,
} from "./domain.js";

const now = () => new Date().toISOString();
const parseJson = <T>(value: string): T => JSON.parse(value) as T;

export class ControlPlaneService {
  constructor(private readonly db: ShirubeDatabase) {}

  createProject(input: {
    name: string;
    description?: string;
    foundationRef?: string | null;
    managerProfile?: string;
    actor: string;
  }): Project {
    const foundationRef = input.foundationRef?.trim() || null;
    if (foundationRef && !isPinnedFoundationRef(foundationRef)) {
      throw new Error(
        "foundationRef must end with an immutable 40- or 64-character commit SHA",
      );
    }
    const id = randomUUID();
    const timestamp = now();
    const project: Project = {
      id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      foundationRef,
      managerProfile: input.managerProfile?.trim() || "manager",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.db.raw.prepare(`
      INSERT INTO projects
      (id, name, description, foundation_ref, manager_profile, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      project.id,
      project.name,
      project.description,
      project.foundationRef ?? "",
      project.managerProfile,
      project.createdAt,
      project.updatedAt,
    );

    this.appendChange(
      project.id,
      "PROJECT_CREATED",
      "project",
      project.id,
      input.actor,
      { name: project.name },
    );
    return project;
  }

  listProjects(): Project[] {
    const rows = this.db.raw.prepare(`
      SELECT id, name, description, foundation_ref, manager_profile, created_at, updated_at
      FROM projects ORDER BY created_at DESC
    `).all() as Array<Record<string, string | null>>;

    return rows.map((row) => ({
      id: row.id!,
      name: row.name!,
      description: row.description,
      foundationRef: row.foundation_ref || null,
      managerProfile: row.manager_profile!,
      createdAt: row.created_at!,
      updatedAt: row.updated_at!,
    }));
  }

  getProject(projectId: string): Project {
    const row = this.db.raw.prepare(`
      SELECT id, name, description, foundation_ref, manager_profile, created_at, updated_at
      FROM projects WHERE id = ?
    `).get(projectId) as Record<string, string | null> | undefined;
    if (!row) throw new Error(`Project not found: ${projectId}`);
    return {
      id: row.id!,
      name: row.name!,
      description: row.description,
      foundationRef: row.foundation_ref || null,
      managerProfile: row.manager_profile!,
      createdAt: row.created_at!,
      updatedAt: row.updated_at!,
    };
  }

  createArtifact(input: {
    projectId: string;
    type: ArtifactType;
    title: string;
    status?: string;
    payload?: Record<string, unknown>;
    actor: string;
  }): Artifact {
    if (!ARTIFACT_TYPES.includes(input.type)) {
      throw new Error(`Unsupported artifact type: ${input.type}`);
    }
    this.getProject(input.projectId);

    const artifact: Artifact = {
      id: randomUUID(),
      projectId: input.projectId,
      type: input.type,
      status: input.status ?? "active",
      title: input.title.trim(),
      payload: input.payload ?? {},
      createdBy: input.actor,
      createdAt: now(),
      updatedAt: now(),
    };

    const tx = this.db.raw.transaction(() => {
      this.db.raw.prepare(`
        INSERT INTO artifacts
        (id, project_id, type, status, title, payload_json, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        artifact.id,
        artifact.projectId,
        artifact.type,
        artifact.status,
        artifact.title,
        JSON.stringify(artifact.payload),
        artifact.createdBy,
        artifact.createdAt,
        artifact.updatedAt,
      );

      this.appendChange(
        artifact.projectId,
        `${artifact.type.toUpperCase()}_CREATED`,
        artifact.type,
        artifact.id,
        input.actor,
        { title: artifact.title, status: artifact.status },
      );

      if (artifact.type === "mission") {
        this.createManagerWorkInternal({
          projectId: artifact.projectId,
          reasonType: "MISSION_REVIEW_REQUIRED",
          subjectType: artifact.type,
          subjectId: artifact.id,
          actor: input.actor,
        });
      }
    });
    tx();

    return artifact;
  }

  listArtifacts(projectId: string, type?: ArtifactType): Artifact[] {
    this.getProject(projectId);
    const rows = (type
      ? this.db.raw.prepare(`
          SELECT * FROM artifacts
          WHERE project_id = ? AND type = ?
          ORDER BY created_at DESC
        `).all(projectId, type)
      : this.db.raw.prepare(`
          SELECT * FROM artifacts
          WHERE project_id = ?
          ORDER BY created_at DESC
        `).all(projectId)) as Array<Record<string, string>>;

    return rows.map((row) => this.mapArtifact(row));
  }

  getArtifact(id: string): Artifact {
    const row = this.db.raw.prepare(`SELECT * FROM artifacts WHERE id = ?`).get(id) as
      | Record<string, string>
      | undefined;
    if (!row) throw new Error(`Artifact not found: ${id}`);
    return this.mapArtifact(row);
  }

  linkArtifacts(input: {
    projectId: string;
    fromArtifactId: string;
    relationType: RelationType;
    toArtifactId: string;
    actor: string;
  }): ArtifactRelation {
    if (!RELATION_TYPES.includes(input.relationType)) {
      throw new Error(`Unsupported relation type: ${input.relationType}`);
    }
    const from = this.getArtifact(input.fromArtifactId);
    const to = this.getArtifact(input.toArtifactId);
    if (from.projectId !== input.projectId || to.projectId !== input.projectId) {
      throw new Error("Both artifacts must belong to the requested project");
    }

    const relation: ArtifactRelation = {
      id: randomUUID(),
      projectId: input.projectId,
      fromArtifactId: input.fromArtifactId,
      relationType: input.relationType,
      toArtifactId: input.toArtifactId,
      createdBy: input.actor,
      createdAt: now(),
    };

    this.db.raw.prepare(`
      INSERT INTO artifact_relations
      (id, project_id, from_artifact_id, relation_type, to_artifact_id, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      relation.id,
      relation.projectId,
      relation.fromArtifactId,
      relation.relationType,
      relation.toArtifactId,
      relation.createdBy,
      relation.createdAt,
    );

    this.appendChange(
      input.projectId,
      "ARTIFACTS_LINKED",
      "artifact_relation",
      relation.id,
      input.actor,
      {
        fromArtifactId: relation.fromArtifactId,
        relationType: relation.relationType,
        toArtifactId: relation.toArtifactId,
      },
    );
    return relation;
  }

  listRelations(projectId: string): ArtifactRelation[] {
    const rows = this.db.raw.prepare(`
      SELECT * FROM artifact_relations
      WHERE project_id = ?
      ORDER BY created_at ASC
    `).all(projectId) as Array<Record<string, string>>;
    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      fromArtifactId: row.from_artifact_id,
      relationType: row.relation_type as RelationType,
      toArtifactId: row.to_artifact_id,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }));
  }

  getProjectOverview(projectId: string) {
    const project = this.getProject(projectId);
    const artifacts = this.listArtifacts(projectId);
    const byType = Object.fromEntries(
      ARTIFACT_TYPES.map((type) => [
        type,
        artifacts.filter((artifact) => artifact.type === type),
      ]),
    );
    return {
      project,
      artifacts: byType,
      relations: this.listRelations(projectId),
      managerWork: this.listManagerWork(projectId),
      agentRuns: this.listAgentRuns(projectId),
    };
  }

  listChanges(projectId: string, afterCursor = 0, limit = 100): Change[] {
    const rows = this.db.raw.prepare(`
      SELECT * FROM changes
      WHERE project_id = ? AND cursor > ?
      ORDER BY cursor ASC LIMIT ?
    `).all(projectId, afterCursor, limit) as Array<Record<string, string | number>>;

    return rows.map((row) => ({
      cursor: Number(row.cursor),
      projectId: String(row.project_id),
      type: String(row.type),
      subjectType: String(row.subject_type),
      subjectId: String(row.subject_id),
      actor: String(row.actor),
      payload: parseJson<Record<string, unknown>>(String(row.payload_json)),
      createdAt: String(row.created_at),
    }));
  }

  claimNextManagerWork(owner: string, leaseSeconds = 300): ManagerWork | null {
    const timestamp = now();
    const expiresAt = new Date(Date.now() + leaseSeconds * 1000).toISOString();

    const tx = this.db.raw.transaction(() => {
      const row = this.db.raw.prepare(`
        SELECT * FROM manager_work
        WHERE status = 'available'
           OR (status = 'running' AND claim_expires_at IS NOT NULL AND claim_expires_at < ?)
        ORDER BY created_at ASC
        LIMIT 1
      `).get(timestamp) as Record<string, string | number | null> | undefined;

      if (!row) return null;

      const result = this.db.raw.prepare(`
        UPDATE manager_work
        SET status = 'running',
            claim_owner = ?,
            claim_expires_at = ?,
            attempt = attempt + 1,
            updated_at = ?
        WHERE id = ?
          AND (
            status = 'available'
            OR (status = 'running' AND claim_expires_at IS NOT NULL AND claim_expires_at < ?)
          )
      `).run(owner, expiresAt, timestamp, row.id, timestamp);

      if (result.changes !== 1) return null;
      return this.getManagerWork(String(row.id));
    });

    return tx();
  }

  renewManagerWork(
    id: string,
    owner: string,
    attempt: number,
    leaseSeconds = 300,
  ) {
    const timestamp = now();
    const expiresAt = new Date(Date.now() + leaseSeconds * 1000).toISOString();
    const result = this.db.raw.prepare(`
      UPDATE manager_work
      SET claim_expires_at = ?, updated_at = ?
      WHERE id = ?
        AND status = 'running'
        AND claim_owner = ?
        AND attempt = ?
        AND claim_expires_at > ?
    `).run(expiresAt, timestamp, id, owner, attempt, timestamp);
    if (result.changes !== 1) {
      throw new Error("Manager work lease is expired or owned by another claim");
    }
    return this.getManagerWork(id);
  }

  completeManagerWork(
    id: string,
    owner: string,
    attempt: number,
    success: boolean,
  ) {
    const tx = this.db.raw.transaction(() => {
      const work = this.getManagerWork(id);
      const status = success ? "completed" : "failed";
      const timestamp = now();
      const result = this.db.raw.prepare(`
        UPDATE manager_work
        SET status = ?, claim_expires_at = NULL, updated_at = ?
        WHERE id = ?
          AND status = 'running'
          AND claim_owner = ?
          AND attempt = ?
          AND claim_expires_at > ?
      `).run(status, timestamp, id, owner, attempt, timestamp);
      if (result.changes !== 1) {
        throw new Error("Manager work lease is expired or owned by another claim");
      }
      this.appendChange(
        work.projectId,
        success ? "MANAGER_WORK_COMPLETED" : "MANAGER_WORK_FAILED",
        "manager_work",
        work.id,
        owner,
        { reasonType: work.reasonType, attempt },
      );
      return this.getManagerWork(id);
    });
    return tx();
  }

  listManagerWork(projectId?: string): ManagerWork[] {
    const rows = (projectId
      ? this.db.raw.prepare(`
          SELECT * FROM manager_work WHERE project_id = ? ORDER BY created_at DESC
        `).all(projectId)
      : this.db.raw.prepare(`
          SELECT * FROM manager_work ORDER BY created_at DESC
        `).all()) as Array<Record<string, string | number | null>>;
    return rows.map((row) => this.mapManagerWork(row));
  }

  recordAgentRunStart(input: {
    projectId: string;
    workId: string;
    workAttempt: number;
    owner: string;
    agentProfile: string;
    foundationRef?: string | null;
    runtime: string;
    model?: string;
  }): AgentRun {
    const tx = this.db.raw.transaction(() => {
      const project = this.getProject(input.projectId);
      const work = this.getManagerWork(input.workId);
      this.assertActiveClaim(work, input.owner, input.workAttempt);
      if (work.projectId !== input.projectId) {
        throw new Error("Manager work does not belong to the requested project");
      }
      const foundationRef = input.foundationRef?.trim() || null;
      if (
        project.foundationRef !== foundationRef ||
        project.managerProfile !== input.agentProfile
      ) {
        throw new Error("AgentRun profile or foundationRef does not match the project");
      }

      const existing = this.db.raw.prepare(`
        SELECT * FROM agent_runs WHERE work_id = ? AND work_attempt = ?
      `).get(input.workId, input.workAttempt) as
        | Record<string, string | number | null>
        | undefined;
      if (existing) {
        const run = this.mapAgentRun(existing);
        if (run.status !== "running") {
          throw new Error("AgentRun for this ManagerWork attempt is already finished");
        }
        return run;
      }

      const staleRuns = this.db.raw.prepare(`
        SELECT * FROM agent_runs WHERE work_id = ? AND status = 'running'
      `).all(input.workId) as Array<Record<string, string | number | null>>;
      for (const staleRow of staleRuns) {
        const staleRun = this.mapAgentRun(staleRow);
        const finishedAt = now();
        this.db.raw.prepare(`
          UPDATE agent_runs
          SET status = 'canceled', finished_at = ?, error_summary = ?
          WHERE id = ? AND status = 'running'
        `).run(
          finishedAt,
          "Superseded by a newer ManagerWork claim.",
          staleRun.id,
        );
        this.appendChange(
          staleRun.projectId,
          "AGENT_RUN_CANCELED",
          "agent_run",
          staleRun.id,
          "manager-runner",
          { workId: staleRun.workId, workAttempt: staleRun.workAttempt },
        );
      }

      const run: AgentRun = {
        id: randomUUID(),
        projectId: input.projectId,
        workId: input.workId,
        workAttempt: input.workAttempt,
        agentProfile: input.agentProfile,
        foundationRef,
        runtime: input.runtime,
        model: input.model ?? null,
        status: "running",
        startedAt: now(),
        finishedAt: null,
        resultSummary: null,
        errorSummary: null,
      };
      this.db.raw.prepare(`
        INSERT INTO agent_runs
        (id, project_id, work_id, work_attempt, agent_profile, foundation_ref,
         runtime, model, status, started_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        run.id,
        run.projectId,
        run.workId,
        run.workAttempt,
        run.agentProfile,
        run.foundationRef ?? "",
        run.runtime,
        run.model,
        run.status,
        run.startedAt,
      );
      this.appendChange(
        run.projectId,
        "AGENT_RUN_STARTED",
        "agent_run",
        run.id,
        run.agentProfile,
        {
          workId: run.workId,
          workAttempt: run.workAttempt,
          foundationRef: run.foundationRef,
        },
      );
      return run;
    });
    return tx();
  }

  recordAgentRunFinish(input: {
    runId: string;
    success: boolean;
    owner: string;
    workAttempt: number;
    resultSummary?: string;
    errorSummary?: string;
  }): AgentRun {
    const tx = this.db.raw.transaction(() => {
      const row = this.db.raw.prepare(`SELECT * FROM agent_runs WHERE id = ?`).get(input.runId) as
        | Record<string, string | number | null>
        | undefined;
      if (!row) throw new Error(`AgentRun not found: ${input.runId}`);
      const current = this.mapAgentRun(row);
      if (current.status !== "running") return current;
      if (current.workAttempt !== input.workAttempt) {
        throw new Error("AgentRun does not belong to this ManagerWork attempt");
      }
      const work = this.getManagerWork(current.workId);
      this.assertActiveClaim(work, input.owner, input.workAttempt);
      const status = input.success ? "succeeded" : "failed";
      const result = this.db.raw.prepare(`
        UPDATE agent_runs
        SET status = ?, finished_at = ?, result_summary = ?, error_summary = ?
        WHERE id = ? AND status = 'running'
      `).run(
        status,
        now(),
        input.resultSummary ?? null,
        input.errorSummary ?? null,
        input.runId,
      );
      if (result.changes !== 1) return this.getAgentRun(input.runId);
      this.appendChange(
        current.projectId,
        input.success ? "AGENT_RUN_SUCCEEDED" : "AGENT_RUN_FAILED",
        "agent_run",
        input.runId,
        "manager-runner",
        { workId: current.workId, workAttempt: current.workAttempt },
      );
      return this.getAgentRun(input.runId);
    });
    return tx();
  }

  listAgentRuns(projectId: string): AgentRun[] {
    const rows = this.db.raw.prepare(`
      SELECT * FROM agent_runs WHERE project_id = ? ORDER BY started_at DESC
    `).all(projectId) as Array<Record<string, string | null>>;
    return rows.map((row) => this.mapAgentRun(row));
  }

  private createManagerWorkInternal(input: {
    projectId: string;
    reasonType: string;
    subjectType: string;
    subjectId: string;
    actor: string;
  }) {
    const id = randomUUID();
    const timestamp = now();
    this.db.raw.prepare(`
      INSERT INTO manager_work
      (id, project_id, reason_type, subject_type, subject_id, status, attempt, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'available', 0, ?, ?)
    `).run(
      id,
      input.projectId,
      input.reasonType,
      input.subjectType,
      input.subjectId,
      timestamp,
      timestamp,
    );
    this.appendChange(
      input.projectId,
      "MANAGER_WORK_CREATED",
      "manager_work",
      id,
      input.actor,
      { reasonType: input.reasonType, subjectId: input.subjectId },
    );
  }

  private getManagerWork(id: string): ManagerWork {
    const row = this.db.raw.prepare(`SELECT * FROM manager_work WHERE id = ?`).get(id) as
      | Record<string, string | number | null>
      | undefined;
    if (!row) throw new Error(`ManagerWork not found: ${id}`);
    return this.mapManagerWork(row);
  }

  private getAgentRun(id: string): AgentRun {
    const row = this.db.raw.prepare(`SELECT * FROM agent_runs WHERE id = ?`).get(id) as
      | Record<string, string | number | null>
      | undefined;
    if (!row) throw new Error(`AgentRun not found: ${id}`);
    return this.mapAgentRun(row);
  }

  private assertActiveClaim(
    work: ManagerWork,
    owner: string,
    attempt: number,
  ) {
    if (
      work.status !== "running" ||
      work.claimOwner !== owner ||
      work.attempt !== attempt ||
      !work.claimExpiresAt ||
      work.claimExpiresAt <= now()
    ) {
      throw new Error("Manager work lease is expired or owned by another claim");
    }
  }

  private appendChange(
    projectId: string,
    type: string,
    subjectType: string,
    subjectId: string,
    actor: string,
    payload: Record<string, unknown>,
  ) {
    this.db.raw.prepare(`
      INSERT INTO changes
      (project_id, type, subject_type, subject_id, actor, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      type,
      subjectType,
      subjectId,
      actor,
      JSON.stringify(payload),
      now(),
    );
  }

  private mapArtifact(row: Record<string, string>): Artifact {
    return {
      id: row.id,
      projectId: row.project_id,
      type: row.type as ArtifactType,
      status: row.status,
      title: row.title,
      payload: parseJson<Record<string, unknown>>(row.payload_json),
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapManagerWork(row: Record<string, string | number | null>): ManagerWork {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      reasonType: String(row.reason_type),
      subjectType: String(row.subject_type),
      subjectId: String(row.subject_id),
      status: String(row.status) as ManagerWork["status"],
      claimOwner: row.claim_owner ? String(row.claim_owner) : null,
      claimExpiresAt: row.claim_expires_at ? String(row.claim_expires_at) : null,
      attempt: Number(row.attempt),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private mapAgentRun(
    row: Record<string, string | number | null>,
  ): AgentRun {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      workId: String(row.work_id),
      workAttempt: Number(row.work_attempt),
      agentProfile: String(row.agent_profile),
      foundationRef: row.foundation_ref ? String(row.foundation_ref) : null,
      runtime: String(row.runtime),
      model: row.model === null ? null : String(row.model),
      status: String(row.status) as AgentRun["status"],
      startedAt: String(row.started_at),
      finishedAt: row.finished_at === null ? null : String(row.finished_at),
      resultSummary:
        row.result_summary === null ? null : String(row.result_summary),
      errorSummary:
        row.error_summary === null ? null : String(row.error_summary),
    };
  }
}
