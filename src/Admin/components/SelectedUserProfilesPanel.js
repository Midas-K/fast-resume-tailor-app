import IconButton from "../../UI/IconButton";
import {
  ProfileEducationDetails,
  ProfileExperienceDetails,
} from "./ProfileDetailViews";

function SelectedUserProfilesPanel({
  selectedUser,
  profiles,
  fileInputRefs,
  getProfileRows,
  onClose,
  onViewApplications,
  onDeleteAllApplications,
  onViewPrompt,
  onTriggerPromptUpload,
  onPromptFileUpload,
  onRemovePrompt,
}) {
  if (!selectedUser) return null;

  return (
    <div className="selected-user-profile-panel">
      <div className="selected-user-profile-header">
        <div>
          <h3>{selectedUser.name}'s Profiles</h3>
          <p>{selectedUser.email}</p>
        </div>

        <IconButton icon="close" label="Close" variant="ghost" onClick={onClose} />
      </div>

      {profiles.length === 0 ? (
        <div className="empty-user-profiles">This user has no profiles yet.</div>
      ) : (
        <div className="selected-profile-grid-admin">
          {profiles.map((profile) => (
            <div className="selected-profile-admin-card" key={profile.id}>
              <div className="selected-profile-admin-top">
                <h4>{profile.profile_name}</h4>

                <span
                  className={
                    profile.admin_prompt && profile.admin_prompt.trim()
                      ? "status-badge approved"
                      : "status-badge pending"
                  }
                >
                  {profile.admin_prompt && profile.admin_prompt.trim()
                    ? "Prompt Uploaded"
                    : "Sample Prompt"}
                </span>
              </div>

              <div className="profile-admin-info">
                <p>
                  <strong>Email:</strong> {profile.profile_email || "-"}
                </p>
                <p>
                  <strong>Phone:</strong> {profile.phone || "-"}
                </p>
                <p>
                  <strong>Location:</strong> {profile.location || "-"}
                </p>
                <p>
                  <strong>Template:</strong>{" "}
                  {profile.resume_template_name || "Default template"}
                </p>
                <p>
                  <strong>Created:</strong>{" "}
                  {new Date(profile.created_at).toLocaleString()}
                </p>
              </div>

              <div className="profile-full-details">
                <div>
                  <h5>Education</h5>
                  <ProfileEducationDetails profile={profile} />
                </div>

                <div>
                  <h5>Experience</h5>
                  <ProfileExperienceDetails profile={profile} />
                </div>
              </div>

              <div className="profile-admin-actions">
                <IconButton
                  icon="eye"
                  label={`View applications (${getProfileRows(profile).length})`}
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewApplications(profile)}
                />

                <IconButton
                  icon="trash"
                  label="Delete all applications"
                  variant="danger"
                  size="sm"
                  onClick={() => onDeleteAllApplications(profile)}
                />

                <IconButton
                  icon="eye"
                  label="View prompt"
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewPrompt(profile)}
                />

                <IconButton
                  icon="upload"
                  label="Update prompt"
                  variant="primary"
                  size="sm"
                  onClick={() => onTriggerPromptUpload(profile.id)}
                />

                <IconButton
                  icon="trash"
                  label="Remove prompt"
                  variant="danger"
                  size="sm"
                  onClick={() => onRemovePrompt(profile.id)}
                />

                <input
                  type="file"
                  accept=".txt,text/plain"
                  style={{ display: "none" }}
                  ref={(element) => {
                    fileInputRefs.current[profile.id] = element;
                  }}
                  onChange={(e) =>
                    onPromptFileUpload(profile.id, e.target.files?.[0])
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SelectedUserProfilesPanel;
