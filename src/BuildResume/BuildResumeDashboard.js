import React, { useEffect, useState } from "react";

import AppShell from "../UI/AppShell";
import Icon from "../UI/Icon";
import IconButton from "../UI/IconButton";
import ProfileReferencePanel from "../Profile/components/ProfileReferencePanel";
import { fetchProfileById } from "../Profile/api/profileApi";
import { buildResumeFromProfile } from "../shared/api/buildResumeApi";
import {
  canUseFolderPicker,
  changeCustomerRootFolder,
  FOLDER_PICKER_REQUIRED_MESSAGE,
  FOLDER_PICKER_USER_HINT,
  getLocalDayBounds,
  getCachedCustomerRootFolder,
  warmCustomerRootFolder,
  saveResumeToCustomerFolder,
} from "../services/fileSystemSaveService";

function getTemplateLabel(profile) {
  return profile?.resume_template_name || "Default template";
}

function BuildResumeDashboard({
  user,
  selectedProfile,
  onLogout,
  onShowProfiles,
}) {
  const [roleName, setRoleName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveFolderReady, setSaveFolderReady] = useState(canUseFolderPicker());
  const [profile, setProfile] = useState(selectedProfile);

  useEffect(() => {
    setProfile(selectedProfile);
  }, [selectedProfile]);

  useEffect(() => {
    if (!canUseFolderPicker()) {
      return undefined;
    }

    let cancelled = false;

    warmCustomerRootFolder()
      .then(() => {
        if (!cancelled) {
          setSaveFolderReady(true);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProfile?.id) {
      return;
    }

    let cancelled = false;

    fetchProfileById(selectedProfile.id)
      .then((fullProfile) => {
        if (cancelled || !fullProfile) {
          return;
        }

        setProfile(fullProfile);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [selectedProfile?.id]);

  const resetApplicationInputs = () => {
    setRoleName("");
    setCompanyName("");
    setDescription("");
  };

  const handleChangeSaveFolder = async () => {
    if (!canUseFolderPicker()) {
      alert(FOLDER_PICKER_REQUIRED_MESSAGE);
      return;
    }

    try {
      await changeCustomerRootFolder();
      setSaveFolderReady(true);
      alert(
        "Save folder updated on your laptop/computer. Your next resume will be saved there."
      );
    } catch (error) {
      if (
        error?.name === "AbortError" ||
        String(error?.message || "").toLowerCase().includes("aborted")
      ) {
        return;
      }

      alert(error.message || "Could not change save folder.");
    }
  };

  const handleBuildResume = async () => {
    if (!profile?.id) {
      alert("Please select a profile first.");
      return;
    }

    if (!roleName.trim() || !companyName.trim() || !description.trim()) {
      alert("Role name, company name, and job description are required.");
      return;
    }

    if (!canUseFolderPicker()) {
      alert(FOLDER_PICKER_REQUIRED_MESSAGE);
      return;
    }

    const templateLabel = getTemplateLabel(profile);
    const templateNote = profile.resume_template_id
      ? "This is the template your admin assigned to your profile."
      : "No custom template is assigned, so the admin default template will be used.";

    const confirmed = window.confirm(
      `Build resume with this admin template?\n\nTemplate: ${templateLabel}\n${templateNote}\n\nNext, choose a folder on your laptop/computer. The PDF will be saved there only.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);

      const { dayStart, dayEnd } = getLocalDayBounds();
      const buildPayload = {
        profileId: profile.id,
        roleName: roleName.trim(),
        companyName: companyName.trim(),
        jobDescription: description.trim(),
        dayStart,
        dayEnd,
        recordApplication: true,
      };

      const cachedFolder = getCachedCustomerRootFolder();
      const folderPromise = cachedFolder
        ? Promise.resolve(cachedFolder)
        : warmCustomerRootFolder();

      const [folderSelection, buildResult] = await Promise.all([
        folderPromise,
        buildResumeFromProfile(buildPayload),
      ]);

      const {
        blob,
        sequenceNumber,
        templateName: templateNameFromServer,
        usesDefaultTemplate,
      } = buildResult;

      setSaveFolderReady(true);

      const pdfBytes = new Uint8Array(await blob.arrayBuffer());

      const saveResult = await saveResumeToCustomerFolder({
        pdfBytes,
        profileName: profile.name || "Profile",
        companyName: companyName.trim(),
        roleName: roleName.trim(),
        applicationNumber: sequenceNumber || 1,
        rootDirectoryHandle: folderSelection.handle,
      });

      resetApplicationInputs();

      alert(
        `Resume saved to your laptop/computer!\n\nTemplate: ${templateNameFromServer || templateLabel}${
          usesDefaultTemplate ? " (admin default)" : " (admin assigned)"
        }\nPath: ${saveResult.savedPath || `${saveResult.dateFolder}/${saveResult.companyRoleFolder}/${saveResult.fileName}`}`
      );
    } catch (error) {
      if (
        error?.name === "AbortError" ||
        String(error?.message || "").toLowerCase().includes("aborted")
      ) {
        return;
      }

      alert(error.message || "Could not build resume.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell
      kicker="Build Resume"
      title="Generate resume from profile"
      subtitle="Paste a job description, confirm your admin template, and save the PDF to a folder on your laptop or computer."
      user={user}
      selectedProfile={selectedProfile}
      onLogout={onLogout}
      onShowProfiles={onShowProfiles}
    >
      <div className="build-fast-grid">
        <section className="fast-apply-card">
          <div className="fast-section-title">
            <div>
              <span>Step 1</span>
              <h2>Application Details</h2>
            </div>

            <IconButton
              icon="clear"
              label="Clear fields"
              variant="ghost"
              size="sm"
              onClick={resetApplicationInputs}
              disabled={loading}
            />
          </div>

          <div className="resume-input-row">
            <div className="resume-input-group">
              <label htmlFor="roleName">
                <Icon name="briefcase" size={13} /> Role
              </label>
              <input
                id="roleName"
                className="resume-text-input"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="AI/Machine Learning Engineer"
              />
            </div>

            <div className="resume-input-group">
              <label htmlFor="companyName">
                <Icon name="building" size={13} /> Company
              </label>
              <input
                id="companyName"
                className="resume-text-input"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Meta"
              />
            </div>
          </div>

          <div className="resume-input-group">
            <label htmlFor="description">Job Description</label>
            <textarea
              id="description"
              className="fast-jd-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste the job description here..."
            />
          </div>

          <div className="build-template-confirm-note">
            <Icon name="fileText" size={15} />
            <div>
              <strong>Admin template for this profile</strong>
              <p>{getTemplateLabel(profile)}</p>
              <span>
                {profile?.resume_template_id
                  ? "Assigned by your admin for this profile."
                  : "No custom template assigned — admin default will be used."}
              </span>
            </div>
          </div>

          <div className="resume-save-folder-note">
            <Icon name="folder" size={14} />
            <p>
              {saveFolderReady
                ? "Saves to a folder on your laptop or computer."
                : FOLDER_PICKER_USER_HINT}
            </p>
            <IconButton
              icon="folder"
              label="Change save folder"
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={handleChangeSaveFolder}
            />
          </div>

          <div className="fast-actions-row">
            <IconButton
              icon="wand"
              label={loading ? "Building resume..." : "Build resume"}
              variant="primary"
              size="lg"
              loading={loading}
              disabled={loading}
              onClick={handleBuildResume}
            />

            <IconButton
              icon="users"
              label="Change profile"
              variant="ghost"
              disabled={loading}
              onClick={onShowProfiles}
            />
          </div>
        </section>

        <aside className="build-profile-compact-card">
          <div className="fast-section-title">
            <div>
              <span>Selected</span>
              <h2>{profile?.name || "Profile"}</h2>
            </div>
          </div>

          {profile ? (
            <ProfileReferencePanel profile={profile} />
          ) : (
            <div className="empty-profile-box">
              No profile selected. Please select a profile first.
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}

export default BuildResumeDashboard;
