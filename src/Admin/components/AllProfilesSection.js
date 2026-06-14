import Icon from "../../UI/Icon";
import {
  ApplicationCountBadges,
  ApplicationDeleteGroup,
  PromptActionGroup,
} from "./AdminActionButtons";
import {
  ProfileCareerSnapshot,
  ProfileContactStrip,
} from "./ProfileDetailViews";

function AllProfilesSection({
  profiles,
  resumeTemplates,
  fileInputRefs,
  getWholeCount,
  getRecentCount,
  getLatestApplicationDate,
  onUpdateResumeTemplate,
  onViewPrompt,
  onTriggerPromptUpload,
  onPromptFileUpload,
  onRemovePrompt,
  onDeleteApplications,
}) {
  return (
    <section className="admin-content-card admin-profiles-board">
      <div className="admin-section-header">
        <div>
          <h2>User Profiles</h2>
          <p>
            Review career snapshots, manage prompts, assign templates, and control
            application counts with clearly labeled actions.
          </p>
        </div>
        <span className="admin-section-kicker">{profiles.length} profiles</span>
      </div>

      {profiles.length === 0 ? (
        <div className="empty-user-profiles">No profiles found.</div>
      ) : (
        <div className="admin-profile-board-grid">
          {profiles.map((profile) => (
            <article className="admin-profile-board-card" key={profile.id}>
              <header className="admin-profile-board-card__head">
                <div>
                  <span className="admin-profile-board-card__user">
                    {profile.user_name || "User"}
                  </span>
                  <h3>{profile.profile_name || "Profile"}</h3>
                </div>
                <ApplicationCountBadges
                  wholeCount={getWholeCount(profile)}
                  recentCount={getRecentCount(profile)}
                />
              </header>

              <ProfileContactStrip profile={profile} />

              <ProfileCareerSnapshot profile={profile} />

              <div className="admin-profile-board-card__section">
                <div className="admin-profile-board-card__section-label">
                  <Icon name="scrollText" size={14} />
                  Prompt
                </div>
                <PromptActionGroup
                  profile={profile}
                  layout="stack"
                  inputRef={(element) => {
                    fileInputRefs.current[profile.id] = element;
                  }}
                  onViewPrompt={onViewPrompt}
                  onTriggerPromptUpload={onTriggerPromptUpload}
                  onPromptFileUpload={onPromptFileUpload}
                  onRemovePrompt={onRemovePrompt}
                />
              </div>

              <div className="admin-profile-board-card__section">
                <div className="admin-profile-board-card__section-label">
                  <Icon name="fileText" size={14} />
                  Resume Template
                </div>
                <div className="template-profile-picker">
                  <select
                    className="admin-select"
                    value={profile.resume_template_id || ""}
                    onChange={(e) =>
                      onUpdateResumeTemplate(profile.id, e.target.value || null)
                    }
                  >
                    <option value="">Use Default Template</option>
                    {resumeTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                        {template.is_default ? " (Default)" : ""}
                      </option>
                    ))}
                  </select>
                  <p>
                    Current: {profile.resume_template_name || "Default template"}
                  </p>
                </div>
              </div>

              <footer className="admin-profile-board-card__footer">
                <div className="admin-profile-board-card__section-label">
                  <Icon name="clipboardList" size={14} />
                  Application cleanup
                </div>
                <ApplicationDeleteGroup
                  profile={profile}
                  onDeleteApplications={onDeleteApplications}
                  getLatestApplicationDate={getLatestApplicationDate}
                />
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default AllProfilesSection;
