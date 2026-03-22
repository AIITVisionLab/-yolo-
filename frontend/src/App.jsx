import { useEffect, useState } from "react";
import { AdminWorkspace } from "@/components/admin/AdminWorkspace";
import { BrandMark } from "@/components/BrandMark";
import { AnnotationWorkspace } from "@/components/annotation/AnnotationWorkspace";
import { AuthDialog } from "@/components/AuthDialog";
import { DetailsWorkspace } from "@/components/details/DetailsWorkspace";
import { HeroVisual } from "@/components/HeroVisual";
import { RecognitionWorkspace } from "@/components/recognition/RecognitionWorkspace";
import { WorkspaceNav } from "@/components/WorkspaceNav";
import {
  APP_NAME,
  DEFAULT_WORKSPACE,
  WORKSPACES,
  getWorkspaceMeta,
} from "@/appConfig";
import { getApiBaseLabel, requestApi } from "@/lib/api";
import { useSession } from "@/hooks/useSession";

const INITIAL_HEALTH = {
  state: "checking",
  message: "正在检查服务",
  data: null,
};

function getHealthTone(health) {
  if (health.state === "online") {
    return "online";
  }
  if (health.state === "offline") {
    return "critical";
  }
  return "neutral";
}

function getHealthSummary(health) {
  if (health.state === "online") {
    return "后端在线";
  }
  if (health.state === "offline") {
    return "后端不可用";
  }
  return "正在检测";
}

function getModelSummary(health) {
  if (health.state !== "online") {
    return "等待服务响应";
  }
  if (health.data?.model_loaded) {
    return health.data?.current_model ? `模型已载入 · ${health.data.current_model}` : "模型已载入";
  }
  return "模型未载入";
}

