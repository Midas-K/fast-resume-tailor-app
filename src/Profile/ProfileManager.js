import ProfileShell from "../UI/ProfileShell";
import ApplicationDatesView from "./components/ApplicationDatesView";
import ApplicationListView from "./components/ApplicationListView";
import ProfileForm from "./components/ProfileForm";
import ProfileList from "./components/ProfileList";
import { useProfileManager } from "./hooks/useProfileManager";

function ProfileManager({ user, onLogout, onProfileSelected }) {
  const profile = useProfileManager(user);

  if (
    profile.applicationViewMode === "dates" &&
    profile.selectedApplicationProfile
  ) {
    return (
      <ProfileShell
        title={`Applications for ${profile.selectedApplicationProfile.name}`}
        subtitle={
          profile.selectedCountMode === "recent"
            ? "Most recent application list."
            : "Total applications grouped by date."
        }
        user={user}
        onLogout={onLogout}
        onBack={profile.backToProfilesDashboard}
      >
        <ApplicationDatesView
          applicationDateGroups={profile.applicationDateGroups}
          onBack={profile.backToProfilesDashboard}
          onOpenDate={profile.openDateApplicationList}
        />
      </ProfileShell>
    );
  }

  if (
    profile.applicationViewMode === "list" &&
    profile.selectedApplicationProfile &&
    profile.selectedApplicationDate
  ) {
    return (
      <ProfileShell
        title={`Applications for ${profile.selectedApplicationProfile.name}`}
        subtitle={`${profile.selectedApplicationDate} application list.`}
        user={user}
        onLogout={onLogout}
        onBack={profile.backToApplicationDates}
      >
        <ApplicationListView
          selectedApplicationDate={profile.selectedApplicationDate}
          selectedDateRows={profile.selectedDateRows}
          selectedCountMode={profile.selectedCountMode}
          onBack={profile.backToApplicationDates}
        />
      </ProfileShell>
    );
  }

  return (
    <ProfileShell
      title={profile.editingProfileId ? "Edit Profile" : "Create Profile"}
      subtitle="All profile fields are required before you can save and use a job-bid profile."
      user={user}
      onLogout={onLogout}
    >
      <main className="profile-dashboard">
        <ProfileForm
          editingProfileId={profile.editingProfileId}
          form={profile.form}
          onAddEducation={profile.addEducation}
          onRemoveEducation={profile.removeEducation}
          onUpdateEducation={profile.updateEducation}
          onAddExperience={profile.addExperience}
          onRemoveExperience={profile.removeExperience}
          onUpdateExperience={profile.updateExperience}
          onSave={profile.handleSaveProfile}
          onCancelEdit={profile.resetForm}
        />

        <ProfileList
          profiles={profile.profiles}
          getProfileCount={profile.getProfileCount}
          onSelectProfile={async (item) => {
            try {
              const fullProfile = await profile.selectProfileForUse(item);
              onProfileSelected(fullProfile);
            } catch (error) {
              alert(error.message);
            }
          }}
          onEditProfile={profile.startEditProfile}
          onRemoveProfile={profile.handleRemoveProfile}
          onOpenApplications={profile.openProfileApplicationDashboard}
        />
      </main>
    </ProfileShell>
  );
}

export default ProfileManager;
