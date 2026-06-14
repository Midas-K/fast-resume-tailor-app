import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteProfileApplications as deleteProfileApplicationsApi,
  deleteResumeTemplate,
  deleteUserAccount,
  fetchAdminProfileApplications,
  fetchAdminProfileCounts,
  fetchAdminUsers,
  fetchAllProfiles,
  fetchResumeTemplates,
  fetchTemplatePreviewBlob,
  saveProfilePrompt,
  setDefaultResumeTemplate,
  updateProfileResumeTemplate,
  updateUserApproval,
  updateUserJobBidStyle,
  uploadResumeTemplate,
} from "../api/adminApi";
import {
  canDeleteAccount,
  canManageThisAdmin,
  filterProfilesForUser,
  filterUsersControlledByAdmin,
  isProtectedAdmin,
  sortByCreatedAtAsc,
} from "../utils/adminPermissions";
import { sortResumeTemplatesForAdmin } from "../utils/templateHelpers";
import {
  downloadProfilePrompt,
  getApplicationDateGroups,
  mapAdminApplicationRows,
} from "../utils/applicationHelpers";
import {
  formatDateOnly,
  getIsoDateFromFormattedDate,
  getMonthFromDate,
  getYearFromDate,
} from "../../shared/utils/format";

export function useAdminDashboard() {
  const [users, setUsers] = useState([]);
  const [profileApplicationCounts, setProfileApplicationCounts] = useState({});
  const [allProfiles, setAllProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [profilesLoaded, setProfilesLoaded] = useState(false);

  const [resumeTemplates, setResumeTemplates] = useState([]);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateIsDefault, setTemplateIsDefault] = useState(false);
  const [templateUploading, setTemplateUploading] = useState(false);
  const [templateFile, setTemplateFile] = useState(null);
  const [templatePreviewUrls, setTemplatePreviewUrls] = useState({});

  const [activeSection, setActiveSection] = useState("users");
  const [selectedAdminForUsers, setSelectedAdminForUsers] = useState(null);
  const [selectedUserForProfiles, setSelectedUserForProfiles] = useState(null);
  const [selectedProfileApplications, setSelectedProfileApplications] =
    useState(null);
  const [selectedApplicationDate, setSelectedApplicationDate] = useState(null);
  const [applicationDashboardMode, setApplicationDashboardMode] =
    useState("users");

  const fileInputRefs = useRef({});
  const templatePreviewUrlsRef = useRef({});

  const resetApplicationDashboard = () => {
    setApplicationDashboardMode("users");
    setSelectedAdminForUsers(null);
    setSelectedUserForProfiles(null);
    setSelectedProfileApplications(null);
    setSelectedApplicationDate(null);
  };

  const buildProfileCountMap = (counts) => {
    const countMap = {};

    counts.forEach((item) => {
      countMap[String(item.profile_id)] = {
        whole_application_count: item.whole_application_count || 0,
        most_recent_application_count: item.most_recent_application_count || 0,
        latest_application_at: item.latest_application_at || null,
      };
    });

    return countMap;
  };

  const loadUsersData = async () => {
    const [nextUsers, counts] = await Promise.all([
      fetchAdminUsers(),
      fetchAdminProfileCounts(),
    ]);

    setUsers(nextUsers);
    setProfileApplicationCounts(buildProfileCountMap(counts));
  };

  const loadAllProfilesData = async () => {
    try {
      setLoading(true);
      const nextProfiles = await fetchAllProfiles();
      setAllProfiles(nextProfiles);
      setProfilesLoaded(true);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAdminData = async ({ includeProfiles = false } = {}) => {
    try {
      setLoading(true);

      const tasks = [loadUsersData()];

      if (includeProfiles || profilesLoaded) {
        tasks.push(loadAllProfilesData());
      }

      await Promise.all(tasks);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadResumeTemplates = async () => {
    try {
      const templates = await fetchResumeTemplates();
      setResumeTemplates(templates);
    } catch (error) {
      alert(error.message);
    }
  };

  const refreshAll = async () => {
    await Promise.all([
      loadAdminData({ includeProfiles: true }),
      loadResumeTemplates(),
    ]);
  };

  const loadTemplatePreview = async (templateId, showErrorAlert = false) => {
    try {
      const blob = await fetchTemplatePreviewBlob(templateId);
      const objectUrl = URL.createObjectURL(blob);
      const previousUrl = templatePreviewUrlsRef.current[templateId];

      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }

      templatePreviewUrlsRef.current = {
        ...templatePreviewUrlsRef.current,
        [templateId]: objectUrl,
      };

      setTemplatePreviewUrls({ ...templatePreviewUrlsRef.current });
    } catch (error) {
      console.error("Template preview failed:", error.message);

      if (showErrorAlert) {
        alert(error.message);
      }
    }
  };

  const handleUploadResumeTemplate = async () => {
    if (!templateName.trim()) {
      alert("Template name is required.");
      return;
    }

    if (!templateFile) {
      alert("Please choose a DOCX template file.");
      return;
    }

    if (!templateFile.name.toLowerCase().endsWith(".docx")) {
      alert("Only DOCX files are allowed.");
      return;
    }

    try {
      setTemplateUploading(true);

      const formData = new FormData();
      formData.append("name", templateName.trim());
      formData.append("description", templateDescription.trim());
      formData.append("isDefault", String(templateIsDefault));
      formData.append("templateFile", templateFile);

      const result = await uploadResumeTemplate(formData);

      const successDetails = [
        result.message || "DOCX resume template uploaded.",
        ...(result.warnings || []).map((warning) => `Warning: ${warning}`),
      ]
        .filter(Boolean)
        .join("\n");

      alert(successDetails);

      setTemplateName("");
      setTemplateDescription("");
      setTemplateIsDefault(false);
      setTemplateFile(null);

      const fileInput = document.getElementById("resumeTemplateFile");
      if (fileInput) {
        fileInput.value = "";
      }

      await loadResumeTemplates();
    } catch (error) {
      alert(error.message);
    } finally {
      setTemplateUploading(false);
    }
  };

  const handleSetDefaultResumeTemplate = async (templateId) => {
    try {
      const result = await setDefaultResumeTemplate(templateId);
      alert(result.message || "Default template updated.");
      await refreshAll();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleRemoveResumeTemplate = async (templateId) => {
    const confirmed = window.confirm("Remove this resume template?");
    if (!confirmed) return;

    try {
      const result = await deleteResumeTemplate(templateId);
      alert(result.message || "Resume template removed.");

      const previousUrl = templatePreviewUrlsRef.current[templateId];
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }

      const updatedPreviewUrls = { ...templatePreviewUrlsRef.current };
      delete updatedPreviewUrls[templateId];

      templatePreviewUrlsRef.current = updatedPreviewUrls;
      setTemplatePreviewUrls(updatedPreviewUrls);

      await refreshAll();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleUpdateProfileResumeTemplate = async (
    profileId,
    resumeTemplateId
  ) => {
    try {
      const result = await updateProfileResumeTemplate(
        profileId,
        resumeTemplateId
      );
      alert(result.message || "Resume template updated.");
      await loadAdminData();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleUpdateApproval = async (userId, isApproved) => {
    try {
      const result = await updateUserApproval(userId, isApproved);
      alert(result.message);
      await loadAdminData();
    } catch (error) {
      alert(error.message);
      await loadAdminData();
    }
  };

  const handleDeleteAccountForever = async (accountItem) => {
    if (!accountItem?.id) return;

    const confirmed = window.confirm(
      `This will permanently delete ${
        accountItem.name || "this account"
      }, including its profiles and applications. This cannot be undone. Continue?`
    );

    if (!confirmed) return;

    const finalConfirmed = window.confirm(
      "Final confirmation: delete this account forever?"
    );

    if (!finalConfirmed) return;

    try {
      const result = await deleteUserAccount(accountItem.id);
      alert(result.message || "Account permanently deleted.");

      if (selectedUserForProfiles?.id === accountItem.id) {
        setSelectedUserForProfiles(null);
        setSelectedProfileApplications(null);
        setSelectedApplicationDate(null);
      }

      if (selectedAdminForUsers?.id === accountItem.id) {
        setSelectedAdminForUsers(null);
      }

      await loadAdminData();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleUpdateJobBidStyle = async (userId, style) => {
    try {
      await updateUserJobBidStyle(userId, style);
      alert("Job-bid style updated.");
      await loadAdminData();
    } catch (error) {
      alert(error.message);
    }
  };

  const triggerPromptUpload = (profileId) => {
    const input = fileInputRefs.current[profileId];

    if (input) {
      input.value = "";
      input.click();
    }
  };

  const handlePromptFileUpload = async (profileId, file) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".txt")) {
      alert("Please upload a .txt file.");
      return;
    }

    try {
      const text = await file.text();

      if (!text.trim()) {
        alert("Prompt file is empty.");
        return;
      }

      await saveProfilePrompt(profileId, text);
      alert("Prompt uploaded and updated.");
      await loadAdminData();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleRemoveProfilePrompt = async (profileId) => {
    const confirmed = window.confirm(
      "Remove this uploaded prompt? This profile will use the sample prompt again."
    );

    if (!confirmed) return;

    try {
      await saveProfilePrompt(profileId, "");
      alert("Prompt removed. This profile will use the sample prompt.");
      await loadAdminData();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDeleteProfileApplications = async ({
    profile,
    deleteType,
    date = "",
    month = "",
    year = "",
  }) => {
    if (!profile?.id) return;

    const profileName = profile.profile_name || profile.name || "this profile";

    const labelMap = {
      all: "ALL application records",
      day: `application records for ${date}`,
      month: `application records for ${month}`,
      year: `application records for ${year}`,
    };

    const confirmed = window.confirm(
      `Are you sure you want to delete ${labelMap[deleteType]} for ${profileName}?\n\nThis cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const result = await deleteProfileApplicationsApi(profile.id, {
        deleteType,
        date,
        month,
        year,
      });

      alert(result.message || "Application records deleted.");

      const nextProfiles = await fetchAllProfiles();
      setAllProfiles(nextProfiles);

      if (selectedProfileApplications?.profile?.id === profile.id) {
        const updatedProfile =
          nextProfiles.find((item) => String(item.id) === String(profile.id)) ||
          profile;

        const applicationRows = await fetchAdminProfileApplications(profile.id);
        const rows = mapAdminApplicationRows(applicationRows, updatedProfile);
        const dateGroups = getApplicationDateGroups(rows);

        setSelectedProfileApplications({
          profile: updatedProfile,
          rows,
          dateGroups,
        });

        if (deleteType === "all") {
          setSelectedApplicationDate(null);
          setApplicationDashboardMode("dates");
        }
      }

      await loadUsersData();
    } catch (error) {
      alert(error.message);
    }
  };

  const openProfileApplications = async (profile) => {
    try {
      setLoading(true);

      const applicationRows = await fetchAdminProfileApplications(profile.id);
      const rows = mapAdminApplicationRows(applicationRows, profile);
      const dateGroups = getApplicationDateGroups(rows);

      setSelectedProfileApplications({ profile, rows, dateGroups });
      setSelectedApplicationDate(null);
      setApplicationDashboardMode("dates");
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const openApplicationDateList = (date) => {
    setSelectedApplicationDate(date);
    setApplicationDashboardMode("list");
  };

  const backToProfileApplications = () => {
    setSelectedApplicationDate(null);
    setApplicationDashboardMode("dates");
  };

  const backToUsersProfiles = () => {
    setSelectedProfileApplications(null);
    setSelectedApplicationDate(null);
    setApplicationDashboardMode("users");
  };

  const selectUserForProfiles = (userItem) => {
    setSelectedUserForProfiles(userItem);
    setSelectedProfileApplications(null);
    setSelectedApplicationDate(null);
  };

  const clearSelectedUserProfiles = () => {
    setSelectedUserForProfiles(null);
    setSelectedProfileApplications(null);
    setSelectedApplicationDate(null);
  };

  const clearSelectedAdminUsers = () => {
    setSelectedAdminForUsers(null);
    setSelectedUserForProfiles(null);
    setSelectedProfileApplications(null);
    setSelectedApplicationDate(null);
  };

  useEffect(() => {
    loadAdminData();

    return () => {
      Object.values(templatePreviewUrlsRef.current).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  const sortedUsers = useMemo(() => sortByCreatedAtAsc(users), [users]);
  const sortedAllProfiles = useMemo(
    () => sortByCreatedAtAsc(allProfiles),
    [allProfiles]
  );
  const sortedResumeTemplates = useMemo(
    () => sortResumeTemplatesForAdmin(resumeTemplates),
    [resumeTemplates]
  );

  const adminUsers = sortedUsers.filter((item) => item.account_type === "admin");
  const normalAdminUsers = sortedUsers.filter((item) => item.account_type === "user");
  const usersControlledBySelectedAdmin = filterUsersControlledByAdmin(
    sortedUsers,
    selectedAdminForUsers
  );
  const selectedUserProfiles = filterProfilesForUser(
    sortedAllProfiles,
    selectedUserForProfiles
  );

  const selectedDateApplications =
    selectedProfileApplications && selectedApplicationDate
      ? selectedProfileApplications.dateGroups.find(
          (group) => group.date === selectedApplicationDate
        )?.rows || []
      : [];

  const getProfileCountEntry = (profile) =>
    profileApplicationCounts[String(profile.id)] || {
      whole_application_count: 0,
      most_recent_application_count: 0,
      latest_application_at: null,
    };

  const getWholeCount = (profile) =>
    getProfileCountEntry(profile).whole_application_count;

  const getRecentCount = (profile) =>
    getProfileCountEntry(profile).most_recent_application_count;

  const getLatestApplicationDate = (profile) => {
    const latestAt = getProfileCountEntry(profile).latest_application_at;

    if (!latestAt) {
      return "";
    }

    return new Date(latestAt).toISOString().slice(0, 10);
  };

  const getProfileRows = (profile) => {
    if (selectedProfileApplications?.profile?.id === profile.id) {
      return selectedProfileApplications.rows || [];
    }

    return [];
  };

  return {
    activeSection,
    setActiveSection,
    applicationDashboardMode,
    loading,
    users: sortedUsers,
    profileApplicationCounts,
    allProfiles: sortedAllProfiles,
    resumeTemplates: sortedResumeTemplates,
    templateName,
    setTemplateName,
    templateDescription,
    setTemplateDescription,
    templateIsDefault,
    setTemplateIsDefault,
    templateUploading,
    templateFile,
    setTemplateFile,
    templatePreviewUrls,
    selectedAdminForUsers,
    setSelectedAdminForUsers,
    selectedUserForProfiles,
    selectedProfileApplications,
    selectedApplicationDate,
    fileInputRefs,
    adminUsers,
    normalAdminUsers,
    usersControlledBySelectedAdmin,
    selectedUserProfiles,
    selectedDateApplications,
    resetApplicationDashboard,
    loadAdminData,
    loadResumeTemplates,
    refreshAll,
    loadTemplatePreview,
    handleUploadResumeTemplate,
    handleSetDefaultResumeTemplate,
    handleRemoveResumeTemplate,
    handleUpdateProfileResumeTemplate,
    handleUpdateApproval,
    handleDeleteAccountForever,
    handleUpdateJobBidStyle,
    triggerPromptUpload,
    handlePromptFileUpload,
    handleRemoveProfilePrompt,
    handleDeleteProfileApplications,
    openProfileApplications,
    openApplicationDateList,
    backToProfileApplications,
    backToUsersProfiles,
    selectUserForProfiles,
    clearSelectedUserProfiles,
    clearSelectedAdminUsers,
    viewProfilePrompt: downloadProfilePrompt,
    getProfileRows,
    getWholeCount,
    getRecentCount,
    getLatestApplicationDate,
    loadAllProfilesData,
    getIsoDateFromFormattedDate,
    getMonthFromDate,
    getYearFromDate,
    formatDateOnly,
    permissions: {
      canDeleteAccount,
      canManageThisAdmin,
      isProtectedAdmin,
    },
  };
}
