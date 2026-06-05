import React, { useEffect, useRef, useState } from "react";

const API_URL = process.env.REACT_APP_API_URL || "";

function AdminDashboard({ user, onLogout }) {
  const [users, setUsers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [loading, setLoading] = useState(false);

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

  const getToken = () => localStorage.getItem("rta_token");

  const authHeaders = () => ({
    Authorization: `Bearer ${getToken()}`,
  });

  const jsonAuthHeaders = () => ({
    "Content-Type": "application/json",
    ...authHeaders(),
  });

  const getBooleanFlag = (...values) => {
    return values.some((value) => value === true || value === "true");
  };

  const currentUserCanManageAdmins = getBooleanFlag(
    user?.can_manage_admin_accounts,
    user?.canManageAdminAccounts,
    user?.permissions?.can_manage_admin_accounts,
    user?.permissions?.canManageAdminAccounts
  );

  const currentUserCanInspectAdminUsers = getBooleanFlag(
    user?.can_inspect_admin_users,
    user?.canInspectAdminUsers,
    user?.permissions?.can_inspect_admin_users,
    user?.permissions?.canInspectAdminUsers
  );

  const canManageAdmins =
    currentUserCanManageAdmins || currentUserCanInspectAdminUsers;

  const isProtectedAdmin = (adminItem) =>
    getBooleanFlag(
      adminItem?.is_protected_admin,
      adminItem?.isProtectedAdmin,
      adminItem?.is_owner_account,
      adminItem?.isOwnerAccount,
      adminItem?.is_special_admin,
      adminItem?.isSpecialAdmin
    );

  const canManageThisAdmin = (adminItem) => {
    if (!currentUserCanManageAdmins) return false;
    if (isProtectedAdmin(adminItem)) return false;
    return true;
  };

  const canDeleteAccount = (accountItem) => {
    return getBooleanFlag(
      accountItem?.can_delete_account,
      accountItem?.canDeleteAccount
    );
  };

  const readJsonResponse = async (response, urlLabel) => {
    const contentType = response.headers.get("content-type");

    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error(`Non-JSON response from ${urlLabel}:`, text);
      throw new Error(`Backend returned HTML instead of JSON from: ${urlLabel}`);
    }

    return response.json();
  };

  const formatDateOnly = (value) => {
    if (!value) return "Unknown Date";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Unknown Date";

    return date.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

  const formatDateTime = (value) => {
    if (!value) return "Unknown Time";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Unknown Time";

    return date.toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const resetApplicationDashboard = () => {
    setApplicationDashboardMode("users");
    setSelectedAdminForUsers(null);
    setSelectedUserForProfiles(null);
    setSelectedProfileApplications(null);
    setSelectedApplicationDate(null);
  };

  const loadTemplatePreview = async (templateId) => {
    try {
      const url = `${API_URL}/api/resume-templates/${templateId}/preview-pdf`;

      const response = await fetch(url, {
        headers: authHeaders(),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.message || "Could not load template preview.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const previousUrl = templatePreviewUrlsRef.current[templateId];

      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }

      templatePreviewUrlsRef.current = {
        ...templatePreviewUrlsRef.current,
        [templateId]: objectUrl,
      };

      setTemplatePreviewUrls({
        ...templatePreviewUrlsRef.current,
      });
    } catch (error) {
      alert(error.message);
    }
  };

  const loadAdminData = async () => {
    try {
      setLoading(true);

      const usersUrl = `${API_URL}/api/auth/users`;
      const usersResponse = await fetch(usersUrl, {
        headers: authHeaders(),
      });
      const usersResult = await readJsonResponse(usersResponse, usersUrl);

      const applicationsUrl = `${API_URL}/api/applications/admin/summary`;
      const applicationsResponse = await fetch(applicationsUrl, {
        headers: authHeaders(),
      });
      const applicationsResult = await readJsonResponse(
        applicationsResponse,
        applicationsUrl
      );

      const allProfilesUrl = `${API_URL}/api/profiles/admin/all`;
      const allProfilesResponse = await fetch(allProfilesUrl, {
        headers: authHeaders(),
      });
      const allProfilesResult = await readJsonResponse(
        allProfilesResponse,
        allProfilesUrl
      );

      if (!usersResponse.ok) {
        throw new Error(usersResult.message || "Could not load users.");
      }

      if (!applicationsResponse.ok) {
        throw new Error(
          applicationsResult.message || "Could not load applications."
        );
      }

      if (!allProfilesResponse.ok) {
        throw new Error(allProfilesResult.message || "Could not load profiles.");
      }

      setUsers(usersResult.users || []);
      setApplications(applicationsResult.applications || []);
      setAllProfiles(allProfilesResult.profiles || []);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadResumeTemplates = async () => {
    try {
      const url = `${API_URL}/api/resume-templates`;

      const response = await fetch(url, {
        headers: authHeaders(),
      });

      const result = await readJsonResponse(response, url);

      if (!response.ok) {
        throw new Error(result.message || "Could not load resume templates.");
      }

      const templates = result.templates || [];
      setResumeTemplates(templates);

      templates.forEach((template) => {
        loadTemplatePreview(template.id);
      });
    } catch (error) {
      alert(error.message);
    }
  };

  const uploadResumeTemplate = async () => {
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

      const url = `${API_URL}/api/resume-templates`;

      const response = await fetch(url, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });

      const result = await readJsonResponse(response, url);

      if (!response.ok) {
        throw new Error(result.message || "Could not upload resume template.");
      }

      alert(result.message || "DOCX resume template uploaded.");

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

  const setDefaultResumeTemplate = async (templateId) => {
    try {
      const url = `${API_URL}/api/resume-templates/${templateId}/default`;

      const response = await fetch(url, {
        method: "PATCH",
        headers: authHeaders(),
      });

      const result = await readJsonResponse(response, url);

      if (!response.ok) {
        throw new Error(result.message || "Could not set default template.");
      }

      alert(result.message || "Default template updated.");
      await loadResumeTemplates();
      await loadAdminData();
    } catch (error) {
      alert(error.message);
    }
  };

  const removeResumeTemplate = async (templateId) => {
    const confirmed = window.confirm("Remove this resume template?");

    if (!confirmed) return;

    try {
      const url = `${API_URL}/api/resume-templates/${templateId}`;

      const response = await fetch(url, {
        method: "DELETE",
        headers: authHeaders(),
      });

      const result = await readJsonResponse(response, url);

      if (!response.ok) {
        throw new Error(result.message || "Could not remove template.");
      }

      alert(result.message || "Resume template removed.");

      const previousUrl = templatePreviewUrlsRef.current[templateId];

      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }

      const updatedPreviewUrls = { ...templatePreviewUrlsRef.current };
      delete updatedPreviewUrls[templateId];

      templatePreviewUrlsRef.current = updatedPreviewUrls;
      setTemplatePreviewUrls(updatedPreviewUrls);

      await loadResumeTemplates();
      await loadAdminData();
    } catch (error) {
      alert(error.message);
    }
  };

  const updateProfileResumeTemplate = async (profileId, resumeTemplateId) => {
    try {
      const url = `${API_URL}/api/profiles/admin/${profileId}/resume-template`;

      const response = await fetch(url, {
        method: "PATCH",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({
          resumeTemplateId: resumeTemplateId || null,
        }),
      });

      const result = await readJsonResponse(response, url);

      if (!response.ok) {
        throw new Error(result.message || "Could not update resume template.");
      }

      alert(result.message || "Resume template updated.");
      await loadAdminData();
    } catch (error) {
      alert(error.message);
    }
  };

  const updateApproval = async (userId, isApproved) => {
    try {
      const url = `${API_URL}/api/auth/users/${userId}/approval`;

      const response = await fetch(url, {
        method: "PATCH",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({
          isApproved,
        }),
      });

      const result = await readJsonResponse(response, url);

      if (!response.ok) {
        await loadAdminData();
        throw new Error(result.message || "Could not update account.");
      }

      alert(result.message);
      await loadAdminData();
    } catch (error) {
      alert(error.message);
    }
  };

  const deleteAccountForever = async (accountItem) => {
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
      const url = `${API_URL}/api/auth/users/${accountItem.id}`;

      const response = await fetch(url, {
        method: "DELETE",
        headers: authHeaders(),
      });

      const result = await readJsonResponse(response, url);

      if (!response.ok) {
        throw new Error(result.message || "Could not permanently delete account.");
      }

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

  const updateJobBidStyle = async (userId, style) => {
    try {
      const url = `${API_URL}/api/auth/users/${userId}/job-bid-style`;

      const response = await fetch(url, {
        method: "PATCH",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({
          jobBidStyle: style,
        }),
      });

      const result = await readJsonResponse(response, url);

      if (!response.ok) {
        throw new Error(result.message || "Could not update job-bid style.");
      }

      alert("Job-bid style updated.");
      await loadAdminData();
    } catch (error) {
      alert(error.message);
    }
  };

  const saveProfilePrompt = async (profileId, adminPrompt) => {
    const url = `${API_URL}/api/profiles/admin/${profileId}/prompt`;

    const response = await fetch(url, {
      method: "PATCH",
      headers: jsonAuthHeaders(),
      body: JSON.stringify({
        adminPrompt,
      }),
    });

    const result = await readJsonResponse(response, url);

    if (!response.ok) {
      throw new Error(result.message || "Could not update profile prompt.");
    }

    return result;
  };

  const viewProfilePrompt = (profile) => {
    if (!profile.admin_prompt || !profile.admin_prompt.trim()) {
      alert("You didn't upload prompt!");
      return;
    }

    const blob = new Blob([profile.admin_prompt], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const safeProfileName = (profile.profile_name || "profile")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "_");

    link.href = url;
    link.download = `${safeProfileName}_prompt.txt`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
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

  const removeProfilePrompt = async (profileId) => {
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

  useEffect(() => {
    loadAdminData();
    loadResumeTemplates();

    return () => {
      Object.values(templatePreviewUrlsRef.current).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  const adminUsers = users.filter((item) => item.account_type === "admin");
  const normalAdminUsers = users.filter((item) => item.account_type === "user");

  const usersControlledBySelectedAdmin = selectedAdminForUsers
    ? users.filter((item) => {
        if (item.account_type !== "user") return false;

        const approvedByIdMatches =
          item.approved_by_admin_id &&
          String(item.approved_by_admin_id) === String(selectedAdminForUsers.id);

        const approvedByEmailMatches =
          item.approved_by_admin_email &&
          selectedAdminForUsers.email &&
          String(item.approved_by_admin_email).trim().toLowerCase() ===
            String(selectedAdminForUsers.email).trim().toLowerCase();

        return approvedByIdMatches || approvedByEmailMatches;
      })
    : [];

  const selectedUserProfiles = selectedUserForProfiles
    ? allProfiles.filter(
        (profile) =>
          String(profile.user_id) === String(selectedUserForProfiles.id)
      )
    : [];

  const getProfileApplicationRows = (profile) => {
    const rows = [];

    applications.forEach((applicationGroup) => {
      const matchingProfileRows = (applicationGroup.profiles || []).filter(
        (appProfile) => String(appProfile.profileId) === String(profile.id)
      );

      matchingProfileRows.forEach((profileRow) => {
        rows.push({
          companyName: applicationGroup.company_name,
          roleName: applicationGroup.role_name,
          appliedAt: profileRow.appliedAt,
          profileName: profileRow.profileName,
          profileEmail: profileRow.profileEmail,
          profileLocation: profileRow.profileLocation,
        });
      });
    });

    return rows.sort((a, b) => {
      const timeA = new Date(a.appliedAt || 0).getTime();
      const timeB = new Date(b.appliedAt || 0).getTime();

      return timeA - timeB;
    });
  };

  const getWholeApplicationCount = (profile) => {
    return getProfileApplicationRows(profile).length;
  };

  const getMostRecentApplicationCount = (profile) => {
    const rows = getProfileApplicationRows(profile);

    if (rows.length === 0) {
      return 0;
    }

    const latestApplication = rows[rows.length - 1];
    const latestDate = formatDateOnly(latestApplication.appliedAt);

    return rows.filter((row) => formatDateOnly(row.appliedAt) === latestDate)
      .length;
  };

  const getApplicationDateGroups = (rows) => {
    const groups = {};

    rows.forEach((row) => {
      const dateKey = formatDateOnly(row.appliedAt);

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }

      groups[dateKey].push(row);
    });

    return Object.entries(groups).map(([date, dateRows]) => ({
      date,
      rows: dateRows,
    }));
  };

  const openProfileApplications = (profile) => {
    const rows = getProfileApplicationRows(profile);
    const dateGroups = getApplicationDateGroups(rows);

    setSelectedProfileApplications({
      profile,
      rows,
      dateGroups,
    });

    setSelectedApplicationDate(null);
    setApplicationDashboardMode("dates");
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

  const selectedDateApplications =
    selectedProfileApplications && selectedApplicationDate
      ? selectedProfileApplications.dateGroups.find(
          (group) => group.date === selectedApplicationDate
        )?.rows || []
      : [];

  const renderUserTable = (tableUsers, emptyMessage = "No users found.") => (
    <div className="admin-table-wrap modern">
      <table className="admin-table modern">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Type</th>
            <th>Status</th>
            <th>Approved By</th>
            <th>Job-Bid Style</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {tableUsers.map((item) => (
            <tr
              key={item.id}
              className={
                selectedUserForProfiles?.id === item.id
                  ? "clickable-user-row selected"
                  : "clickable-user-row"
              }
              onClick={() => {
                setSelectedUserForProfiles(item);
                setSelectedProfileApplications(null);
                setSelectedApplicationDate(null);
              }}
            >
              <td>{item.name}</td>
              <td>{item.email}</td>
              <td>{item.account_type}</td>

              <td>
                <span
                  className={
                    item.is_approved
                      ? "status-badge approved"
                      : "status-badge pending"
                  }
                >
                  {item.is_approved ? "Approved" : "Pending"}
                </span>
              </td>

              <td>
                {item.approved_by_admin_name
                  ? `${item.approved_by_admin_name} (${item.approved_by_admin_email})`
                  : "-"}
              </td>

              <td>
                <select
                  className="admin-select"
                  value={item.job_bid_style || "copy_generate"}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateJobBidStyle(item.id, e.target.value)}
                  disabled={!item.is_approved}
                >
                  <option value="copy_generate">
                    Copy Prompt & Generate Resume
                  </option>
                  <option value="build_resume">Build Resume</option>
                </select>
              </td>

              <td>{new Date(item.created_at).toLocaleString()}</td>

              <td>
                <div className="profile-admin-actions compact-actions">
                  {item.is_approved ? (
                    <button
                      type="button"
                      className="block-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateApproval(item.id, false);
                      }}
                    >
                      Block
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="approve-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateApproval(item.id, true);
                      }}
                    >
                      Approve
                    </button>
                  )}

                  {canDeleteAccount(item) && (
                    <button
                      type="button"
                      className="block-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAccountForever(item);
                      }}
                    >
                      Delete Forever
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}

          {tableUsers.length === 0 && (
            <tr>
              <td colSpan="8">{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderSelectedUserProfiles = () => {
    if (!selectedUserForProfiles) return null;

    return (
      <div className="selected-user-profile-panel">
        <div className="selected-user-profile-header">
          <div>
            <h3>{selectedUserForProfiles.name}'s Profiles</h3>
            <p>{selectedUserForProfiles.email}</p>
          </div>

          <button
            type="button"
            className="refresh-btn"
            onClick={() => {
              setSelectedUserForProfiles(null);
              setSelectedProfileApplications(null);
              setSelectedApplicationDate(null);
            }}
          >
            Close
          </button>
        </div>

        {selectedUserProfiles.length === 0 ? (
          <div className="empty-user-profiles">
            This user has no profiles yet.
          </div>
        ) : (
          <div className="selected-profile-grid-admin">
            {selectedUserProfiles.map((profile) => (
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

                <div className="profile-admin-actions">
                  <button
                    type="button"
                    className="refresh-btn"
                    onClick={() => openProfileApplications(profile)}
                  >
                    View Applications ({getProfileApplicationRows(profile).length})
                  </button>

                  <button
                    type="button"
                    className="refresh-btn"
                    onClick={() => viewProfilePrompt(profile)}
                  >
                    View Prompt
                  </button>

                  <button
                    type="button"
                    className="approve-btn"
                    onClick={() => triggerPromptUpload(profile.id)}
                  >
                    Update Prompt
                  </button>

                  <button
                    type="button"
                    className="block-btn"
                    onClick={() => removeProfilePrompt(profile.id)}
                  >
                    Remove Prompt
                  </button>

                  <input
                    type="file"
                    accept=".txt,text/plain"
                    style={{ display: "none" }}
                    ref={(element) => {
                      fileInputRefs.current[profile.id] = element;
                    }}
                    onChange={(e) =>
                      handlePromptFileUpload(profile.id, e.target.files?.[0])
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderAdminsTable = () => (
    <div className="admin-table-wrap modern">
      <table className="admin-table modern">
        <thead>
          <tr>
            <th>Admin Name</th>
            <th>Email</th>
            <th>Status</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {adminUsers.map((adminItem) => {
            const protectedAdmin = isProtectedAdmin(adminItem);

            return (
              <tr
                key={adminItem.id}
                className={
                  selectedAdminForUsers?.id === adminItem.id
                    ? "clickable-user-row selected"
                    : "clickable-user-row"
                }
                onClick={() => {
                  if (!currentUserCanInspectAdminUsers) return;

                  setSelectedAdminForUsers(adminItem);
                  setSelectedUserForProfiles(null);
                  setSelectedProfileApplications(null);
                  setSelectedApplicationDate(null);
                }}
              >
                <td>
                  {adminItem.name}
                  {protectedAdmin ? " (Protected)" : ""}
                </td>

                <td>{adminItem.email}</td>

                <td>
                  <span
                    className={
                      adminItem.is_approved
                        ? "status-badge approved"
                        : "status-badge pending"
                    }
                  >
                    {adminItem.is_approved ? "Approved" : "Pending"}
                  </span>
                </td>

                <td>{new Date(adminItem.created_at).toLocaleString()}</td>

                <td>
                  <div className="profile-admin-actions compact-actions">
                    {protectedAdmin ? (
                      <span className="admin-note">Protected</span>
                    ) : !canManageThisAdmin(adminItem) ? (
                      <span className="admin-note">No Access</span>
                    ) : adminItem.is_approved ? (
                      <button
                        type="button"
                        className="block-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateApproval(adminItem.id, false);
                        }}
                      >
                        Block
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="approve-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateApproval(adminItem.id, true);
                        }}
                      >
                        Approve
                      </button>
                    )}

                    {!protectedAdmin && canDeleteAccount(adminItem) && (
                      <button
                        type="button"
                        className="block-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAccountForever(adminItem);
                        }}
                      >
                        Delete Forever
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}

          {adminUsers.length === 0 && (
            <tr>
              <td colSpan="5">No admins found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderTemplateRequirementsCard = () => (
    <div className="template-requirements-card">
      <h3>DOCX Template Requirements</h3>
      <p>
        Upload a valid DOCX layout with placeholders. Admin controls section
        order, headings, fonts, colors, spacing, margins, and left/right
        alignment. Invalid templates are rejected before they are added.
      </p>

      <div className="requirements-grid">
        <div>
          <strong>Plain placeholders</strong>
          <code>{"{{FULL_NAME}}"}</code>
          <code>{"{{TITLE}}"}</code>
          <code>{"{{CONTACT}}"}</code>
          <code>{"{{EMAIL}}"}</code>
          <code>{"{{LOCATION}}"}</code>
          <code>{"{{PHONE}}"}</code>
          <code>{"{{LINKS}}"}</code>
        </div>

        <div>
          <strong>Formatted block placeholders</strong>
          <code>{"{{@SUMMARY}}"}</code>
          <code>{"{{@EDUCATION}}"}</code>
          <code>{"{{@SKILLS}}"}</code>
          <code>{"{{@EXPERIENCE}}"}</code>
          <code>{"{{@CERTIFICATIONS}}"}</code>
          <span>Use these for simple one-block sections.</span>
        </div>

        <div>
          <strong>Education loop placeholders</strong>
          <code>{"{{#EDUCATION_ITEMS}}"}</code>
          <code>{"{{SCHOOL}}"}</code>
          <code>{"{{DEGREE}}"}</code>
          <code>{"{{MAJOR}}"}</code>
          <code>{"{{LOCATION}}"}</code>
          <code>{"{{TIMELINE}}"}</code>
          <code>{"{{DEGREE_MAJOR}}"}</code>
          <code>{"{{SCHOOL_DEGREE_MAJOR}}"}</code>
          <code>{"{{/EDUCATION_ITEMS}}"}</code>
        </div>

        <div>
          <strong>Experience loop placeholders</strong>
          <code>{"{{#EXPERIENCE_ITEMS}}"}</code>
          <code>{"{{TITLE}}"}</code>
          <code>{"{{COMPANY_NAME}}"}</code>
          <code>{"{{LOCATION}}"}</code>
          <code>{"{{TIMELINE}}"}</code>
          <code>{"{{TITLE_COMPANY}}"}</code>
          <code>{"{{COMPANY_TITLE}}"}</code>
          <code>{"{{@DETAILS}}"}</code>
          <code>{"{{/EXPERIENCE_ITEMS}}"}</code>
        </div>

        <div>
          <strong>Auto formatting</strong>
          <span>Real Word bullets</span>
          <span>Justified paragraphs</span>
          <span>Bold: **text**</span>
          <span>Italic: *text*</span>
          <span>Underline: __text__</span>
          <span>Skill categories auto-bold before ":"</span>
          <span>DOCX converts to PDF for user download</span>
        </div>

        <div>
          <strong>Right-side timeline tip</strong>
          <span>Use a borderless 2-column table in Word.</span>
          <span>Left cell: title/company/degree/location</span>
          <span>Right cell: {"{{TIMELINE}}"}</span>
          <span>Do not use spaces for alignment.</span>
          <span>{"{{@DETAILS}}"} must be alone in its own paragraph.</span>
        </div>
      </div>
    </div>
  );

  const renderTemplatePreview = (template) => (
    <div className="template-preview-card">
      <div className="template-preview-top">
        <strong>Sample Resume Preview</strong>

        <button
          type="button"
          className="prompt-action-btn view"
          onClick={() => loadTemplatePreview(template.id)}
        >
          Refresh Preview
        </button>
      </div>

      {templatePreviewUrls[template.id] ? (
        <iframe
          title={`${template.name} preview`}
          src={templatePreviewUrls[template.id]}
          className="template-preview-frame"
        />
      ) : (
        <div className="template-preview-empty">Preview loading...</div>
      )}
    </div>
  );

  const renderResumeTemplatesSection = () => (
    <section className="admin-content-card">
      <div className="admin-section-header">
        <div>
          <h2>Resume Templates</h2>
          <p>
            Upload DOCX resume templates. Admins can set one default template and
            assign templates to user profiles.
          </p>
        </div>

        <button
          type="button"
          className="admin-primary-btn"
          onClick={loadResumeTemplates}
        >
          Refresh Templates
        </button>
      </div>

      <div className="template-admin-grid with-requirements">
        {renderTemplateRequirementsCard()}

        <div className="template-upload-card">
          <h3>Upload DOCX Template</h3>
          <p>
            Upload a DOCX file with simple placeholders like {"{{FULL_NAME}}"}{" "}
            and {"{{CONTACT}}"}, formatted blocks like {"{{@SKILLS}}"}, or
            advanced loops like {"{{#EXPERIENCE_ITEMS}}"} with{" "}
            {"{{@DETAILS}}"}.
          </p>

          <div className="resume-input-group">
            <label>Template Name</label>
            <input
              className="resume-text-input"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Classic ATS Template"
            />
          </div>

          <div className="resume-input-group">
            <label>Description</label>
            <input
              className="resume-text-input"
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              placeholder="Clean DOCX resume layout"
            />
          </div>

          <div className="resume-input-group">
            <label>DOCX File</label>
            <input
              id="resumeTemplateFile"
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="resume-text-input file-input-modern"
              onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
            />
          </div>

          <label className="template-default-check">
            <input
              type="checkbox"
              checked={templateIsDefault}
              onChange={(e) => setTemplateIsDefault(e.target.checked)}
            />
            <span>Set as default template</span>
          </label>

          <button
            type="button"
            className="admin-primary-btn"
            onClick={uploadResumeTemplate}
            disabled={templateUploading}
          >
            {templateUploading ? "Validating..." : "Upload DOCX Template"}
          </button>
        </div>

        <div className="template-list-card">
          <h3>Available Templates</h3>
          <p>
            These DOCX templates can be assigned to user profiles. Preview shows
            a realistic sample resume generated from each uploaded template.
          </p>

          {resumeTemplates.length === 0 ? (
            <div className="empty-user-profiles">
              No resume templates uploaded yet.
            </div>
          ) : (
            <div className="template-list">
              {resumeTemplates.map((template) => (
                <div className="template-list-item" key={template.id}>
                  <div className="template-main-info">
                    <div>
                      <h4>{template.name}</h4>
                      <p>{template.description || "No description"}</p>
                      <small>{template.file_name}</small>
                    </div>

                    {template.is_default && (
                      <span className="status-badge approved">Default</span>
                    )}
                  </div>

                  <div className="template-meta-row">
                    <span>
                      Uploaded: {new Date(template.created_at).toLocaleString()}
                    </span>
                  </div>

                  {renderTemplatePreview(template)}

                  <div className="template-actions">
                    {!template.is_default && (
                      <button
                        type="button"
                        className="approve-btn"
                        onClick={() => setDefaultResumeTemplate(template.id)}
                      >
                        Set Default
                      </button>
                    )}

                    <button
                      type="button"
                      className="block-btn"
                      onClick={() => removeResumeTemplate(template.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <div className="admin-logo-mark">F</div>
          <span>FRT Admin</span>
        </div>

        <div className="admin-sidebar-group">
          <button
            type="button"
            className={
              activeSection === "users" ? "sidebar-link active" : "sidebar-link"
            }
            onClick={() => {
              setActiveSection("users");
              resetApplicationDashboard();
            }}
          >
            <span>👥</span>
            {canManageAdmins ? "Admins" : "Users"}
          </button>

          <button
            type="button"
            className={
              activeSection === "profiles"
                ? "sidebar-link active"
                : "sidebar-link"
            }
            onClick={() => {
              setActiveSection("profiles");
              resetApplicationDashboard();
            }}
          >
            <span>🧾</span>
            User Profiles
          </button>

          <button
            type="button"
            className={
              activeSection === "templates"
                ? "sidebar-link active"
                : "sidebar-link"
            }
            onClick={() => {
              setActiveSection("templates");
              resetApplicationDashboard();
              loadResumeTemplates();
            }}
          >
            <span>📄</span>
            Resume Templates
          </button>
        </div>

        <div className="admin-sidebar-bottom">
          <button
            type="button"
            className="sidebar-link"
            onClick={() => {
              loadAdminData();
              loadResumeTemplates();
            }}
          >
            <span>🔄</span>
            Refresh
          </button>

          <button
            type="button"
            className="sidebar-link danger"
            onClick={onLogout}
          >
            <span>↩</span>
            Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1>Dashboard</h1>
            <p>
              Manage users, profiles, prompts, applications, and resume
              templates.
            </p>
          </div>

          <div className="admin-top-actions">
            <button type="button" className="admin-user-pill">
              {user.name}
            </button>
          </div>
        </header>

        <section className="admin-hero-card">
          <div className="admin-hero-icon">✓</div>

          <div>
            <h2>Admin Control Center</h2>
            <p>
              Review accounts, manage access, assign templates, upload prompts,
              and track application activity.
            </p>
          </div>

          <button
            type="button"
            className="admin-primary-btn"
            onClick={() => {
              loadAdminData();
              loadResumeTemplates();
            }}
          >
            {loading ? "Loading..." : "Refresh Data"}
          </button>
        </section>

        {activeSection === "users" && applicationDashboardMode === "users" && (
          <section className="admin-content-card">
            {canManageAdmins ? (
              <>
                <div className="admin-section-header">
                  <div>
                    <h2>Admins</h2>
                    <p>
                      Admin permissions are controlled by the backend. No owner
                      or special-admin emails are stored in the frontend.
                    </p>
                  </div>
                </div>

                {renderAdminsTable()}

                {currentUserCanInspectAdminUsers && selectedAdminForUsers && (
                  <div className="selected-user-profile-panel">
                    <div className="selected-user-profile-header">
                      <div>
                        <h3>{selectedAdminForUsers.name}'s Controlled Users</h3>
                        <p>{selectedAdminForUsers.email}</p>
                      </div>

                      <button
                        type="button"
                        className="refresh-btn"
                        onClick={() => {
                          setSelectedAdminForUsers(null);
                          setSelectedUserForProfiles(null);
                          setSelectedProfileApplications(null);
                          setSelectedApplicationDate(null);
                        }}
                      >
                        Close
                      </button>
                    </div>

                    {renderUserTable(
                      usersControlledBySelectedAdmin,
                      "This admin does not control any users yet."
                    )}

                    {renderSelectedUserProfiles()}
                  </div>
                )}

                <div
                  className="admin-section-header"
                  style={{ marginTop: "24px" }}
                >
                  <div>
                    <h2>Users</h2>
                    <p>Manage approved and pending users.</p>
                  </div>
                </div>

                {renderUserTable(normalAdminUsers)}
                {renderSelectedUserProfiles()}
              </>
            ) : (
              <>
                <div className="admin-section-header">
                  <div>
                    <h2>Users</h2>
                    <p>
                      Click a user row to view and manage that user's profiles.
                    </p>
                  </div>
                </div>

                {renderUserTable(normalAdminUsers)}
                {renderSelectedUserProfiles()}
              </>
            )}
          </section>
        )}

        {activeSection === "users" &&
          applicationDashboardMode === "dates" &&
          selectedProfileApplications && (
            <section className="admin-content-card">
              <div className="admin-section-header">
                <div>
                  <h2>
                    Applications for{" "}
                    {selectedProfileApplications.profile.profile_name}
                  </h2>
                  <p>
                    Click a date row to view applications submitted by this
                    profile.
                  </p>
                </div>

                <button
                  type="button"
                  className="refresh-btn"
                  onClick={backToUsersProfiles}
                >
                  Back to Profiles
                </button>
              </div>

              {selectedProfileApplications.dateGroups.length === 0 ? (
                <div className="empty-user-profiles">
                  This profile has no applications yet.
                </div>
              ) : (
                <div className="admin-table-wrap modern">
                  <table className="admin-table modern">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Date</th>
                        <th>Applications</th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedProfileApplications.dateGroups.map(
                        (group, index) => (
                          <tr
                            key={group.date}
                            className="clickable-user-row"
                            onClick={() => openApplicationDateList(group.date)}
                          >
                            <td>
                              <span className="status-badge approved">
                                {index + 1}
                              </span>
                            </td>

                            <td>{group.date}</td>

                            <td>
                              <span className="status-badge approved">
                                {group.rows.length}
                              </span>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

        {activeSection === "users" &&
          applicationDashboardMode === "list" &&
          selectedProfileApplications &&
          selectedApplicationDate && (
            <section className="admin-content-card">
              <div className="admin-section-header">
                <div>
                  <h2>
                    Applications for{" "}
                    {selectedProfileApplications.profile.profile_name}
                  </h2>
                  <p>{selectedApplicationDate} application list.</p>
                </div>

                <button
                  type="button"
                  className="refresh-btn"
                  onClick={backToProfileApplications}
                >
                  Back to Dates
                </button>
              </div>

              {selectedDateApplications.length === 0 ? (
                <div className="empty-user-profiles">
                  No applications found for this date.
                </div>
              ) : (
                <div className="admin-table-wrap modern">
                  <table className="admin-table modern">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Company Name</th>
                        <th>Role Name</th>
                        <th>Date - Time</th>
                        <th>Applied Info</th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedDateApplications.map((row, index) => (
                        <tr
                          key={`${row.companyName}-${row.roleName}-${row.appliedAt}-${index}`}
                        >
                          <td>
                            <span className="status-badge approved">
                              {index + 1}
                            </span>
                          </td>

                          <td>{row.companyName}</td>
                          <td>{row.roleName}</td>
                          <td>{formatDateTime(row.appliedAt)}</td>
                          <td>
                            {row.profileName} - {row.profileEmail}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

        {activeSection === "profiles" && (
          <section className="admin-content-card">
            <div className="admin-section-header">
              <div>
                <h2>User Profiles</h2>
                <p>
                  View, update, or remove each profile prompt and assign a DOCX
                  resume template.
                </p>
              </div>
            </div>

            <div className="admin-table-wrap modern">
              <table className="admin-table modern">
                <thead>
                  <tr>
                    <th>User Name</th>
                    <th>Profile Name</th>
                    <th>Profile Location</th>
                    <th>Profile Phone</th>
                    <th>Profile Email</th>
                    <th>Prompt</th>
                    <th>Resume Template</th>
                    <th>Whole Application Count</th>
                    <th>Most Recent Application Count</th>
                  </tr>
                </thead>

                <tbody>
                  {allProfiles.map((profile) => (
                    <tr key={profile.id}>
                      <td>{profile.user_name || "-"}</td>
                      <td>{profile.profile_name || "-"}</td>
                      <td>{profile.location || "-"}</td>
                      <td>{profile.phone || "-"}</td>
                      <td>{profile.profile_email || "-"}</td>

                      <td>
                        <div className="prompt-inline-panel">
                          <div className="prompt-inline-status-row">
                            <span
                              className={
                                profile.admin_prompt &&
                                profile.admin_prompt.trim()
                                  ? "prompt-pill uploaded"
                                  : "prompt-pill sample"
                              }
                            >
                              {profile.admin_prompt &&
                              profile.admin_prompt.trim()
                                ? "Uploaded Prompt"
                                : "Sample Prompt"}
                            </span>
                          </div>

                          <div className="prompt-inline-actions">
                            <button
                              type="button"
                              className="prompt-action-btn view"
                              onClick={() => viewProfilePrompt(profile)}
                            >
                              View
                            </button>

                            <button
                              type="button"
                              className="prompt-action-btn update"
                              onClick={() => triggerPromptUpload(profile.id)}
                            >
                              Update
                            </button>

                            <button
                              type="button"
                              className="prompt-action-btn remove"
                              onClick={() => removeProfilePrompt(profile.id)}
                            >
                              Remove
                            </button>
                          </div>

                          <input
                            type="file"
                            accept=".txt,text/plain"
                            style={{ display: "none" }}
                            ref={(element) => {
                              fileInputRefs.current[profile.id] = element;
                            }}
                            onChange={(e) =>
                              handlePromptFileUpload(
                                profile.id,
                                e.target.files?.[0]
                              )
                            }
                          />
                        </div>
                      </td>

                      <td>
                        <div className="template-profile-picker">
                          <select
                            className="admin-select"
                            value={profile.resume_template_id || ""}
                            onChange={(e) =>
                              updateProfileResumeTemplate(
                                profile.id,
                                e.target.value || null
                              )
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
                            Current:{" "}
                            {profile.resume_template_name || "Default template"}
                          </p>
                        </div>
                      </td>

                      <td>
                        <span className="status-badge approved">
                          {getWholeApplicationCount(profile)}
                        </span>
                      </td>

                      <td>
                        <span className="status-badge approved">
                          {getMostRecentApplicationCount(profile)}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {allProfiles.length === 0 && (
                    <tr>
                      <td colSpan="9">No profiles found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeSection === "templates" && renderResumeTemplatesSection()}
      </main>
    </div>
  );
}

export default AdminDashboard;