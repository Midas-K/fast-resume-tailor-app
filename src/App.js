import React, { useState } from "react";
import "./App.css";

import { ToastProvider } from "./UI/ToastProvider";

import AuthPanel from "./Auth/AuthPanel";
import AdminDashboard from "./Admin/AdminDashboard";
import ProfileManager from "./Profile/ProfileManager";
import PromptGenerator from "./Prompt/PromptGenerator";
import ResumeBuilderForm from "./ResumeForm/ResumeBuilderForm";
import BuildResumeDashboard from "./BuildResume/BuildResumeDashboard";

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("rta_current_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [selectedProfile, setSelectedProfile] = useState(() => {
    const savedProfile = localStorage.getItem("rta_selected_profile");
    return savedProfile ? JSON.parse(savedProfile) : null;
  });

  const [showProfiles, setShowProfiles] = useState(false);

  const [roleName, setRoleName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");

  const normalizeUser = (rawUser) => {
    if (!rawUser) return null;

    const accountType = rawUser.accountType || rawUser.account_type || "user";
    const jobBidStyle =
      rawUser.jobBidStyle || rawUser.job_bid_style || "copy_generate";

    return {
      ...rawUser,
      accountType,
      account_type: accountType,
      jobBidStyle,
      job_bid_style: jobBidStyle,
    };
  };

  const currentUser = normalizeUser(user);

  const isAdmin =
    currentUser?.accountType === "admin" ||
    currentUser?.account_type === "admin";

  const isUser =
    currentUser?.accountType === "user" ||
    currentUser?.account_type === "user";

  const jobBidStyle = currentUser?.jobBidStyle || "copy_generate";

  const handleLogin = (loggedInUser) => {
    const normalizedUser = normalizeUser(loggedInUser);

    localStorage.setItem("rta_current_user", JSON.stringify(normalizedUser));
    setUser(normalizedUser);
  };

  const handleLogout = () => {
    localStorage.removeItem("rta_token");
    localStorage.removeItem("rta_current_user");
    localStorage.removeItem("rta_selected_profile");
    localStorage.removeItem("rta_job_bid_style");

    setUser(null);
    setSelectedProfile(null);
    setShowProfiles(false);

    setRoleName("");
    setCompanyName("");
    setDescription("");
  };

  const handleProfileSelected = (profile) => {
    localStorage.setItem("rta_selected_profile", JSON.stringify(profile));
    setSelectedProfile(profile);
    setShowProfiles(false);
  };

  const clearApplicationInputs = () => {
    setRoleName("");
    setCompanyName("");
    setDescription("");
  };

  if (!currentUser) {
    return <AuthPanel onLogin={handleLogin} />;
  }

  if (isAdmin) {
    return <AdminDashboard user={currentUser} onLogout={handleLogout} />;
  }

  if (isUser && (!selectedProfile || showProfiles)) {
    return (
      <ProfileManager
        user={currentUser}
        onLogout={handleLogout}
        onProfileSelected={handleProfileSelected}
      />
    );
  }

  if (isUser && jobBidStyle === "build_resume") {
    return (
      <BuildResumeDashboard
        user={currentUser}
        selectedProfile={selectedProfile}
        onLogout={handleLogout}
        onShowProfiles={() => setShowProfiles(true)}
      />
    );
  }

  return (
    <div className="fast-page">
      <header className="fast-topbar">
        <div>
          <span className="fast-kicker">FRT Fast Apply</span>
          <h1>Apply faster</h1>
        </div>

        <div className="fast-topbar-actions">
          <button
            type="button"
            className="ghost-action"
            onClick={() => setShowProfiles(true)}
          >
            Profiles
          </button>

          <button type="button" className="account-pill">
            {selectedProfile?.name || currentUser.name}
          </button>

          <button type="button" className="logout-btn" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="fast-one-screen">
        <section className="fast-apply-card">
          <div className="fast-section-title">
            <div>
              <span>Step 1</span>
              <h2>Application Details</h2>
            </div>

            <button
              type="button"
              className="ghost-action compact"
              onClick={clearApplicationInputs}
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
                placeholder="AI/ML Engineer"
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

          <div className="fast-profile-strip">
            <div className="fast-profile-avatar">
              {(selectedProfile?.name || "P").slice(0, 1).toUpperCase()}
            </div>

            <div>
              <span>Profile</span>
              <strong>{selectedProfile?.name || "No profile selected"}</strong>
              <p>{selectedProfile?.email || "Choose a profile first."}</p>
            </div>

            <button
              type="button"
              className="ghost-action compact"
              onClick={() => setShowProfiles(true)}
            >
              Change
            </button>
          </div>

          <div className="fast-actions-row">
            <PromptGenerator
              jobDescription={description}
              roleName={roleName}
              companyName={companyName}
              selectedProfile={selectedProfile}
            />

            <div className="fast-readiness">
              <span className={selectedProfile ? "ready" : "missing"}>
                {selectedProfile ? "Profile ready" : "Profile missing"}
              </span>
              <span className={description.trim() ? "ready" : "missing"}>
                {description.trim() ? "JD ready" : "JD missing"}
              </span>
            </div>
          </div>
        </section>

        <section className="fast-resume-panel">
          <ResumeBuilderForm
            appliedRole={roleName}
            appliedCompany={companyName}
            selectedProfile={selectedProfile}
          />
        </section>
      </main>
    </div>
  );
}

function AppWithToast() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}

export default AppWithToast;