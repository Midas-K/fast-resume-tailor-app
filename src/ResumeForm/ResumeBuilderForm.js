import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Icon from "../UI/Icon";
import IconButton from "../UI/IconButton";
import ProfileReferencePanel from "../Profile/components/ProfileReferencePanel";
import { buildResumeFromTemplate, warmBuildResumeApi } from "../shared/api/buildResumeApi";
import { parseJsonField } from "../shared/utils/format";
import { parseAndValidateResumePaste } from "../shared/utils/parseResumeSections";
import {
  buildResumeSavedMessage,
  canUseFolderPicker,
  changeCustomerRootFolder,
  FOLDER_PICKER_USER_HINT,
  FOLDER_PICKER_REQUIRED_MESSAGE,
  getLocalDayBounds,
  getCachedCustomerRootFolder,
  MOBILE_ZIP_SAVE_HINT,
  prepareResumeSaveFolder,
  warmCustomerRootFolder,
  saveResumeToDevice,
  usesStructuredZipFallback,
} from "../services/fileSystemSaveService";

const scheduleIdle =
  typeof requestIdleCallback === "function"
    ? (callback, options) => requestIdleCallback(callback, options)
    : (callback) => window.setTimeout(callback, 1);

const cancelIdle =
  typeof cancelIdleCallback === "function"
    ? (id) => cancelIdleCallback(id)
    : (id) => window.clearTimeout(id);

