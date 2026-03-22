import { WORKSPACES } from "@/appConfig";

export function WorkspaceNav({
  activeWorkspace,
  onChangeWorkspace,
  canShowAdmin = false,
  layout = "inline",
  items = null,
}) {
  const visibleWorkspaces = (items || WORKSPACES).filter((workspace) => canShowAdmin || workspace.id !== "admin");

  return (
    <nav className={`workspace-nav workspace-nav--${layout}`} aria-label="工作区导航">
      {visibleWorkspaces.map((workspace, index) => {
        const active = workspace.id === activeWorkspace;
        return (
          <button
            key={workspace.id}
            type="button"
            className={`workspace-nav__item${active ? " is-active" : ""}`}
            onClick={() => onChangeWorkspace(workspace.id)}
          >
            <span className="workspace-nav__index">{workspace.step || String(index + 1).padStart(2, "0")}</span>
            <span className="workspace-nav__content">
              {workspace.groupLabel ? <em>{workspace.groupLabel}</em> : null}
              <strong>{workspace.label}</strong>
              <small>{workspace.hint}</small>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
