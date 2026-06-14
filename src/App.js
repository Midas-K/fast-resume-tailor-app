import React, { useState, useEffect } from "react";
import "./App.css";

import { ToastProvider } from "./UI/ToastProvider";
import AppShell from "./UI/AppShell";
import Icon from "./UI/Icon";
import IconButton from "./UI/IconButton";
import { fetchProfileById } from "./Profile/api/profileApi";

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

  useEffect(() => {
    if (!isUser || !selectedProfile?.id || showProfiles) {
      return;
    }

    let cancelled = false;

    fetchProfileById(selectedProfile.id)
      .then((fullProfile) => {
        if (cancelled || !fullProfile) {
          return;
        }

        setSelectedProfile(fullProfile);
        localStorage.setItem("rta_selected_profile", JSON.stringify(fullProfile));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isUser, selectedProfile?.id, showProfiles, jobBidStyle]);

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

  const profileReady = Boolean(selectedProfile);
  const jdReady = Boolean(description.trim());

  return (
    <AppShell
      compact
      kicker="Fast Apply"
      title="Apply faster"
      subtitle="Paste the job description, copy your AI prompt, and generate a tailored resume in one workspace."
      user={currentUser}
      selectedProfile={selectedProfile}
      onLogout={handleLogout}
      onShowProfiles={() => setShowProfiles(true)}
    >
      <div className="fast-apply-workspace fast-apply-workspace--fit">
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
              onClick={clearApplicationInputs}
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
                placeholder="AI/ML Engineer"
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

          <div className="resume-input-group resume-input-group--grow">
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
            <PromptGenerator
              jobDescription={description}
              roleName={roleName}
              companyName={companyName}
              selectedProfile={selectedProfile}
            />

            <div className="fast-readiness">
              <span className={`readiness-chip ${profileReady ? "ready" : "missing"}`}>
                <Icon name={profileReady ? "checkCircle" : "info"} size={13} />
                {profileReady ? "Profile ready" : "Profile missing"}
              </span>
              <span className={`readiness-chip ${jdReady ? "ready" : "missing"}`}>
                <Icon name={jdReady ? "checkCircle" : "info"} size={13} />
                {jdReady ? "JD ready" : "JD missing"}
              </span>
            </div>
          </div>
        </section>

        <section className="fast-resume-panel">
          <ResumeBuilderForm
            compact
            appliedRole={roleName}
            appliedCompany={companyName}
            selectedProfile={selectedProfile}
          />
        </section>
      </div>
    </AppShell>
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