function ResumeBuilderForm({
  appliedRole,
  appliedCompany,
  selectedProfile,
  compact = false,
}) {
  const [wholeResumePaste, setWholeResumePaste] = useState("");
  const [parseMeta, setParseMeta] = useState({
    foundSections: [],
    warnings: [],
    isParsed: false,
  });
  const [profileMatch, setProfileMatch] = useState({
    isValid: false,
    mismatches: [],
  });
  const [loading, setLoading] = useState(false);
  const [saveFolderReady, setSaveFolderReady] = useState(
    canUseFolderPicker() || usesStructuredZipFallback()
  );
  const [, startParseTransition] = useTransition();
  const parsedSnapshotRef = useRef({
    summary: "",
    skills: "",
    certification: "",
    experienceInputs: [],
    profileMatch: { isValid: false, mismatches: [] },
  });
  const lastParsedKeyRef = useRef("");
  const parseIdleRef = useRef(null);
  const buildPayloadRef = useRef(null);
  const appliedRoleRef = useRef(appliedRole);
  const appliedCompanyRef = useRef(appliedCompany);

  useEffect(() => {
    appliedRoleRef.current = appliedRole;
    appliedCompanyRef.current = appliedCompany;
  }, [appliedRole, appliedCompany]);

  const selectedEducation = useMemo(
    () => parseJsonField(selectedProfile?.education),
    [selectedProfile?.education]
  );
  const selectedExperience = useMemo(
    () => parseJsonField(selectedProfile?.experience),
    [selectedProfile?.experience]
  );

  useEffect(() => {
    warmBuildResumeApi();

    if (!canUseFolderPicker()) {
      return undefined;
    }

    let cancelled = false;

    warmCustomerRootFolder()
      .then((selection) => {
        if (!cancelled) {
          setSaveFolderReady(true);
          prepareResumeSaveFolder(selection?.handle).catch(() => {});
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const syncBuildPayloadRef = (parsed, profile) => {
    if (
      !parsed?.profileMatch?.isValid ||
      !profile?.id ||
      !String(appliedRoleRef.current || "").trim() ||
      !String(appliedCompanyRef.current || "").trim()
    ) {
      buildPayloadRef.current = null;
      return;
    }

    buildPayloadRef.current = {
      profileId: profile.id,
      roleName: String(appliedRoleRef.current).trim(),
      companyName: String(appliedCompanyRef.current).trim(),
      summary: parsed.summary.trim(),
      skills: parsed.skills.trim(),
      certification: parsed.certification.trim(),
      experienceInputs: parsed.experienceInputs.map((item) => ({
        ...item,
        companyName: item.companyName || "",
        title: item.title || "",
        timeline: item.timeline || "",
        location: item.location || profile.location || "",
        details: item.details.trim(),
      })),
      bodyJson: JSON.stringify({
        profileId: profile.id,
        roleName: String(appliedRoleRef.current).trim(),
        companyName: String(appliedCompanyRef.current).trim(),
        summary: parsed.summary.trim(),
        skills: parsed.skills.trim(),
        certification: parsed.certification.trim(),
        experienceInputs: parsed.experienceInputs.map((item) => ({
          companyName: item.companyName || "",
          title: item.title || "",
          timeline: item.timeline || "",
          location: item.location || profile.location || "",
          details: item.details.trim(),
        })),
        recordApplication: true,
      }),
    };
  };

  const applyParsedSnapshot = (rawText, profile) => {
    if (!rawText.trim() || !profile) {
      buildPayloadRef.current = null;
      parsedSnapshotRef.current = {
        summary: "",
        skills: "",
        certification: "",
        experienceInputs: parseJsonField(profile?.experience).map((item, index) => ({
          id: index,
          companyName: item.companyName || "",
          title: item.title || "",
          timeline: item.timeline || "",
          location: item.location || profile?.location || "",
          details: "",
        })),
        profileMatch: { isValid: false, mismatches: [] },
      };
      setParseMeta({
        foundSections: [],
        warnings: [],
        isParsed: false,
      });
      setProfileMatch({ isValid: false, mismatches: [] });
      return;
    }

    const parsed = parseAndValidateResumePaste({
      rawText,
      profile,
    });

    parsedSnapshotRef.current = parsed;
    lastParsedKeyRef.current = `${profile?.id || ""}:${rawText}`;
    startParseTransition(() => {
      setParseMeta(parsed.parseMeta);
      setProfileMatch(parsed.profileMatch);
    });
    syncBuildPayloadRef(parsed, profile);
  };

  useEffect(() => {
    if (!wholeResumePaste.trim() || !selectedProfile) {
      return undefined;
    }

    syncBuildPayloadRef(parsedSnapshotRef.current, selectedProfile);

    return undefined;
  }, [appliedRole, appliedCompany, selectedProfile, wholeResumePaste]);

  const scheduleParse = (rawText, profile) => {
    if (parseIdleRef.current) {
      cancelIdle(parseIdleRef.current);
    }

    parseIdleRef.current = scheduleIdle(
      () => {
        parseIdleRef.current = null;
        applyParsedSnapshot(rawText, profile);
      },
      { timeout: 50 }
    );
  };

  useEffect(
    () => () => {
      if (parseIdleRef.current) {
        cancelIdle(parseIdleRef.current);
      }
    },
    []
  );

  const handleResumePasteChange = (event) => {
    const nextValue = event.target.value;
    setWholeResumePaste(nextValue);
    scheduleParse(nextValue, selectedProfile);
  };

  const handleResumePaste = (event) => {
    const pastedText = event.clipboardData.getData("text");

    if (!pastedText) {
      return;
    }

    const { selectionStart, selectionEnd, value } = event.currentTarget;
    const nextValue = `${value.slice(0, selectionStart)}${pastedText}${value.slice(
      selectionEnd
    )}`;

    event.preventDefault();

    if (parseIdleRef.current) {
      cancelIdle(parseIdleRef.current);
      parseIdleRef.current = null;
    }

    setWholeResumePaste(nextValue);
    applyParsedSnapshot(nextValue, selectedProfile);
  };

  const getParsedForSave = () => {
    const parseKey = `${selectedProfile?.id || ""}:${wholeResumePaste}`;

    if (
      parseKey === lastParsedKeyRef.current &&
      parsedSnapshotRef.current.summary !== undefined
    ) {
      return parsedSnapshotRef.current;
    }

    const parsed = parseAndValidateResumePaste({
      rawText: wholeResumePaste,
      profile: selectedProfile,
    });

    parsedSnapshotRef.current = parsed;
    lastParsedKeyRef.current = parseKey;
    startParseTransition(() => {
      setParseMeta(parsed.parseMeta);
      setProfileMatch(parsed.profileMatch);
    });
    syncBuildPayloadRef(parsed, selectedProfile);

    return parsed;
  };

  const validateRequiredFields = () => {
    if (!selectedProfile) {
      alert("Please select a job-bid profile first.");
      return null;
    }

    if (
      !String(appliedRole || "").trim() ||
      !String(appliedCompany || "").trim()
    ) {
      alert("Please enter role name and company name first.");
      return null;
    }

    if (!wholeResumePaste.trim()) {
      alert(
        "Paste the full resume content with section headings (Summary, Skills, Experience, Certifications)."
      );
      return null;
    }

    const cachedPayload = buildPayloadRef.current;
    const canUseFastPath =
      cachedPayload?.bodyJson &&
      profileMatch.isValid &&
      lastParsedKeyRef.current === `${selectedProfile.id}:${wholeResumePaste}`;

    const parsed = canUseFastPath
      ? parsedSnapshotRef.current
      : getParsedForSave();

    if (!parsed.summary.trim()) {
      alert("Summary is required.");
      return null;
    }

    if (!parsed.skills.trim()) {
      alert("Skills are required.");
      return null;
    }

    if (parsed.experienceInputs.length === 0) {
      alert("At least one profile experience is required.");
      return null;
    }

    const missingExperience = parsed.experienceInputs.some(
      (item) => !item.details.trim()
    );

    if (missingExperience) {
      alert(
        "Experience details are required for every company in the selected profile."
      );
      return null;
    }

    if (!parsed.certification.trim()) {
      alert("Certifications are required.");
      return null;
    }

    if (!parsed.profileMatch.isValid) {
      alert(
        `Profile safety check failed. Experience and education must match your profile exactly before saving.\n\n${parsed.profileMatch.mismatches
          .map((item) => `- ${item}`)
          .join("\n")}`
      );
      return null;
    }

    return parsed;
  };

  const clearResumeInputs = () => {
    setWholeResumePaste("");
    applyParsedSnapshot("", selectedProfile);
  };

  const sectionStatusItems = [
    { id: "summary", label: "Summary" },
    { id: "skills", label: "Skills" },
    {
      id: "experience",
      label: `Experience (${selectedExperience.length})`,
    },
    { id: "certifications", label: "Certifications" },
  ];

  const renderParseStatus = () => {
    if (!wholeResumePaste.trim()) {
      return (
        <p className="resume-parse-hint">
          Paste the full AI resume output once. For skills, experience
          details, and certifications, paste plain sentences as you get them
          from AI — with or without blank lines between lines. Each non-empty
          line becomes one Word bullet in the saved PDF. Summary stays as
          normal paragraphs. Education and experience company/title/duration
          must match your profile exactly before saving.
        </p>
      );
    }

    return (
      <div className="resume-parse-status">
        <div className="resume-parse-status__chips">
          {sectionStatusItems.map((item) => {
            const found = parseMeta.foundSections.includes(item.id);

            return (
              <span
                key={item.id}
                className={
                  found
                    ? "resume-parse-chip resume-parse-chip--found"
                    : "resume-parse-chip resume-parse-chip--missing"
                }
              >
                <Icon name={found ? "checkCircle" : "info"} size={12} />
                {item.label}
              </span>
            );
          })}
        </div>

        {parseMeta.warnings.length > 0 && (
          <p className="resume-parse-warning">{parseMeta.warnings[0]}</p>
        )}

        {wholeResumePaste.trim() && (
          <div className="resume-profile-match">
            <span
              className={
                profileMatch.isValid
                  ? "resume-parse-chip resume-parse-chip--found"
                  : "resume-parse-chip resume-parse-chip--missing"
              }
            >
              <Icon name={profileMatch.isValid ? "checkCircle" : "info"} size={12} />
              {profileMatch.isValid
                ? "Profile safety check passed"
                : "Profile safety check failed"}
            </span>
            {!profileMatch.isValid && profileMatch.mismatches.length > 0 && (
              <p className="resume-parse-warning">
                {profileMatch.mismatches[0]}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderWholeResumePaste = () => (
    <div className="resume-paste-pane">
      {renderParseStatus()}

      <div className="resume-input-group resume-input-group--grow">
        <label htmlFor="wholeResumePaste">Paste full resume content *</label>
        <textarea
          id="wholeResumePaste"
          className="resume-whole-paste-textarea"
          value={wholeResumePaste}
          onChange={handleResumePasteChange}
          onPaste={handleResumePaste}
          placeholder={`Paste the complete resume content here.

Example headings (any order):
PROFESSIONAL SUMMARY
SKILLS
WORK EXPERIENCE
CERTIFICATIONS`}
        />
      </div>
    </div>
  );

  const renderSaveActions = () => (
    <div className={compact ? "resume-form-footer resume-form-footer--solo" : "profile-actions"}>
      <div className="resume-save-folder-note">
        <Icon name="folder" size={14} />
        <p>
          {usesStructuredZipFallback()
            ? MOBILE_ZIP_SAVE_HINT
            : saveFolderReady
              ? "Saves to your chosen folder using US Eastern (EST/EDT) date folders."
              : FOLDER_PICKER_USER_HINT}
        </p>
        {!usesStructuredZipFallback() && (
          <IconButton
            icon="folder"
            label="Change save folder"
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={handleChangeSaveFolder}
          />
        )}
      </div>
      <IconButton
        icon="fileDown"
        label={loading ? "Generating resume..." : "Save PDF resume"}
        variant="primary"
        size="lg"
        loading={loading}
        disabled={loading || (wholeResumePaste.trim() && !profileMatch.isValid)}
        onClick={generateResumePdf}
      />
    </div>
  );

  const generateResumePdf = async () => {
    const parsed = validateRequiredFields();

    if (!parsed) {
      return;
    }

    try {
      setLoading(true);

      const { dayStart, dayEnd } = getLocalDayBounds();
      const cachedPayload = buildPayloadRef.current;
      const buildPayload = {
        ...(cachedPayload || {
          profileId: selectedProfile.id,
          roleName: appliedRole.trim(),
          companyName: appliedCompany.trim(),
          summary: parsed.summary.trim(),
          skills: parsed.skills.trim(),
          certification: parsed.certification.trim(),
          experienceInputs: parsed.experienceInputs.map((item) => ({
            ...item,
            companyName: item.companyName || "",
            title: item.title || "",
            timeline: item.timeline || "",
            location: item.location || selectedProfile.location || "",
            details: item.details.trim(),
          })),
        }),
        dayStart,
        dayEnd,
        recordApplication: true,
      };
      const requestBodyJson = cachedPayload?.bodyJson
        ? JSON.stringify({
            ...JSON.parse(cachedPayload.bodyJson),
            dayStart,
            dayEnd,
          })
        : undefined;

      const folderPromise = canUseFolderPicker()
        ? (() => {
            const cachedFolder = getCachedCustomerRootFolder();
            return cachedFolder
              ? prepareResumeSaveFolder(cachedFolder.handle).then(() => cachedFolder)
              : warmCustomerRootFolder();
          })()
        : Promise.resolve(null);

      const [folderSelection, { blob, sequenceNumber }] = await Promise.all([
        folderPromise,
        buildResumeFromTemplate(buildPayload, {
          bodyJson: requestBodyJson || undefined,
        }),
      ]);

      if (folderSelection?.handle) {
        setSaveFolderReady(true);
      }

      const saveResultPromise = saveResumeToDevice({
        pdfBlob: blob,
        profileName: selectedProfile?.name || "Profile",
        companyName: appliedCompany?.trim() || "Unknown Company",
        roleName: appliedRole?.trim() || "Unknown Role",
        applicationNumber: sequenceNumber || 1,
        rootDirectoryHandle: folderSelection?.handle || null,
      });

      clearResumeInputs();
      buildPayloadRef.current = null;

      const saveResult = await saveResultPromise;

      alert(buildResumeSavedMessage(saveResult));
    } catch (error) {
      if (
        error?.name === "AbortError" ||
        String(error?.message || "").toLowerCase().includes("aborted")
      ) {
        return;
      }

      alert(error.message || "Could not generate resume PDF.");
    } finally {
      setLoading(false);
    }
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
        "Save folder updated on your device. Your next resume will be saved there."
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

  return (
    <section
      className={`card resume-form-card${compact ? " resume-form-compact" : ""}`}
    >
      <div
        className={`resume-form-header${
          compact ? " resume-form-header--compact" : ""
        }`}
      >
        <div className="form-icon">
          <Icon name="fileText" size={20} />
        </div>

        <div>
          <h2>Resume Builder</h2>
          {!compact && (
            <p>
              The assigned admin DOCX template is filled, converted to PDF, and
              saved on your device with the same date/company folder structure as
              desktop.
            </p>
          )}
        </div>
      </div>

      {selectedProfile && compact ? (
        <>
          <div className="resume-meta-strip">
            <strong>{selectedProfile.name}</strong>
            <span>
              {selectedExperience.length} experience · {selectedEducation.length}{" "}
              education
            </span>
          </div>

          <div className="resume-form-compact__split">
            <aside className="resume-form-compact__profile">
              <ProfileReferencePanel profile={selectedProfile} />
            </aside>

            <div className="resume-form-compact__editor">
              {renderWholeResumePaste()}
              {renderSaveActions()}
            </div>
          </div>
        </>
      ) : (
        <>
          {selectedProfile && !compact && (
            <div className="selected-profile-box">
              <div className="selected-profile-header">
                <div>
                  <h3>{selectedProfile.name}</h3>
                  <p>Selected job-bid profile</p>
                </div>
              </div>

              <div className="selected-profile-grid">
                <div>
                  <span>Location</span>
                  <strong>{selectedProfile.location || "Not provided"}</strong>
                </div>

                <div>
                  <span>Phone</span>
                  <strong>{selectedProfile.phone || "Not provided"}</strong>
                </div>

                <div>
                  <span>Email</span>
                  <strong>{selectedProfile.email || "Not provided"}</strong>
                </div>
              </div>

              <div className="resume-template-notice">
                <span>Resume Template</span>
                <strong>
                  {selectedProfile.resume_template_name || "Default template"}
                </strong>
                <p>Admin controls this template from the User Profiles section.</p>
              </div>

              {selectedEducation.length > 0 && (
                <div className="selected-profile-section compact">
                  <h4>Education</h4>

                  {selectedEducation.map((item, index) => (
                    <div className="selected-profile-item" key={index}>
                      <strong>{item.school || "School"}</strong>
                      <p>{item.degree || "Degree"}</p>
                      {item.major && <p>{item.major}</p>}
                      {item.location && <p>{item.location}</p>}
                      <p>{item.timeline || "Timeline"}</p>
                    </div>
                  ))}
                </div>
              )}

              {selectedExperience.length > 0 && (
                <div className="selected-profile-section compact">
                  <h4>Experience</h4>

                  {selectedExperience.map((item, index) => (
                    <div className="selected-profile-item" key={index}>
                      <strong>{item.companyName || "Company"}</strong>
                      <p>{item.title || "Title"}</p>
                      {item.location && <p>{item.location}</p>}
                      <p>{item.timeline || "Timeline"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={compact ? "resume-form-body" : undefined}>
            {renderWholeResumePaste()}
            {renderSaveActions()}
          </div>
        </>
      )}
    </section>
  );
}

export default ResumeBuilderForm;
