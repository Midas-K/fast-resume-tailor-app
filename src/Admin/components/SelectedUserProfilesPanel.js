import IconButton from "../../UI/IconButton";
import LabeledIconButton from "../../UI/LabeledIconButton";
import {
  ApplicationCountBadges,
  ApplicationDeleteGroup,
  PromptActionGroup,
} from "./AdminActionButtons";
import { ProfileCareerSnapshot, ProfileContactStrip } from "./ProfileDetailViews";

function SelectedUserProfilesPanel({
  selectedUser,
  profiles,
  fileInputRefs,
  getWholeCount,
  getRecentCount,
  getLatestApplicationDate,
  onClose,
  onViewApplications,
  onDeleteApplications,
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
        <div className="admin-profile-board-grid compact">
          {profiles.map((profile) => (
            <article className="admin-profile-board-card" key={profile.id}>
              <header className="admin-profile-board-card__head">
                <div>
                  <h3>{profile.profile_name}</h3>
                </div>
                <ApplicationCountBadges
                  wholeCount={getWholeCount(profile)}
                  recentCount={getRecentCount(profile)}
                />
              </header>

              <ProfileContactStrip profile={profile} />
              <ProfileCareerSnapshot profile={profile} />

              <div className="admin-profile-board-card__section">
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

              <footer className="admin-profile-board-card__footer">
                <LabeledIconButton
                  icon="clipboardList"
                  label={`View applications (${getWholeCount(profile)})`}
                  variant="primary"
                  size="sm"
                  onClick={() => onViewApplications(profile)}
                />
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
    </div>
  );
}

export default SelectedUserProfilesPanel;
