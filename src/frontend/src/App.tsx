import { FormEvent, useEffect, useMemo, useState } from "react";

type Project = {
  id: string;
  name: string;
  description: string | null;
  foundationRef: string;
  managerProfile: string;
};

type Artifact = {
  id: string;
  type: string;
  status: string;
  title: string;
  payload: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
};

type Overview = {
  project: Project;
  artifacts: Record<string, Artifact[]>;
  relations: Array<{
    id: string;
    fromArtifactId: string;
    relationType: string;
    toArtifactId: string;
  }>;
  managerWork: Array<{ id: string; reasonType: string; status: string }>;
  agentRuns: Array<{ id: string; agentProfile: string; status: string; foundationRef: string }>;
};

const sections = [
  ["mission", "Mission"],
  ["research", "Research"],
  ["evidence", "Evidence"],
  ["decision", "Decision"],
  ["vision", "Vision"],
  ["outcome", "Outcome"],
] as const;

const improvementSections = [
  ["improvement_observation", "Observations"],
  ["improvement_finding", "Findings"],
  ["improvement_proposal", "Proposals"],
  ["improvement_evaluation", "Evaluations"],
] as const;

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as T;
}

export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  const selected = useMemo(
    () => projects.find((project) => project.id === projectId),
    [projects, projectId],
  );

  const reloadProjects = async () => {
    const data = await json<Project[]>("/api/projects");
    setProjects(data);
    if (!projectId && data[0]) setProjectId(data[0].id);
  };

  const reloadOverview = async () => {
    if (!projectId) {
      setOverview(null);
      return;
    }
    setOverview(await json<Overview>(`/api/projects/${projectId}/overview`));
  };

  useEffect(() => {
    reloadProjects().catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    reloadOverview().catch((e) => setError(String(e)));
  }, [projectId]);

  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await json<Project>("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description"),
      }),
    });
    event.currentTarget.reset();
    await reloadProjects();
  };

  const createMission = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectId) return;
    const form = new FormData(event.currentTarget);
    await json(`/api/projects/${projectId}/artifacts/mission`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        payload: {
          statement: form.get("statement"),
          context: form.get("context") || undefined,
          constraints: [],
        },
      }),
    });
    event.currentTarget.reset();
    await reloadOverview();
  };

  return (
    <main className="shell">
      <header>
        <div>
          <p className="eyebrow">Agent Control Plane</p>
          <h1>Shirube</h1>
          <p className="muted">WHY / WHAT / LEARNING を、追跡可能な状態として残す。</p>
        </div>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Projectを選択</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="panel">
        <h2>新しいProject</h2>
        <form className="inlineForm" onSubmit={createProject}>
          <input name="name" placeholder="Project name" required />
          <input name="description" placeholder="Description" />
          <button type="submit">Create</button>
        </form>
      </section>

      {selected && (
        <>
          <section className="hero panel">
            <div>
              <p className="eyebrow">Current Project</p>
              <h2>{selected.name}</h2>
              <p>{selected.description || "No description"}</p>
            </div>
            <dl>
              <div><dt>Foundation</dt><dd>{selected.foundationRef}</dd></div>
              <div><dt>Manager</dt><dd>{selected.managerProfile}</dd></div>
            </dl>
          </section>

          <section className="panel">
            <h2>Missionを追加</h2>
            <form className="missionForm" onSubmit={createMission}>
              <input name="title" placeholder="Mission title" required />
              <textarea name="statement" placeholder="達成したいこと" required />
              <textarea name="context" placeholder="背景・制約（任意）" />
              <button type="submit">Create Mission</button>
            </form>
          </section>

          <section>
            <div className="sectionHeading">
              <div>
                <p className="eyebrow">Intent Trail</p>
                <h2>Mission → Outcome</h2>
              </div>
              <span>{overview?.relations.length ?? 0} provenance links</span>
            </div>
            <div className="trail">
              {sections.map(([key, label]) => (
                <div className="column" key={key}>
                  <h3>{label}</h3>
                  {(overview?.artifacts[key] ?? []).length === 0 && (
                    <p className="empty">まだありません</p>
                  )}
                  {(overview?.artifacts[key] ?? []).map((artifact) => (
                    <article className="card" key={artifact.id}>
                      <strong>{artifact.title}</strong>
                      <span>{artifact.status}</span>
                      <small>{artifact.createdBy}</small>
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section className="grid2">
            <div className="panel">
              <p className="eyebrow">Manager Runtime</p>
              <h2>Manager Work</h2>
              {(overview?.managerWork ?? []).map((work) => (
                <div className="row" key={work.id}>
                  <span>{work.reasonType}</span>
                  <b>{work.status}</b>
                </div>
              ))}
              {(overview?.managerWork ?? []).length === 0 && <p className="empty">No work</p>}
              <h3>Agent Runs</h3>
              {(overview?.agentRuns ?? []).map((run) => (
                <div className="row" key={run.id}>
                  <span>{run.agentProfile}</span>
                  <b>{run.status}</b>
                </div>
              ))}
            </div>

            <div className="panel">
              <p className="eyebrow">Learning Loop</p>
              <h2>Improvement</h2>
              {improvementSections.map(([key, label]) => (
                <div className="row" key={key}>
                  <span>{label}</span>
                  <b>{overview?.artifacts[key]?.length ?? 0}</b>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
