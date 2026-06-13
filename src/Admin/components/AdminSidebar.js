import Icon from "../../UI/Icon";

function AdminSidebar({
  activeSection,
  canManageAdmins,
  onSectionChange,
  onRefresh,
  onLogout,
}) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-logo">
        <div className="admin-logo-mark">
          <Icon name="dashboard" size={22} strokeWidth={2.5} />
        </div>
        <span>FRT Admin</span>
      </div>

      <div className="admin-sidebar-group">
        <button
          type="button"
          className={
            activeSection === "users" ? "sidebar-link active" : "sidebar-link"
          }
          onClick={() => onSectionChange("users")}
        >
          <Icon name="users" size={17} />
          {canManageAdmins ? "Admins" : "Users"}
        </button>

        <button
          type="button"
          className={
            activeSection === "profiles" ? "sidebar-link active" : "sidebar-link"
          }
          onClick={() => onSectionChange("profiles")}
        >
          <Icon name="user" size={17} />
          User Profiles
        </button>

        <button
          type="button"
          className={
            activeSection === "templates" ? "sidebar-link active" : "sidebar-link"
          }
          onClick={() => onSectionChange("templates")}
        >
          <Icon name="fileText" size={17} />
          Resume Templates
        </button>
      </div>

      <div className="admin-sidebar-bottom">
        <button type="button" className="sidebar-link" onClick={onRefresh}>
          <Icon name="refresh" size={17} />
          Refresh
        </button>

        <button type="button" className="sidebar-link danger" onClick={onLogout}>
          <Icon name="logout" size={17} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

export default AdminSidebar;
