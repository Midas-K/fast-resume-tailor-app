import Icon from "./Icon";
import IconButton from "./IconButton";

function ProfileShell({ title, subtitle, user, onLogout, children, onBack }) {
  return (
    <div className="profile-shell">
      <aside className="app-sidebar">
        <div className="brand-block">
          <div className="brand-mark">
            <Icon name="users" size={22} strokeWidth={2.5} />
          </div>
          <div>
            <strong>Profiles</strong>
            <span>Job-bid workspace</span>
          </div>
        </div>

        <nav className="app-nav" aria-label="Profile navigation">
          {onBack && (
            <button type="button" className="app-nav-item" onClick={onBack}>
              <Icon name="arrowLeft" size={17} />
              Back
            </button>
          )}
        </nav>

        <div className="sidebar-profile-card">
          <span>Signed in as</span>
          <strong>{user?.name || "User"}</strong>
          <p>{user?.email || ""}</p>
          <button type="button" className="sidebar-logout" onClick={onLogout}>
            <Icon name="logout" size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="profile-main">
        <div className="profile-main-inner">
          <header className="workspace-header">
            <div>
              <span className="eyebrow">Profile Manager</span>
              <h1>{title}</h1>
              {subtitle && <p>{subtitle}</p>}
            </div>

            <div className="workspace-actions">
              <span className="account-pill account-pill--icon">
                <Icon name="user" size={15} />
                {user?.name}
              </span>
              <IconButton
                icon="logout"
                label="Sign out"
                variant="danger"
                onClick={onLogout}
              />
            </div>
          </header>

          {children}
        </div>
      </main>
    </div>
  );
}

export default ProfileShell;
