import { FormEvent, ReactNode, useEffect, useState } from "react";

type Project = {
  id: string;
  name: string;
  description: string | null;
  foundationRef: string | null;
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
  agentRuns: Array<{
    id: string;
    agentProfile: string;
    status: string;
    foundationRef: string | null;
  }>;
};

type Route =
  | { page: "projects" }
  | { page: "new-project" }
  | { page: "project"; projectId: string }
  | { page: "not-found" };

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

export const parseRoute = (pathname: string): Route => {
  if (pathname === "/" || pathname === "/projects") return { page: "projects" };
  if (pathname === "/projects/new") return { page: "new-project" };
  const match = pathname.match(/^\/projects\/([^/]+)\/?$/);
  if (match?.[1]) {
    return { page: "project", projectId: decodeURIComponent(match[1]) };
  }
  return { page: "not-found" };
};

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as T;
}

function Link({
  to,
  navigate,
  className,
  children,
}: {
  to: string;
  navigate: (to: string) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={to}
      className={className}
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));
  const [projects, setProjects] = useState<Project[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [error, setError] = useState("");

  const navigate = (to: string) => {
    window.history.pushState(null, "", to);
    setRoute(parseRoute(to));
    setError("");
    window.scrollTo({ top: 0 });
  };

  const reloadProjects = async () => {
    setProjects(await json<Project[]>("/api/projects"));
  };

  const reloadOverview = async (projectId: string) => {
    setOverview(await json<Overview>(`/api/projects/${projectId}/overview`));
  };

  useEffect(() => {
    if (window.location.pathname === "/") {
      window.history.replaceState(null, "", "/projects");
    }
    const onPopState = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    reloadProjects().catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (route.page !== "project") {
      setOverview(null);
      setLoadingOverview(false);
      return;
    }
    let active = true;
    setOverview(null);
    setLoadingOverview(true);
    json<Overview>(`/api/projects/${route.projectId}/overview`)
      .then((data) => {
        if (active) setOverview(data);
      })
      .catch((e) => {
        if (active) setError(String(e));
      })
      .finally(() => {
        if (active) setLoadingOverview(false);
      });
    return () => {
      active = false;
    };
  }, [route]);

  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      setError("");
      const project = await json<Project>("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description"),
          foundationRef: form.get("foundationRef") || undefined,
        }),
      });
      formElement.reset();
      await reloadProjects();
      navigate(`/projects/${project.id}`);
    } catch (e) {
      setError(String(e));
    }
  };

  const createMission = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (route.page !== "project") return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      setError("");
      await json(`/api/projects/${route.projectId}/artifacts/mission`, {
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
      formElement.reset();
      await reloadOverview(route.projectId);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <main className="shell">
      <header className="appHeader">
        <Link to="/projects" navigate={navigate} className="brandLink">
          <p className="eyebrow">Agent Control Plane</p>
          <span className="brandName">Shirube</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/projects" navigate={navigate}>Projects</Link>
          <Link to="/projects/new" navigate={navigate} className="buttonLink">
            New Project
          </Link>
        </nav>
      </header>

      {error && <div className="error">{error}</div>}

      {route.page === "projects" && (
        <ProjectsPage projects={projects} navigate={navigate} />
      )}
      {route.page === "new-project" && (
        <NewProjectPage navigate={navigate} onSubmit={createProject} />
      )}
      {route.page === "project" && (
        <ProjectPage
          overview={overview}
          loading={loadingOverview}
          navigate={navigate}
          onCreateMission={createMission}
        />
      )}
      {route.page === "not-found" && (
        <section className="emptyState panel">
          <p className="eyebrow">404</p>
          <h1>ページが見つかりません</h1>
          <Link to="/projects" navigate={navigate} className="buttonLink">
            Project一覧へ
          </Link>
        </section>
      )}
    </main>
  );
}

