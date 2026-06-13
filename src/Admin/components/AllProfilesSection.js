import IconButton from "../../UI/IconButton";
import {
  ProfileEducationDetails,
  ProfileExperienceDetails,
} from "./ProfileDetailViews";

function AllProfilesSection({
  profiles,
  resumeTemplates,
  fileInputRefs,
  getWholeCount,
  getRecentCount,
  getProfileRows,
  onUpdateResumeTemplate,
  onViewPrompt,
  onTriggerPromptUpload,
  onPromptFileUpload,
  onRemovePrompt,
  onDeleteApplications,
}) {
  return (
    <section className="admin-content-card">
      <div className="admin-section-header">
        <div>
          <h2>User Profiles</h2>
          <p>
            View full profile details, update prompts, and assign DOCX resume
            templates.
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
              <th>Education Details</th>
              <th>Experience Details</th>
              <th>Prompt</th>
              <th>Resume Template</th>
              <th>Whole Application Count</th>
              <th>Most Recent Date Count</th>
              <th>Delete Application Counts</th>
            </tr>
          </thead>

          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id}>
                <td>{profile.user_name || "-"}</td>
                <td>{profile.profile_name || "-"}</td>
                <td>{profile.location || "-"}</td>
                <td>{profile.phone || "-"}</td>
                <td>{profile.profile_email || "-"}</td>
                <td>
                  <ProfileEducationDetails profile={profile} />
                </td>
                <td>
                  <ProfileExperienceDetails profile={profile} />
                </td>

                <td>
                  <div className="prompt-inline-panel">
                    <div className="prompt-inline-status-row">
                      <span
                        className={
                          profile.admin_prompt && profile.admin_prompt.trim()
                            ? "prompt-pill uploaded"
                            : "prompt-pill sample"
                        }
                      >
                        {profile.admin_prompt && profile.admin_prompt.trim()
                          ? "Uploaded Prompt"
                          : "Sample Prompt"}
                      </span>
                    </div>

                    <div className="prompt-inline-actions">
                      <IconButton
                        icon="eye"
                        label="View prompt"
                        variant="ghost"
                        size="sm"
                        className="prompt-action-btn view"
                        onClick={() => onViewPrompt(profile)}
                      />

                      <IconButton
                        icon="upload"
                        label="Update prompt"
                        variant="ghost"
                        size="sm"
                        className="prompt-action-btn update"
                        onClick={() => onTriggerPromptUpload(profile.id)}
                      />

                      <IconButton
                        icon="trash"
                        label="Remove prompt"
                        variant="danger"
                        size="sm"
                        className="prompt-action-btn remove"
                        onClick={() => onRemovePrompt(profile.id)}
                      />
                    </div>

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
                </td>

                <td>
                  <div className="template-profile-picker">
                    <select
                      className="admin-select"
                      value={profile.resume_template_id || ""}
                      onChange={(e) =>
                        onUpdateResumeTemplate(
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
                      Current: {profile.resume_template_name || "Default template"}
                    </p>
                  </div>
                </td>

                <td>
                  <span className="status-badge approved">
                    {getWholeCount(profile)}
                  </span>
                </td>

                <td>
                  <span className="status-badge approved">
                    {getRecentCount(profile)}
                  </span>
                </td>

                <td>
                  <div className="profile-admin-actions compact-actions">
                    <IconButton
                      icon="trash"
                      label="Delete all applications"
                      variant="danger"
                      size="sm"
                      onClick={() =>
                        onDeleteApplications({ profile, deleteType: "all" })
                      }
                    />

                    <IconButton
                      icon="trash"
                      label="Delete latest day"
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        const rows = getProfileRows(profile);
                        const latestRow = rows[rows.length - 1];
                        const latestDate = latestRow?.appliedAt
                          ? new Date(latestRow.appliedAt)
                              .toISOString()
                              .slice(0, 10)
                          : "";

                        if (!latestDate) {
                          alert("No application date found for this profile.");
                          return;
                        }

                        onDeleteApplications({
                          profile,
                          deleteType: "day",
                          date: latestDate,
                        });
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}

            {profiles.length === 0 && (
              <tr>
                <td colSpan="12">No profiles found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default AllProfilesSection;
