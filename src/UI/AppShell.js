import { useState } from "react";
import Icon from "./Icon";
import IconButton from "./IconButton";

function AppShell({
  kicker = "FRT",
  title,
  subtitle,
  user,
  selectedProfile,
  onLogout,
  onShowProfiles,
  compact = false,
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const displayName = selectedProfile?.name || user?.name || "User";

  const closeSidebar = () => setSidebarOpen(false);

  const handleShowProfiles = () => {
    closeSidebar();
    onShowProfiles?.();
  };

  const handleLogout = () => {
    closeSidebar();
    onLogout?.();
  };

  return (
    <div className={`app-shell${compact ? " app-shell--fit" : ""}`}>
      <button
        type="button"
        className="app-mobile-menu-btn"
        aria-label="Open navigation menu"
        aria-expanded={sidebarOpen}
        onClick={() => setSidebarOpen(true)}
      >
        <Icon name="menu" size={20} />
      </button>

      {sidebarOpen ? (
        <button
          type="button"
          className="app-sidebar-overlay"
          aria-label="Close navigation menu"
          onClick={closeSidebar}
        />
      ) : null}

      <aside className={`app-sidebar${sidebarOpen ? " is-open" : ""}`}>
        <div className="app-sidebar-top">
          <div className="brand-block">
            <div className="brand-mark">
              <Icon name="zap" size={22} strokeWidth={2.5} />
            </div>
            <div>
              <strong>FRT</strong>
              <span>Fast Resume Tailor</span>
            </div>
          </div>

          <button
            type="button"
            className="app-sidebar-close"
            aria-label="Close navigation menu"
            onClick={closeSidebar}
          >
            <Icon name="clear" size={18} />
          </button>
        </div>

        <nav className="app-nav" aria-label="Main navigation">
          <button type="button" className="app-nav-item active" onClick={closeSidebar}>
            <Icon name="briefcase" size={17} />
            Fast Apply
          </button>
          <button type="button" className="app-nav-item" onClick={handleShowProfiles}>
            <Icon name="users" size={17} />
            Profiles
          </button>
        </nav>

        <div className="sidebar-profile-card">
          <span>Active Profile</span>
          <strong>{displayName}</strong>
          <p>{selectedProfile?.email || user?.email || "No profile selected"}</p>
          <button
            type="button"
            className="sidebar-profile-btn"
            onClick={handleShowProfiles}
          >
            <Icon name="folder" size={15} />
            Switch Profile
          </button>
          <button type="button" className="sidebar-logout" onClick={handleLogout}>
            <Icon name="logout" size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      <main className={`app-main${compact ? " app-main--fit" : ""}`}>
        <header
          className={`workspace-header${
            compact ? " workspace-header--fit" : ""
          }`}
        >
          <div className="workspace-header-copy">
            <span className="eyebrow">{kicker}</span>
            <h1>{title}</h1>
            {subtitle && !compact && <p>{subtitle}</p>}
          </div>

          <div className="workspace-actions">
            <IconButton
              icon="users"
              label="Profiles"
              variant="ghost"
              onClick={onShowProfiles}
            />
            <span className="account-pill account-pill--icon">
              <Icon name="user" size={15} />
              <span className="account-pill__name">{displayName}</span>
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
      </main>
    </div>
  );
}

export default AppShell;
