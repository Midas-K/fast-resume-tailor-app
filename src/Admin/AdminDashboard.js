import { getAdminPermissions } from "./utils/adminPermissions";
import { useAdminDashboard } from "./hooks/useAdminDashboard";
import AdminPageHeader from "./components/AdminPageHeader";
import AdminSidebar from "./components/AdminSidebar";
import AllProfilesSection from "./components/AllProfilesSection";
import ApplicationDatesSection from "./components/ApplicationDatesSection";
import ApplicationListSection from "./components/ApplicationListSection";
import ResumeTemplatesSection from "./components/ResumeTemplatesSection";
import UsersSection from "./components/UsersSection";

function AdminDashboard({ user, onLogout }) {
  const admin = useAdminDashboard();
  const { canManageAdmins, currentUserCanInspectAdminUsers, currentUserCanManageAdmins } =
    getAdminPermissions(user);

  const handleSectionChange = (section) => {
    admin.setActiveSection(section);
    admin.resetApplicationDashboard();

    if (section === "templates") {
      admin.loadResumeTemplates();
    }
  };

  const canManageThisAdmin = (adminItem) =>
    admin.permissions.canManageThisAdmin(
      adminItem,
      currentUserCanManageAdmins
    );

  return (
    <div className="admin-shell">
      <AdminSidebar
        activeSection={admin.activeSection}
        canManageAdmins={canManageAdmins}
        onSectionChange={handleSectionChange}
        onRefresh={admin.refreshAll}
        onLogout={onLogout}
      />

      <main className="admin-main">
        <AdminPageHeader
          userName={user.name}
          loading={admin.loading}
          onRefresh={admin.refreshAll}
        />

        {admin.activeSection === "users" &&
          admin.applicationDashboardMode === "users" && (
            <UsersSection
              canManageAdmins={canManageAdmins}
              canInspectAdminUsers={currentUserCanInspectAdminUsers}
              canManageThisAdmin={canManageThisAdmin}
              isProtectedAdmin={admin.permissions.isProtectedAdmin}
              canDeleteAccount={admin.permissions.canDeleteAccount}
              adminUsers={admin.adminUsers}
              normalAdminUsers={admin.normalAdminUsers}
              usersControlledBySelectedAdmin={admin.usersControlledBySelectedAdmin}
              selectedAdminForUsers={admin.selectedAdminForUsers}
              selectedUserForProfiles={admin.selectedUserForProfiles}
              selectedUserProfiles={admin.selectedUserProfiles}
              fileInputRefs={admin.fileInputRefs}
              onSelectAdmin={admin.setSelectedAdminForUsers}
              onClearSelectedAdmin={admin.clearSelectedAdminUsers}
              onSelectUser={admin.selectUserForProfiles}
              onClearSelectedUser={admin.clearSelectedUserProfiles}
              onUpdateApproval={admin.handleUpdateApproval}
              onUpdateJobBidStyle={admin.handleUpdateJobBidStyle}
              onDeleteAccount={admin.handleDeleteAccountForever}
              getProfileRows={admin.getProfileRows}
              onViewApplications={admin.openProfileApplications}
              onDeleteAllApplications={admin.handleDeleteProfileApplications}
              onViewPrompt={admin.viewProfilePrompt}
              onTriggerPromptUpload={admin.triggerPromptUpload}
              onPromptFileUpload={admin.handlePromptFileUpload}
              onRemovePrompt={admin.handleRemoveProfilePrompt}
            />
          )}

        {admin.activeSection === "users" &&
          admin.applicationDashboardMode === "dates" &&
          admin.selectedProfileApplications && (
            <ApplicationDatesSection
              profileApplications={admin.selectedProfileApplications}
              onBack={admin.backToUsersProfiles}
              onOpenDate={admin.openApplicationDateList}
              onDeleteDay={admin.handleDeleteProfileApplications}
              getIsoDateFromFormattedDate={admin.getIsoDateFromFormattedDate}
            />
          )}

        {admin.activeSection === "users" &&
          admin.applicationDashboardMode === "list" &&
          admin.selectedProfileApplications &&
          admin.selectedApplicationDate && (
            <ApplicationListSection
              profileApplications={admin.selectedProfileApplications}
              selectedApplicationDate={admin.selectedApplicationDate}
              selectedDateApplications={admin.selectedDateApplications}
              onDeleteApplications={admin.handleDeleteProfileApplications}
              onBackToDates={admin.backToProfileApplications}
              getIsoDateFromFormattedDate={admin.getIsoDateFromFormattedDate}
              getMonthFromDate={admin.getMonthFromDate}
              getYearFromDate={admin.getYearFromDate}
            />
          )}

        {admin.activeSection === "profiles" && (
          <AllProfilesSection
            profiles={admin.allProfiles}
            resumeTemplates={admin.resumeTemplates}
            fileInputRefs={admin.fileInputRefs}
            getWholeCount={admin.getWholeCount}
            getRecentCount={admin.getRecentCount}
            getProfileRows={admin.getProfileRows}
            onUpdateResumeTemplate={admin.handleUpdateProfileResumeTemplate}
            onViewPrompt={admin.viewProfilePrompt}
            onTriggerPromptUpload={admin.triggerPromptUpload}
            onPromptFileUpload={admin.handlePromptFileUpload}
            onRemovePrompt={admin.handleRemoveProfilePrompt}
            onDeleteApplications={admin.handleDeleteProfileApplications}
          />
        )}

        {admin.activeSection === "templates" && (
          <ResumeTemplatesSection
            resumeTemplates={admin.resumeTemplates}
            templateName={admin.templateName}
            templateDescription={admin.templateDescription}
            templateIsDefault={admin.templateIsDefault}
            templateUploading={admin.templateUploading}
            templatePreviewUrls={admin.templatePreviewUrls}
            onTemplateNameChange={admin.setTemplateName}
            onTemplateDescriptionChange={admin.setTemplateDescription}
            onTemplateIsDefaultChange={admin.setTemplateIsDefault}
            onTemplateFileChange={admin.setTemplateFile}
            onUpload={admin.handleUploadResumeTemplate}
            onRefreshTemplates={admin.loadResumeTemplates}
            onSetDefault={admin.handleSetDefaultResumeTemplate}
            onRemoveTemplate={admin.handleRemoveResumeTemplate}
            onRefreshPreview={admin.loadTemplatePreview}
          />
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;
