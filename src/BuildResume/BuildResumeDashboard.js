import React, { useState } from "react";

const API_URL = process.env.REACT_APP_API_URL || "";

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

  const getToken = () => localStorage.getItem("rta_token");

  const getAccountType = () => {
    return user?.accountType || user?.account_type || "user";
  };

  const resetApplicationInputs = () => {
    setRoleName("");
    setCompanyName("");
    setDescription("");
  };

  const handleBuildResume = async () => {
    if (!selectedProfile?.id) {
      alert("Please select a profile first.");
      return;
    }

    if (!roleName.trim() || !companyName.trim() || !description.trim()) {
      alert("Role name, company name, and job description are required.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/api/resume/build`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          roleName: roleName.trim(),
          companyName: companyName.trim(),
          jobDescription: description.trim(),
          profileId: selectedProfile.id,
        }),
      });

      const contentType = response.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Could not build resume.");
        }

        alert(result.message || "Resume built successfully.");
        resetApplicationInputs();
        return;
      }

      if (!response.ok) {
        throw new Error("Could not build resume.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const safeProfileName = (selectedProfile.name || "Profile")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "_");

      const safeCompanyName = companyName
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "_");

      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeProfileName}_${safeCompanyName}_Resume.pdf`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      resetApplicationInputs();
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="build-fast-page">
      <header className="fast-topbar">
        <div>
          <span className="fast-kicker">Build Resume</span>
          <h1>Generate resume from profile</h1>
        </div>

        <div className="fast-topbar-actions">
          <button type="button" className="ghost-action" onClick={onShowProfiles}>
            Profiles
          </button>

          <button type="button" className="account-pill">
            {selectedProfile?.name || user.name} · {getAccountType()}
          </button>

          <button type="button" className="logout-btn" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="build-fast-grid">
        <section className="fast-apply-card">
          <div className="fast-section-title">
            <div>
              <span>Step 1</span>
              <h2>Application Details</h2>
            </div>

            <button
              type="button"
              className="ghost-action compact"
              onClick={resetApplicationInputs}
              disabled={loading}
            >
              Clear
            </button>
          </div>

          <div className="resume-input-row">
            <div className="resume-input-group">
              <label htmlFor="roleName">Role</label>
              <input
                id="roleName"
                className="resume-text-input"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="AI/Machine Learning Engineer"
              />
            </div>

            <div className="resume-input-group">
              <label htmlFor="companyName">Company</label>
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

          <div className="fast-actions-row">
            <button
              type="button"
              className="generate-resume-btn"
              onClick={handleBuildResume}
              disabled={loading}
            >
              {loading ? "Building..." : "Build Resume"}
            </button>

            <button
              type="button"
              className="ghost-action"
              onClick={onShowProfiles}
              disabled={loading}
            >
              Change Profile
            </button>
          </div>
        </section>

        <aside className="build-profile-compact-card">
          <div className="fast-section-title">
            <div>
              <span>Selected</span>
              <h2>Profile</h2>
            </div>
          </div>

          {selectedProfile ? (
            <div className="build-profile-mini-grid">
              <div>
                <span>Name</span>
                <strong>{selectedProfile.name || "-"}</strong>
              </div>

              <div>
                <span>Location</span>
                <strong>{selectedProfile.location || "-"}</strong>
              </div>

              <div>
                <span>Phone</span>
                <strong>{selectedProfile.phone || "-"}</strong>
              </div>

              <div>
                <span>Email</span>
                <strong>{selectedProfile.email || "-"}</strong>
              </div>
            </div>
          ) : (
            <div className="empty-profile-box">
              No profile selected. Please select a profile first.
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

export default BuildResumeDashboard;