function App() {
  const session = useSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [hasPromptedAuth, setHasPromptedAuth] = useState(false);
  const [health, setHealth] = useState(INITIAL_HEALTH);
  const [recognitionPayload, setRecognitionPayload] = useState(null);
  const [workspace, setWorkspace] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return getWorkspaceMeta(params.get("workspace") || DEFAULT_WORKSPACE).id;
  });

  useEffect(() => {
    if (!session.isAuthenticated) {
      return;
    }
    if (session.user?.role !== "admin" && workspace === "admin") {
      setWorkspace(DEFAULT_WORKSPACE);
    }
  }, [session.isAuthenticated, session.user, workspace]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("workspace", workspace);
    const nextSearch = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}?${nextSearch}`);
  }, [workspace]);

  useEffect(() => {
    let cancelled = false;
    let activeController = null;

    async function loadHealth() {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      try {
        const payload = await requestApi("/health", {
          token: session.token,
          signal: controller.signal,
        });
        if (cancelled || controller.signal.aborted) {
          return;
        }
        setHealth({
          state: "online",
          message: payload?.message || "服务可用",
          data: payload?.data || null,
        });
      } catch (error) {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        setHealth({
          state: "offline",
          message: error.message || "服务不可用",
          data: null,
        });
      }
    }

    loadHealth();
    const timer = window.setInterval(loadHealth, 15000);
    return () => {
      cancelled = true;
      activeController?.abort();
      window.clearInterval(timer);
    };
  }, [session.token]);

  useEffect(() => {
    if (session.isAuthenticated) {
      setHasPromptedAuth(false);
      return;
    }
    if (!session.isReady || hasPromptedAuth) {
      return;
    }
    setAuthMode("login");
    setAuthOpen(true);
    setHasPromptedAuth(true);
  }, [hasPromptedAuth, session.isAuthenticated, session.isReady]);

  const activeWorkspace = session.user?.role === "admin" || workspace !== "admin"
    ? workspace
    : DEFAULT_WORKSPACE;
  const isAuthenticated = session.isAuthenticated;
  const canShowAdmin = session.user?.role === "admin";
  const workspaceMeta = getWorkspaceMeta(activeWorkspace);
  const visibleWorkspaces = WORKSPACES.filter((item) => canShowAdmin || item.id !== "admin");
  const flowWorkspaces = visibleWorkspaces.filter((item) => item.group === "flow");
  const supportWorkspaces = visibleWorkspaces.filter((item) => item.group !== "flow");
  const workspaceSummary = isAuthenticated
    ? workspaceMeta.summary
    : "登录后即可在当前站点内直接写入识别、标注、训练和资产管理结果。";
  const sessionSummary = session.status === "booting"
    ? "正在恢复会话"
    : isAuthenticated
      ? (session.user?.role === "admin" ? "管理员会话" : "用户会话")
      : "未登录";

  function openAuth(nextMode = "login") {
    setAuthMode(nextMode);
    setAuthOpen(true);
  }

  function handleWorkspaceChange(nextWorkspace) {
    const nextMeta = getWorkspaceMeta(nextWorkspace);
    if (!isAuthenticated) {
      setWorkspace(nextMeta.id);
      openAuth("login");
      return;
    }
    if (!canShowAdmin && nextMeta.id === "admin") {
      return;
    }
    setWorkspace(nextMeta.id);
  }

  function renderWorkspaceSurface() {
    if (activeWorkspace === "recognition") {
      return (
        <RecognitionWorkspace
          token={session.token}
          isAuthenticated={isAuthenticated}
          initialPayload={recognitionPayload}
          onPredictionReady={setRecognitionPayload}
          onOpenAnnotation={() => setWorkspace("annotation")}
        />
      );
    }

    if (activeWorkspace === "annotation") {
      return (
        <AnnotationWorkspace
          token={session.token}
          isAuthenticated={isAuthenticated}
          recognitionPayload={recognitionPayload}
        />
      );
    }

    if (activeWorkspace === "details") {
      return (
        <DetailsWorkspace
          token={session.token}
          isAuthenticated={isAuthenticated}
          user={session.user}
          health={health}
        />
      );
    }

    return (
      <AdminWorkspace
        token={session.token}
        isAuthenticated={isAuthenticated}
        user={session.user}
      />
    );
  }

  function renderGuestLanding() {
    return (
      <main className="landing">
        <section className="landing__hero">
          <div className="landing__copy">
            <p className="eyebrow">Plant Disease Platform</p>
            <h1>先登录，再进入智能工作台</h1>
            <p className="landing__lead">
              识别、共享屏幕、画中画、标注训练和模型资产都依赖会话权限。登录后会直接恢复到你当前想进入的模块，不再先看到整套大界面。
            </p>

            <div className="landing__actions">
              <button type="button" className="primary" onClick={() => openAuth("login")}>
                立即登录
              </button>
              <button type="button" className="secondary" onClick={() => openAuth("register")}>
                注册账号
              </button>
            </div>

            <div className="landing__metrics" aria-label="平台状态">
              <article className="landing__metric">
                <strong>{getHealthSummary(health)}</strong>
                <span>后端服务</span>
              </article>
              <article className="landing__metric">
                <strong>{getModelSummary(health)}</strong>
                <span>当前模型</span>
              </article>
              <article className="landing__metric">
                <strong>{getApiBaseLabel()}</strong>
                <span>接口入口</span>
              </article>
            </div>

            <ul className="landing__list">
              <li>登录后可直接进入病害识别、标注与训练、模型资产和管理模块。</li>
              <li>共享屏幕后会自动尝试开启实时识别，并在支持的浏览器中拉起画中画结果窗。</li>
              <li>识别结果可以继续流转到标注、训练和模型管理，不需要重复上传。</li>
            </ul>
          </div>

          <HeroVisual
            workspaceLabel="登录入口"
            healthLabel={getHealthSummary(health)}
            modelLabel={getModelSummary(health)}
            sessionLabel={sessionSummary}
            datasetCount="--"
            locked
          />
        </section>

        <section className="support-grid">
          <article className="support-step">
            <span className="support-step__eyebrow">01 Session</span>
            <h2>先完成登录会话</h2>
            <p>进入站点后默认先显示登录入口，避免未登录时直接看到整套工作台和过多噪音信息。</p>
          </article>
          <article className="support-step">
            <span className="support-step__eyebrow">02 Recognition</span>
            <h2>共享屏幕与画中画</h2>
            <p>登录后可直接共享屏幕，系统会尝试自动开启实时识别，并把主预测和建议同步到画中画小窗。</p>
          </article>
          <article className="support-step">
            <span className="support-step__eyebrow">03 Workflow</span>
            <h2>识别结果继续流转</h2>
            <p>识别完成后，结果可继续送去标注、训练和模型管理，形成完整工作流而不是零散功能页。</p>
          </article>
        </section>

        <section className="landing__footer-cta">
          <div>
            <h2>登录后即可进入当前目标模块</h2>
          </div>
          <div className="landing__footer-meta">
            <span>当前状态：{sessionSummary}</span>
            <span>后端：{getHealthSummary(health)}</span>
            <span>模型：{getModelSummary(health)}</span>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      {!isAuthenticated ? (
        <header className="topbar">
          <BrandMark compact />
          <div className="topbar__statusline" aria-label="系统状态">
            <span className={`status-pill status-pill--${getHealthTone(health)}`}>
              {getHealthSummary(health)}
            </span>
            <span className="status-pill">{getModelSummary(health)}</span>
            <span className="status-pill status-pill--ghost">{getApiBaseLabel()}</span>
          </div>
          <div className="topbar__actions">
            <button type="button" className="secondary" onClick={() => openAuth("login")}>
              登录
            </button>
            <button type="button" className="primary" onClick={() => openAuth("register")}>
              注册
            </button>
          </div>
        </header>
      ) : null}

      {isAuthenticated ? (
        <div className="workspace-layout">
          <aside className="workspace__rail workspace__rail--sidebar">
            <div className="workspace__brandpanel">
              <BrandMark />
              <div className="workspace__brandmeta">
                <span>Computer Vision Ops</span>
                <strong>{APP_NAME}</strong>
              </div>
            </div>

            <div className="workspace__sidebar-meta">
              <strong>{session.user?.display_name || session.user?.username || APP_NAME}</strong>
              <span>{canShowAdmin ? "Admin Workspace" : "Project Workspace"}</span>
            </div>

            <div className="workspace__sidebar-nav">
              <div className="workspace__sidebar-section">
                <p className="workspace__sidebar-label">导航</p>
                <WorkspaceNav
                  items={flowWorkspaces}
                  activeWorkspace={activeWorkspace}
                  onChangeWorkspace={handleWorkspaceChange}
                  canShowAdmin={canShowAdmin}
                  layout="sidebar"
                />
              </div>

              {supportWorkspaces.length ? (
                <div className="workspace__sidebar-section">
                  <p className="workspace__sidebar-label">资源</p>
                  <WorkspaceNav
                    items={supportWorkspaces}
                    activeWorkspace={activeWorkspace}
                    onChangeWorkspace={handleWorkspaceChange}
                    canShowAdmin={canShowAdmin}
                    layout="sidebar"
                  />
                </div>
              ) : null}
            </div>

            <div className="workspace__sidebar-card">
              <span>当前重点</span>
              <strong>{workspaceMeta.focusTitle || workspaceMeta.label}</strong>
              <p>{workspaceMeta.focusSummary || workspaceMeta.summary}</p>
            </div>

            <div className="workspace__sidebar-bottom">
              <div className="workspace__sidebar-usage">
                <span>服务</span>
                <strong>{getHealthSummary(health)}</strong>
              </div>
              <div className="workspace__sidebar-usage">
                <span>模型</span>
                <strong>{health.state === "online" ? (health.data?.current_model || "--") : "--"}</strong>
              </div>
              <div className="workspace__sidebar-usage">
                <span>会话</span>
                <strong>{sessionSummary}</strong>
              </div>
              <div className="workspace__sidebar-usage">
                <span>数据集</span>
                <strong>{session.user?.dataset_count ?? 0}</strong>
              </div>
            </div>
          </aside>

          <section className="workspace__stage">
            <header className="topbar topbar--workspace">
              <div className="topbar__statusline" aria-label="系统状态">
                <span className={`status-pill status-pill--${getHealthTone(health)}`}>
                  {getHealthSummary(health)}
                </span>
                <span className="status-pill">{getModelSummary(health)}</span>
                <span className="status-pill status-pill--ghost">{getApiBaseLabel()}</span>
              </div>
              <div className="topbar__actions">
                <div className="topbar__user">
                  <strong>{session.user?.display_name || session.user?.username || "已登录"}</strong>
                  <span>{session.user?.role === "admin" ? "管理员" : "普通用户"}</span>
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={async () => {
                    await session.logout();
                    setWorkspace(DEFAULT_WORKSPACE);
                  }}
                >
                  退出登录
                </button>
              </div>
            </header>

            <main className="workspace__main">
              <section className="workspace__pagebar">
                <div className="workspace__pagebar-copy">
                  <p className="workspace__pagebar-kicker">
                    {workspaceMeta.groupLabel || "Workspace"} / {workspaceMeta.step || "--"}
                  </p>
                  <h1>{workspaceMeta.label}</h1>
                  <p>{workspaceSummary}</p>
                </div>

                <div className="workspace__pagebar-side">
                  <div className="workspace__hero-actions">
                    {activeWorkspace === "recognition" ? (
                      <button type="button" className="primary" onClick={() => handleWorkspaceChange("annotation")}>
                        {recognitionPayload ? "继续标注与训练" : "进入标注与训练"}
                      </button>
                    ) : (
                      <button type="button" className="primary" onClick={() => handleWorkspaceChange("recognition")}>
                        回到识别页
                      </button>
                    )}
                    {activeWorkspace === "details" && canShowAdmin ? (
                      <button type="button" className="secondary" onClick={() => handleWorkspaceChange("admin")}>
                        打开平台管理
                      </button>
                    ) : activeWorkspace !== "details" ? (
                      <button type="button" className="secondary" onClick={() => handleWorkspaceChange("details")}>
                        查看模型资产
                      </button>
                    ) : null}
                  </div>

                  <article className="workspace__pagebar-note">
                    <span>{workspaceMeta.groupLabel || "工作区"}</span>
                    <strong>{workspaceMeta.focusTitle || workspaceMeta.label}</strong>
                    <p>{workspaceMeta.focusSummary || workspaceMeta.summary}</p>
                  </article>
                </div>
              </section>

              <section className="workspace__facts" aria-label="工作区摘要">
                <div className="workspace__fact">
                  <span>当前模块</span>
                  <strong>{workspaceMeta.label}</strong>
                </div>
                <div className="workspace__fact">
                  <span>当前角色</span>
                  <strong>{sessionSummary}</strong>
                </div>
                <div className="workspace__fact">
                  <span>在线模型</span>
                  <strong>{health.state === "online" ? (health.data?.current_model || "--") : "--"}</strong>
                </div>
                <div className="workspace__fact">
                  <span>接口入口</span>
                  <strong>{getApiBaseLabel()}</strong>
                </div>
              </section>

              {renderWorkspaceSurface()}
            </main>
          </section>
        </div>
      ) : renderGuestLanding()}

      <AuthDialog
        open={authOpen}
        mode={authMode}
        loading={session.status === "authenticating"}
        error={session.error}
        onClose={() => setAuthOpen(false)}
        onModeChange={setAuthMode}
        onLogin={async ({ username, password }) => {
          await session.login({ username, password });
          setAuthOpen(false);
        }}
        onRegister={async ({ username, password, displayName }) => {
          await session.register({
            username,
            password,
            display_name: displayName,
          });
          setAuthOpen(false);
        }}
      />
    </div>
  );
}

export default App;
