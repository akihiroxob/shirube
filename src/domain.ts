export const ARTIFACT_TYPES = [
  "mission",
  "research",
  "evidence",
  "decision",
  "vision",
  "outcome",
  "human_decision_request",
  "improvement_observation",
  "improvement_finding",
  "improvement_proposal",
  "improvement_evaluation",
] as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export const RELATION_TYPES = [
  "derived_from",
  "supported_by",
  "contradicts",
  "supersedes",
  "requires",
  "blocks",
  "implements",
  "executes_as",
  "evaluates",
  "improves",
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

export const isPinnedFoundationRef = (value: string) =>
  /#[0-9a-f]{40}(?:[0-9a-f]{24})?$/i.test(value);

export type Project = {
  id: string;
  name: string;
  description: string | null;
  foundationRef: string | null;
  managerProfile: string;
  createdAt: string;
  updatedAt: string;
};

export type Artifact = {
  id: string;
  projectId: string;
  type: ArtifactType;
  status: string;
  title: string;
  payload: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ArtifactRelation = {
  id: string;
  projectId: string;
  fromArtifactId: string;
  relationType: RelationType;
  toArtifactId: string;
  createdBy: string;
  createdAt: string;
};

export type Change = {
  cursor: number;
  projectId: string;
  type: string;
  subjectType: string;
  subjectId: string;
  actor: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ManagerWork = {
  id: string;
  projectId: string;
  reasonType: string;
  subjectType: string;
  subjectId: string;
  status: "available" | "running" | "completed" | "failed" | "canceled";
  claimOwner: string | null;
  claimExpiresAt: string | null;
  attempt: number;
  createdAt: string;
  updatedAt: string;
};

export type AgentRun = {
  id: string;
  projectId: string;
  workId: string;
  workAttempt: number;
  agentProfile: string;
  foundationRef: string | null;
  runtime: string;
  model: string | null;
  status: "running" | "succeeded" | "failed" | "canceled";
  startedAt: string;
  finishedAt: string | null;
  resultSummary: string | null;
  errorSummary: string | null;
};
