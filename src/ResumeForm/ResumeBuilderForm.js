import React, { useEffect, useState } from "react";
import Icon from "../UI/Icon";
import IconButton from "../UI/IconButton";
import { API_URL, getToken } from "../shared/api/client";
import { parseJsonField } from "../shared/utils/format";
import {
  canUseFolderPicker,
  pickCustomerRootFolder,
  saveResumeToCustomerFolder,
} from "../services/fileSystemSaveService";

function ResumeBuilderForm({ appliedRole, appliedCompany, selectedProfile }) {
  const [summary, setSummary] = useState("");
  const [skills, setSkills] = useState("");
  const [certification, setCertification] = useState("");
  const [experienceInputs, setExperienceInputs] = useState([]);
  const [loading, setLoading] = useState(false);

  const selectedEducation = parseJsonField(selectedProfile?.education);
  const selectedExperience = parseJsonField(selectedProfile?.experience);

  useEffect(() => {
    if (!selectedProfile) {
      setExperienceInputs([]);
      return;
    }

    const profileExperience = parseJsonField(selectedProfile.experience);

    const mappedExperience = profileExperience.map((item, index) => ({
      id: index,
      companyName: item.companyName || "",
      title: item.title || "",
      timeline: item.timeline || "",
      location: item.location || selectedProfile.location || "",
      details: "",
    }));

    setExperienceInputs(mappedExperience);
  }, [selectedProfile]);

  const updateExperienceDetails = (index, value) => {
    const updated = [...experienceInputs];
    updated[index].details = value;
    setExperienceInputs(updated);
  };

  const clearResumeInputs = () => {
    setSummary("");
    setSkills("");
    setCertification("");
    setExperienceInputs((previous) =>
      previous.map((item) => ({
        ...item,
        details: "",
      }))
    );
  };

  const saveApplicationAfterResumeSaved = async () => {
    const token = getToken();

    if (!token) {
      throw new Error("Please login again.");
    }

    const response = await fetch(`${API_URL}/api/applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        roleName: appliedRole.trim(),
        companyName: appliedCompany.trim(),
        profileId: selectedProfile?.id,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Could not save application.");
    }

    return result;
  };

  const validateRequiredFields = () => {
    if (!selectedProfile) {
      alert("Please select a job-bid profile first.");
      return false;
    }

    if (
      !String(appliedRole || "").trim() ||
      !String(appliedCompany || "").trim()
    ) {
      alert("Please enter role name and company name first.");
      return false;
    }

    if (!summary.trim()) {
      alert("Summary is required.");
      return false;
    }

    if (!skills.trim()) {
      alert("Skills are required.");
      return false;
    }

    if (experienceInputs.length === 0) {
      alert("At least one profile experience is required.");
      return false;
    }

    const missingExperience = experienceInputs.some(
      (item) => !item.details.trim()
    );

    if (missingExperience) {
      alert(
        "Experience details are required for every company in the selected profile."
      );
      return false;
    }

    if (!certification.trim()) {
      alert("Certifications are required.");
      return false;
    }

    return true;
  };

  const generateResumePdf = async () => {
    if (!validateRequiredFields()) {
      return;
    }

    const token = getToken();

    if (!token) {
      alert("Please login again.");
      return;
    }

    let rootDirectoryHandle = null;

    try {
      setLoading(true);

      /*
        IMPORTANT:
        Folder picker must open immediately from the user's button click.
        If we wait until after fetch/blob, Chrome blocks it with:
        "Must be handling a user gesture to show a file picker."
      */
      if (canUseFolderPicker()) {
        rootDirectoryHandle = await pickCustomerRootFolder();
      }

      const response = await fetch(`${API_URL}/api/build-resume/from-template`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          profileId: selectedProfile.id,
          roleName: appliedRole.trim(),
          companyName: appliedCompany.trim(),
          summary: summary.trim(),
          skills: skills.trim(),
          certification: certification.trim(),
          experienceInputs: experienceInputs.map((item) => ({
            ...item,
            companyName: item.companyName || "",
            title: item.title || "",
            timeline: item.timeline || "",
            location: item.location || selectedProfile.location || "",
            details: item.details.trim(),
          })),
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.message || "Could not generate resume PDF.");
      }

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const pdfBytes = new Uint8Array(arrayBuffer);

      const saveResult = await saveResumeToCustomerFolder({
        pdfBytes,
        profileName: selectedProfile?.name || "Profile",
        companyName: appliedCompany?.trim() || "Unknown Company",
        roleName: appliedRole?.trim() || "Unknown Role",
        rootDirectoryHandle,
      });

      await saveApplicationAfterResumeSaved();

      clearResumeInputs();

      alert(
        `Resume saved!\n${saveResult.dateFolder}/${
          saveResult.companyRoleFolder || saveResult.companyFolder
        }/${saveResult.fileName}`
      );
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

  return (
    <section className="card resume-form-card">
      <div className="resume-form-header">
        <div className="form-icon">
          <Icon name="fileText" size={20} />
        </div>

        <div>
          <h2>Resume Builder</h2>
          <p>
            The assigned admin DOCX template is filled, converted to PDF, and
            saved to your selected customer folder.
          </p>
        </div>
      </div>

      {selectedProfile && (
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

      <div className="resume-input-group">
        <label htmlFor="summary">Summary *</label>
        <textarea
          id="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Required. Paste summary here. Use **bold text** or *italic text* if needed."
        />
      </div>

      <div className="resume-input-group">
        <label htmlFor="skills">Skills *</label>
        <textarea
          id="skills"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          placeholder={`Required. Example:
LLMOps & Model Operations: Model versioning, experiment tracking, CI/CD for ML
AI Governance & Compliance: FISMA, NIST 800-53, model explainability
Natural Language Processing: Text classification, NER, summarization`}
        />
      </div>

      <div className="experience-area">
        <div className="experience-title-row">
          <h3>Experience Details *</h3>
        </div>

        {experienceInputs.length === 0 && (
          <div className="empty-profile-box">
            No company experience found in selected profile.
          </div>
        )}

        {experienceInputs.map((experience, index) => (
          <div className="experience-box" key={experience.id}>
            <div className="experience-box-header">
              <label>
                {experience.companyName || "Company Name"} -{" "}
                {experience.title || "Title"} *
              </label>
            </div>

            <p className="profile-experience-timeline">
              {[experience.location, experience.timeline]
                .filter((value) => value && String(value).trim())
                .join(" | ") || "Timeline"}
            </p>

            <textarea
              value={experience.details}
              onChange={(e) => updateExperienceDetails(index, e.target.value)}
              placeholder={`Required. Paste experience bullets for ${
                experience.companyName || "this company"
              }. Lines can start with "-" or no bullet.`}
            />
          </div>
        ))}
      </div>

      <div className="resume-input-group">
        <label htmlFor="certification">Certifications *</label>
        <textarea
          id="certification"
          value={certification}
          onChange={(e) => setCertification(e.target.value)}
          placeholder="Required. Example: AWS Certified Machine Learning - Specialty"
        />
      </div>

      <div className="profile-actions">
        <IconButton
          icon="fileDown"
          label={loading ? "Generating resume..." : "Save PDF resume"}
          variant="primary"
          size="lg"
          loading={loading}
          disabled={loading}
          onClick={generateResumePdf}
        />
      </div>
    </section>
  );
}

export default ResumeBuilderForm;