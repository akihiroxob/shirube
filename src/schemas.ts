import { z } from "zod";
import {
  ARTIFACT_TYPES,
  RELATION_TYPES,
  isPinnedFoundationRef,
} from "./domain.js";

export const foundationRefSchema = z
  .string()
  .trim()
  .refine(isPinnedFoundationRef, {
    message: "foundationRef must end with an immutable 40- or 64-character commit SHA",
  });

export const projectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  foundationRef: z
    .union([foundationRefSchema, z.literal("")])
    .optional()
    .transform((value) => value || undefined),
  managerProfile: z.string().min(1).optional(),
});

export const artifactTypeSchema = z.enum(ARTIFACT_TYPES);
export const relationTypeSchema = z.enum(RELATION_TYPES);

export const artifactInputSchemas = {
  mission: z.object({
    statement: z.string().min(1),
    context: z.string().optional(),
    constraints: z.array(z.string()).optional(),
  }),
  research: z.object({
    question: z.string().min(1),
    summary: z.string().min(1),
    findings: z.array(z.string()).default([]),
    limitations: z.array(z.string()).default([]),
    confidence: z.number().min(0).max(1).optional(),
  }),
  evidence: z.object({
    evidenceType: z.enum([
      "web",
      "repository",
      "document",
      "experiment",
      "metric",
      "human_input",
      "other",
    ]),
    locator: z.string().min(1),
    summary: z.string().optional(),
    capturedAt: z.string().optional(),
  }),
  decision: z.object({
    question: z.string().min(1),
    options: z.array(z.string()).min(1),
    selectedOption: z.string().min(1),
    rationale: z.string().min(1),
    decisionAuthority: z.enum(["agent", "human", "policy"]).default("agent"),
  }),
  vision: z.object({
    statement: z.string().min(1),
    description: z.string().optional(),
  }),
  outcome: z.object({
    statement: z.string().min(1),
    successCriteria: z.array(z.string()).min(1),
    evaluationSummary: z.string().optional(),
  }),
  human_decision_request: z.object({
    question: z.string().min(1),
    context: z.string().optional(),
    options: z.array(z.string()).min(1),
    recommendation: z.string().optional(),
    rationale: z.string().optional(),
    blocking: z.boolean().default(true),
  }),
  improvement_observation: z.object({
    category: z.string().min(1),
    summary: z.string().min(1),
    sourceRef: z.string().optional(),
    metricSnapshot: z.record(z.string(), z.unknown()).optional(),
  }),
  improvement_finding: z.object({
    summary: z.string().min(1),
    diagnosis: z.string().min(1),
    scope: z.enum(["project", "general_candidate"]),
    confidence: z.number().min(0).max(1).optional(),
  }),
  improvement_proposal: z.object({
    findingId: z.string().optional(),
    targetType: z.enum([
      "project_context",
      "agent_foundation",
      "workflow",
      "policy",
      "other",
    ]),
    targetRef: z.string().optional(),
    proposedChange: z.string().min(1),
    expectedEffect: z.string().min(1),
    risks: z.array(z.string()).default([]),
  }),
  improvement_evaluation: z.object({
    proposalId: z.string().min(1),
    baselineRef: z.string().min(1),
    candidateRef: z.string().min(1),
    method: z.string().min(1),
    metrics: z.record(z.string(), z.unknown()),
    result: z.enum(["improved", "neutral", "regressed", "inconclusive"]),
    summary: z.string().min(1),
  }),
} as const;

export type ArtifactInputType = keyof typeof artifactInputSchemas;
