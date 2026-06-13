import Icon from "../../UI/Icon";
import IconButton from "../../UI/IconButton";

function AdminPageHeader({ userName, loading, onRefresh }) {
  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1>Dashboard</h1>
          <p>
            Manage users, profiles, prompts, applications, and resume templates.
          </p>
        </div>

        <div className="admin-top-actions">
          <span className="account-pill account-pill--icon admin-user-pill">
            <Icon name="user" size={15} />
            {userName}
          </span>
        </div>
      </header>

      <section className="admin-hero-card">
        <div className="admin-hero-icon">
          <Icon name="shield" size={26} />
        </div>

        <div>
          <h2>Admin Control Center</h2>
          <p>
            Review accounts, manage access, assign templates, upload prompts, and
            track application activity.
          </p>
        </div>

        <IconButton
          icon="refresh"
          label="Refresh data"
          variant="primary"
          size="lg"
          loading={loading}
          disabled={loading}
          className="admin-primary-btn"
          onClick={onRefresh}
        />
      </section>
    </>
  );
}

export default AdminPageHeader;