function ProjectsPage({
  projects,
  navigate,
}: {
  projects: Project[];
  navigate: (to: string) => void;
}) {
  return (
    <>
      <div className="pageHeading">
        <div>
          <p className="eyebrow">Projects</p>
          <h1>Project一覧</h1>
          <p className="muted">Missionと学習の流れをProjectごとに管理します。</p>
        </div>
        <Link to="/projects/new" navigate={navigate} className="buttonLink">
          New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <section className="emptyState panel">
          <h2>最初のProjectを作成しましょう</h2>
          <p className="muted">Projectを作成すると、Missionを登録できます。</p>
          <Link to="/projects/new" navigate={navigate} className="buttonLink">
            Projectを作成
          </Link>
        </section>
      ) : (
        <section className="projectGrid" aria-label="Project list">
          {projects.map((project) => (
            <article className="projectCard" key={project.id}>
              <div>
                <p className="eyebrow">Project</p>
                <h2>{project.name}</h2>
                <p className="muted">{project.description || "説明はありません"}</p>
              </div>
              <dl>
                <div><dt>Manager</dt><dd>{project.managerProfile}</dd></div>
                <div><dt>Foundation</dt><dd>{project.foundationRef || "未設定"}</dd></div>
              </dl>
              <Link
                to={`/projects/${project.id}`}
                navigate={navigate}
                className="textLink"
              >
                Projectを開く →
              </Link>
            </article>
          ))}
        </section>
      )}
    </>
  );
}

function NewProjectPage({
  navigate,
  onSubmit,
}: {
  navigate: (to: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <div className="narrowPage">
      <Link to="/projects" navigate={navigate} className="backLink">← Project一覧</Link>
      <section className="panel formPanel">
        <p className="eyebrow">New Project</p>
        <h1>Projectを作成</h1>
        <p className="muted">まずProjectの名前と目的を登録します。</p>
        <form className="missionForm" onSubmit={onSubmit}>
          <label>
            Project name
            <input name="name" placeholder="Project name" required />
          </label>
          <label>
            Description
            <textarea name="description" placeholder="このProjectで実現したいこと" />
          </label>
          <label>
            Foundation reference <span className="optional">任意</span>
            <input
              name="foundationRef"
              placeholder="https://github.com/org/agent-foundation.git#<commit SHA>"
            />
          </label>
          <div className="formActions">
            <Link to="/projects" navigate={navigate} className="secondaryLink">
              キャンセル
            </Link>
            <button type="submit">Create Project</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ProjectPage({
  overview,
  loading,
  navigate,
  onCreateMission,
}: {
  overview: Overview | null;
  loading: boolean;
  navigate: (to: string) => void;
  onCreateMission: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  if (loading) return <p className="empty">Projectを読み込んでいます…</p>;
  if (!overview) return null;

  return (
    <>
      <Link to="/projects" navigate={navigate} className="backLink">← Project一覧</Link>
      <section className="hero panel">
        <div>
          <p className="eyebrow">Project</p>
          <h1>{overview.project.name}</h1>
          <p>{overview.project.description || "No description"}</p>
        </div>
        <dl>
          <div><dt>Foundation</dt><dd>{overview.project.foundationRef || "未設定"}</dd></div>
          <div><dt>Manager</dt><dd>{overview.project.managerProfile}</dd></div>
        </dl>
      </section>

      <section className="panel">
        <h2>Missionを追加</h2>
        <form className="missionForm" onSubmit={onCreateMission}>
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
          <span>{overview.relations.length} provenance links</span>
        </div>
        <div className="trail">
          {sections.map(([key, label]) => (
            <div className="column" key={key}>
              <h3>{label}</h3>
              {(overview.artifacts[key] ?? []).length === 0 && (
                <p className="empty">まだありません</p>
              )}
              {(overview.artifacts[key] ?? []).map((artifact) => (
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
          {overview.managerWork.map((work) => (
            <div className="row" key={work.id}>
              <span>{work.reasonType}</span>
              <b>{work.status}</b>
            </div>
          ))}
          {overview.managerWork.length === 0 && <p className="empty">No work</p>}
          <h3>Agent Runs</h3>
          {overview.agentRuns.map((run) => (
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
              <b>{overview.artifacts[key]?.length ?? 0}</b>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
