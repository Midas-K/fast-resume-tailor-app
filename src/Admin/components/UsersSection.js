import IconButton from "../../UI/IconButton";
import AdminsTable from "./AdminsTable";
import SelectedUserProfilesPanel from "./SelectedUserProfilesPanel";
import UserTable from "./UserTable";

function UsersSection({
  canManageAdmins,
  canInspectAdminUsers,
  canManageThisAdmin,
  isProtectedAdmin,
  canDeleteAccount,
  adminUsers,
  normalAdminUsers,
  usersControlledBySelectedAdmin,
  selectedAdminForUsers,
  selectedUserForProfiles,
  selectedUserProfiles,
  fileInputRefs,
  onSelectAdmin,
  onClearSelectedAdmin,
  onSelectUser,
  onClearSelectedUser,
  onUpdateApproval,
  onUpdateJobBidStyle,
  onDeleteAccount,
  getWholeCount,
  getRecentCount,
  getLatestApplicationDate,
  onViewApplications,
  onDeleteApplications,
  onViewPrompt,
  onTriggerPromptUpload,
  onPromptFileUpload,
  onRemovePrompt,
}) {
  if (!canManageAdmins) {
    return (
      <section className="admin-content-card">
        <div className="admin-section-header">
          <div>
            <h2>Users</h2>
            <p>Click a user row to view and manage that user's profiles.</p>
          </div>
        </div>

        <UserTable
          users={normalAdminUsers}
          selectedUserId={selectedUserForProfiles?.id}
          onSelectUser={onSelectUser}
          onUpdateApproval={onUpdateApproval}
          onUpdateJobBidStyle={onUpdateJobBidStyle}
          onDeleteAccount={onDeleteAccount}
          canDeleteAccount={canDeleteAccount}
        />

        <SelectedUserProfilesPanel
          selectedUser={selectedUserForProfiles}
          profiles={selectedUserProfiles}
          fileInputRefs={fileInputRefs}
          getWholeCount={getWholeCount}
          getRecentCount={getRecentCount}
          getLatestApplicationDate={getLatestApplicationDate}
          onClose={onClearSelectedUser}
          onViewApplications={onViewApplications}
          onDeleteApplications={onDeleteApplications}
          onViewPrompt={onViewPrompt}
          onTriggerPromptUpload={onTriggerPromptUpload}
          onPromptFileUpload={onPromptFileUpload}
          onRemovePrompt={onRemovePrompt}
        />
      </section>
    );
  }

  return (
    <section className="admin-content-card">
      <div className="admin-section-header">
        <div>
          <h2>Admins</h2>
          <p>
            Owner can inspect admins' users. Special admin can only approve or
            block normal admin accounts.
          </p>
        </div>
      </div>

      <AdminsTable
        adminUsers={adminUsers}
        selectedAdminId={selectedAdminForUsers?.id}
        canInspectAdminUsers={canInspectAdminUsers}
        canManageThisAdmin={canManageThisAdmin}
        isProtectedAdmin={isProtectedAdmin}
        canDeleteAccount={canDeleteAccount}
        onSelectAdmin={onSelectAdmin}
        onUpdateApproval={onUpdateApproval}
        onDeleteAccount={onDeleteAccount}
      />

      {canInspectAdminUsers && selectedAdminForUsers && (
        <div className="selected-user-profile-panel">
          <div className="selected-user-profile-header">
            <div>
              <h3>{selectedAdminForUsers.name}'s Controlled Users</h3>
              <p>{selectedAdminForUsers.email}</p>
            </div>

            <IconButton
              icon="close"
              label="Close"
              variant="ghost"
              onClick={onClearSelectedAdmin}
            />
          </div>

          <UserTable
            users={usersControlledBySelectedAdmin}
            selectedUserId={selectedUserForProfiles?.id}
            onSelectUser={onSelectUser}
            onUpdateApproval={onUpdateApproval}
            onUpdateJobBidStyle={onUpdateJobBidStyle}
            onDeleteAccount={onDeleteAccount}
            canDeleteAccount={canDeleteAccount}
            emptyMessage="This admin does not control any users yet."
          />

          <SelectedUserProfilesPanel
            selectedUser={selectedUserForProfiles}
            profiles={selectedUserProfiles}
            fileInputRefs={fileInputRefs}
            getWholeCount={getWholeCount}
            getRecentCount={getRecentCount}
            getLatestApplicationDate={getLatestApplicationDate}
            onClose={onClearSelectedUser}
            onViewApplications={onViewApplications}
            onDeleteApplications={onDeleteApplications}
            onViewPrompt={onViewPrompt}
            onTriggerPromptUpload={onTriggerPromptUpload}
            onPromptFileUpload={onPromptFileUpload}
            onRemovePrompt={onRemovePrompt}
          />
        </div>
      )}

      {normalAdminUsers.length > 0 && (
        <>
          <div className="admin-section-header" style={{ marginTop: "24px" }}>
            <div>
              <h2>Users</h2>
              <p>Manage approved and pending users.</p>
            </div>
          </div>

          <UserTable
            users={normalAdminUsers}
            selectedUserId={selectedUserForProfiles?.id}
            onSelectUser={onSelectUser}
            onUpdateApproval={onUpdateApproval}
            onUpdateJobBidStyle={onUpdateJobBidStyle}
            onDeleteAccount={onDeleteAccount}
            canDeleteAccount={canDeleteAccount}
          />

          <SelectedUserProfilesPanel
            selectedUser={selectedUserForProfiles}
            profiles={selectedUserProfiles}
            fileInputRefs={fileInputRefs}
            getWholeCount={getWholeCount}
            getRecentCount={getRecentCount}
            getLatestApplicationDate={getLatestApplicationDate}
            onClose={onClearSelectedUser}
            onViewApplications={onViewApplications}
            onDeleteApplications={onDeleteApplications}
            onViewPrompt={onViewPrompt}
            onTriggerPromptUpload={onTriggerPromptUpload}
            onPromptFileUpload={onPromptFileUpload}
            onRemovePrompt={onRemovePrompt}
          />
        </>
      )}
    </section>
  );
}

export default UsersSection;
