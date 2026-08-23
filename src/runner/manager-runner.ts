import { spawn } from "node:child_process";

const baseUrl = process.env.SHIRUBE_URL ?? "http://localhost:51740";
const runnerId = process.env.MANAGER_RUNNER_ID ?? `manager-runner-${process.pid}`;
const pollMs = Number(process.env.MANAGER_POLL_MS ?? "2000");
const leaseSeconds = Number(process.env.MANAGER_LEASE_SECONDS ?? "900");
const command = process.env.MANAGER_COMMAND?.trim();

if (!command) {
  console.error("MANAGER_COMMAND is required.");
  process.exit(1);
}

type ManagerWork = {
  id: string;
  projectId: string;
  attempt: number;
  reasonType: string;
  subjectType: string;
  subjectId: string;
};

type ProjectOverview = {
  project: {
    foundationRef: string | null;
    managerProfile: string;
  };
};

const postJson = async <T>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as T;
};

const runCommand = (
  work: ManagerWork,
  overview: ProjectOverview,
  runId: string,
  signal: AbortSignal,
) =>
  new Promise<number>((resolve) => {
    const child = spawn(command!, {
      shell: true,
      stdio: "inherit",
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        SHIRUBE_MANAGER_WORK_ID: work.id,
        SHIRUBE_PROJECT_ID: work.projectId,
        SHIRUBE_SUBJECT_TYPE: work.subjectType,
        SHIRUBE_SUBJECT_ID: work.subjectId,
        SHIRUBE_REASON_TYPE: work.reasonType,
        SHIRUBE_AGENT_RUN_ID: runId,
        SHIRUBE_MANAGER_PROFILE: overview.project.managerProfile,
        ...(overview.project.foundationRef
          ? { SHIRUBE_FOUNDATION_REF: overview.project.foundationRef }
          : {}),
      },
    });
    let settled = false;
    const finish = (code: number) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", terminate);
      resolve(code);
    };
    const terminate = () => {
      if (!child.pid) return;
      try {
        if (process.platform === "win32") child.kill("SIGTERM");
        else process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    };
    signal.addEventListener("abort", terminate, { once: true });
    child.on("error", () => finish(1));
    child.on("exit", (code) => finish(code ?? 1));
    if (signal.aborted) terminate();
  });

const tick = async () => {
  const work = await postJson<ManagerWork | null>("/api/manager-work/claim", {
    owner: runnerId,
    leaseSeconds,
  });
  if (!work) return;

  const overviewResponse = await fetch(
    `${baseUrl}/api/projects/${work.projectId}/overview`,
  );
  if (!overviewResponse.ok) {
    throw new Error(`Failed to load project overview for ${work.projectId}`);
  }
  const overview = (await overviewResponse.json()) as ProjectOverview;

  const run = await postJson<{ id: string }>("/api/agent-runs", {
    projectId: work.projectId,
    workId: work.id,
    workAttempt: work.attempt,
    owner: runnerId,
    agentProfile: overview.project.managerProfile,
    foundationRef: overview.project.foundationRef ?? undefined,
    runtime: "manager-runner",
  });

  const commandController = new AbortController();
  let leaseValid = true;
  const renewTimer = setInterval(() => {
    postJson(`/api/manager-work/${work.id}/renew`, {
      owner: runnerId,
      attempt: work.attempt,
      leaseSeconds,
    }).catch((error) => {
      leaseValid = false;
      console.error("Manager Work lease was lost; stopping Manager:", error);
      commandController.abort();
    });
  }, Math.max(15_000, Math.floor((leaseSeconds * 1000) / 2)));

  const exitCode = await runCommand(
    work,
    overview,
    run.id,
    commandController.signal,
  );
  clearInterval(renewTimer);
  if (!leaseValid) return;
  const success = exitCode === 0;

  await postJson(`/api/agent-runs/${run.id}/finish`, {
    success,
    owner: runnerId,
    workAttempt: work.attempt,
    resultSummary: success ? "Manager command completed." : undefined,
    errorSummary: success ? undefined : `Manager command exited with ${exitCode}.`,
  });
  await postJson(`/api/manager-work/${work.id}/complete`, {
    owner: runnerId,
    attempt: work.attempt,
    success,
  });
};

console.log(`Manager Runner ${runnerId} watching ${baseUrl}`);

while (true) {
  try {
    await tick();
  } catch (error) {
    console.error("Manager Runner tick failed:", error);
  }
  await new Promise((resolve) => setTimeout(resolve, pollMs));
}
