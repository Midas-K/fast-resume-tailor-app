import IconButton from "../../UI/IconButton";

function ProfileList({
  profiles,
  getProfileCount,
  onSelectProfile,
  onEditProfile,
  onRemoveProfile,
  onOpenApplications,
}) {
  return (
    <section className="card profile-card">
      <div className="profile-card-header">
        <div>
          <h2>Job-Bid Profiles</h2>
          <p>Select one profile to enter Resume Builder.</p>
        </div>
      </div>

      {profiles.length === 0 && (
        <div className="empty-profile-box">No profile yet. Create one first.</div>
      )}

      {profiles.map((profile) => {
        const counts = getProfileCount(profile.id);

        return (
          <div className="profile-list-item" key={profile.id}>
            <div className="profile-list-content">
              <h3>{profile.name}</h3>
              <p>{profile.location || "No location added"}</p>
              <p>{profile.email}</p>

              <div className="profile-application-counts">
                <button
                  type="button"
                  className="profile-count-card"
                  onClick={() => onOpenApplications(profile, "total")}
                >
                  <strong>{counts.whole_application_count}</strong>
                  <span>Total Applications</span>
                </button>

                <button
                  type="button"
                  className="profile-count-card"
                  onClick={() => onOpenApplications(profile, "recent")}
                >
                  <strong>{counts.most_recent_application_count}</strong>
                  <span>Most Recent Date</span>
                </button>
              </div>
            </div>

            <div className="profile-actions">
              <IconButton
                icon="check"
                label="Use profile"
                variant="success"
                onClick={() => onSelectProfile(profile)}
              />

              <IconButton
                icon="pencil"
                label="Edit profile"
                variant="ghost"
                onClick={() => onEditProfile(profile)}
              />

              <IconButton
                icon="trash"
                label="Remove profile"
                variant="danger"
                onClick={() => onRemoveProfile(profile.id)}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
}

export default ProfileList;
