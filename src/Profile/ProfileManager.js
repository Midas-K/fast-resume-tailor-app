import React, { useEffect, useState } from "react";

const API_URL = process.env.REACT_APP_API_URL || "";

function ProfileManager({ user, onLogout, onProfileSelected }) {
  const [profiles, setProfiles] = useState([]);
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [profileApplicationCounts, setProfileApplicationCounts] = useState({});

  const [applicationViewMode, setApplicationViewMode] = useState("profiles");
  const [selectedApplicationProfile, setSelectedApplicationProfile] =
    useState(null);
  const [selectedApplicationRows, setSelectedApplicationRows] = useState([]);
  const [selectedApplicationDate, setSelectedApplicationDate] = useState(null);
  const [selectedCountMode, setSelectedCountMode] = useState("total");

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(user?.email || "");

  const [education, setEducation] = useState([
    {
      school: "",
      degree: "",
      timeline: "",
    },
  ]);

  const [experience, setExperience] = useState([
    {
      companyName: "",
      title: "",
      timeline: "",
    },
  ]);

  const getToken = () => localStorage.getItem("rta_token");

  const getAccountType = () => {
    return user?.accountType || user?.account_type || "user";
  };

  const getProfileCount = (profileId) => {
    return (
      profileApplicationCounts[String(profileId)] || {
        whole_application_count: 0,
        most_recent_application_count: 0,
      }
    );
  };

  const parseJsonField = (value) => {
    if (!value) return [];

    if (Array.isArray(value)) {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      return [];
    }
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

  const loadProfiles = async () => {
    try {
      const response = await fetch(`${API_URL}/api/profiles`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Could not load profiles.");
      }

      setProfiles(result.profiles || []);
    } catch (error) {
      alert(error.message);
    }
  };

  const loadProfileApplicationCounts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/applications/profile-counts`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Could not load application counts.");
      }

      const countMap = {};

      (result.counts || []).forEach((item) => {
        countMap[String(item.profile_id)] = {
          whole_application_count: item.whole_application_count || 0,
          most_recent_application_count:
            item.most_recent_application_count || 0,
        };
      });

      setProfileApplicationCounts(countMap);
    } catch (error) {
      console.error(error.message);
    }
  };

  const refreshProfileData = async () => {
    await loadProfiles();
    await loadProfileApplicationCounts();
  };

  useEffect(() => {
    refreshProfileData();
  }, []);

  const getApplicationDateGroups = (rows) => {
    const groups = {};

    rows.forEach((row) => {
      const dateKey = formatDateOnly(row.created_at);

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

  const openProfileApplicationDashboard = async (profile, mode) => {
    try {
      const response = await fetch(
        `${API_URL}/api/applications/profile/${profile.id}`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Could not load applications.");
      }

      const allRows = result.applications || [];

      if (allRows.length === 0) {
        alert("No applications found for this profile.");
        return;
      }

      if (mode === "recent") {
        const latestDate = formatDateOnly(allRows[0].created_at);

        const recentRows = allRows.filter(
          (row) => formatDateOnly(row.created_at) === latestDate
        );

        setSelectedApplicationProfile(profile);
        setSelectedApplicationRows(recentRows);
        setSelectedApplicationDate(latestDate);
        setSelectedCountMode(mode);
        setApplicationViewMode("list");
        return;
      }

      setSelectedApplicationProfile(profile);
      setSelectedApplicationRows(allRows);
      setSelectedApplicationDate(null);
      setSelectedCountMode(mode);
      setApplicationViewMode("dates");
    } catch (error) {
      alert(error.message);
    }
  };

  const openDateApplicationList = (date) => {
    setSelectedApplicationDate(date);
    setApplicationViewMode("list");
  };

  const backToApplicationDates = () => {
    if (selectedCountMode === "recent") {
      backToProfilesDashboard();
      return;
    }

    setSelectedApplicationDate(null);
    setApplicationViewMode("dates");
  };

  const backToProfilesDashboard = () => {
    setSelectedApplicationProfile(null);
    setSelectedApplicationRows([]);
    setSelectedApplicationDate(null);
    setSelectedCountMode("total");
    setApplicationViewMode("profiles");
  };

  const applicationDateGroups = getApplicationDateGroups(
    selectedApplicationRows
  );

  const selectedDateRows = selectedApplicationDate
    ? applicationDateGroups.find(
        (group) => group.date === selectedApplicationDate
      )?.rows || []
    : [];

  const isEducationComplete = (item) => {
    return (
      item.school.trim() &&
      item.degree.trim() &&
      item.timeline.trim()
    );
  };

  const isExperienceComplete = (item) => {
    return (
      item.companyName.trim() &&
      item.title.trim() &&
      item.timeline.trim()
    );
  };

  const validateProfileForm = () => {
    const missingFields = [];

    if (!name.trim()) missingFields.push("Name");
    if (!location.trim()) missingFields.push("Location");
    if (!phone.trim()) missingFields.push("Phone Number");
    if (!email.trim()) missingFields.push("Email");

    education.forEach((item, index) => {
      const itemNumber = index + 1;

      if (!item.school.trim()) {
        missingFields.push(`Education ${itemNumber}: School`);
      }

      if (!item.degree.trim()) {
        missingFields.push(`Education ${itemNumber}: Degree`);
      }

      if (!item.timeline.trim()) {
        missingFields.push(`Education ${itemNumber}: Timeline`);
      }
    });

    experience.forEach((item, index) => {
      const itemNumber = index + 1;

      if (!item.companyName.trim()) {
        missingFields.push(`Experience ${itemNumber}: Company Name`);
      }

      if (!item.title.trim()) {
        missingFields.push(`Experience ${itemNumber}: Title`);
      }

      if (!item.timeline.trim()) {
        missingFields.push(`Experience ${itemNumber}: Timeline`);
      }
    });

    if (missingFields.length > 0) {
      alert(
        `Please complete all required fields before saving profile:\n\n${missingFields
          .map((field) => `- ${field}`)
          .join("\n")}`
      );

      return false;
    }

    return true;
  };

  const addEducation = () => {
    const incompleteIndex = education.findIndex(
      (item) => !isEducationComplete(item)
    );

    if (incompleteIndex !== -1) {
      alert(
        `Please complete Education ${incompleteIndex + 1} before adding another education item.`
      );
      return;
    }

    setEducation([
      ...education,
      {
        school: "",
        degree: "",
        timeline: "",
      },
    ]);
  };

  const removeEducation = (indexToRemove) => {
    if (education.length === 1) {
      alert("At least one education item is required.");
      return;
    }

    setEducation(education.filter((_, index) => index !== indexToRemove));
  };

  const updateEducation = (index, field, value) => {
    const updated = [...education];
    updated[index][field] = value;
    setEducation(updated);
  };

  const addExperience = () => {
    const incompleteIndex = experience.findIndex(
      (item) => !isExperienceComplete(item)
    );

    if (incompleteIndex !== -1) {
      alert(
        `Please complete Experience ${incompleteIndex + 1} before adding another experience item.`
      );
      return;
    }

    setExperience([
      ...experience,
      {
        companyName: "",
        title: "",
        timeline: "",
      },
    ]);
  };

  const removeExperience = (indexToRemove) => {
    if (experience.length === 1) {
      alert("At least one experience item is required.");
      return;
    }

    setExperience(experience.filter((_, index) => index !== indexToRemove));
  };

  const updateExperience = (index, field, value) => {
    const updated = [...experience];
    updated[index][field] = value;
    setExperience(updated);
  };

  const resetForm = () => {
    setEditingProfileId(null);
    setName("");
    setLocation("");
    setPhone("");
    setEmail(user?.email || "");
    setEducation([
      {
        school: "",
        degree: "",
        timeline: "",
      },
    ]);
    setExperience([
      {
        companyName: "",
        title: "",
        timeline: "",
      },
    ]);
  };

  const startEditProfile = (profile) => {
    setEditingProfileId(profile.id);
    setName(profile.name || "");
    setLocation(profile.location || "");
    setPhone(profile.phone || "");
    setEmail(profile.email || "");

    const parsedEducation = parseJsonField(profile.education);
    const parsedExperience = parseJsonField(profile.experience);

    setEducation(
      parsedEducation.length > 0
        ? parsedEducation.map((item) => ({
            school: item.school || "",
            degree: item.degree || "",
            timeline: item.timeline || "",
          }))
        : [
            {
              school: "",
              degree: "",
              timeline: "",
            },
          ]
    );

    setExperience(
      parsedExperience.length > 0
        ? parsedExperience.map((item) => ({
            companyName: item.companyName || "",
            title: item.title || "",
            timeline: item.timeline || "",
          }))
        : [
            {
              companyName: "",
              title: "",
              timeline: "",
            },
          ]
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const saveProfile = async () => {
    if (!validateProfileForm()) {
      return;
    }

    const isEditing = Boolean(editingProfileId);

    const cleanEducation = education.map((item) => ({
      school: item.school.trim(),
      degree: item.degree.trim(),
      timeline: item.timeline.trim(),
    }));

    const cleanExperience = experience.map((item) => ({
      companyName: item.companyName.trim(),
      title: item.title.trim(),
      timeline: item.timeline.trim(),
    }));

    try {
      const response = await fetch(
        isEditing
          ? `${API_URL}/api/profiles/${editingProfileId}`
          : `${API_URL}/api/profiles`,
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            name: name.trim(),
            location: location.trim(),
            phone: phone.trim(),
            email: email.trim(),
            education: cleanEducation,
            experience: cleanExperience,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
            (isEditing
              ? "Could not update profile."
              : "Could not create profile.")
        );
      }

      alert(
        isEditing
          ? "Profile updated!"
          : "Profile created! You can now go to the resume builder."
      );

      resetForm();
      await refreshProfileData();
    } catch (error) {
      alert(error.message);
    }
  };

  const removeProfile = async (profileId) => {
    const confirmed = window.confirm("Remove this profile?");

    if (!confirmed) return;

    try {
      const response = await fetch(`${API_URL}/api/profiles/${profileId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Could not remove profile.");
      }

      if (editingProfileId === profileId) {
        resetForm();
      }

      alert("Profile removed.");
      await refreshProfileData();
    } catch (error) {
      alert(error.message);
    }
  };

  if (applicationViewMode === "dates" && selectedApplicationProfile) {
    return (
      <div className="rta-app">
        <header className="rta-header">
          <div>
            <h1>Applications for {selectedApplicationProfile.name}</h1>
            <p>
              {selectedCountMode === "recent"
                ? "Most recent application list."
                : "Total applications grouped by date."}
            </p>
          </div>

          <div className="header-actions">
            <button className="user-btn">
              {user.name} · {getAccountType()}
            </button>

            <button className="logout-btn" onClick={onLogout}>
              Sign out
            </button>
          </div>
        </header>

        <main className="profile-dashboard single-profile-dashboard">
          <section className="card profile-card wide-profile-card">
            <div className="profile-card-header">
              <div>
                <h2>Select Date</h2>
                <p>Click one date row to view application details.</p>
              </div>

              <button
                type="button"
                className="refresh-btn"
                onClick={backToProfilesDashboard}
              >
                Back to Profiles
              </button>
            </div>

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
                  {applicationDateGroups.map((group, index) => (
                    <tr
                      key={group.date}
                      className="clickable-user-row"
                      onClick={() => openDateApplicationList(group.date)}
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
                  ))}

                  {applicationDateGroups.length === 0 && (
                    <tr>
                      <td colSpan="3">No applications found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (
    applicationViewMode === "list" &&
    selectedApplicationProfile &&
    selectedApplicationDate
  ) {
    return (
      <div className="rta-app">
        <header className="rta-header">
          <div>
            <h1>Applications for {selectedApplicationProfile.name}</h1>
            <p>{selectedApplicationDate} application list.</p>
          </div>

          <div className="header-actions">
            <button className="user-btn">
              {user.name} · {getAccountType()}
            </button>

            <button className="logout-btn" onClick={onLogout}>
              Sign out
            </button>
          </div>
        </header>

        <main className="profile-dashboard single-profile-dashboard">
          <section className="card profile-card wide-profile-card">
            <div className="profile-card-header">
              <div>
                <h2>{selectedApplicationDate}</h2>
                <p>Company and role applications for this date.</p>
              </div>

              <button
                type="button"
                className="refresh-btn"
                onClick={backToApplicationDates}
              >
                {selectedCountMode === "recent"
                  ? "Back to Profiles"
                  : "Back to Dates"}
              </button>
            </div>

            <div className="admin-table-wrap modern">
              <table className="admin-table modern">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Company Name</th>
                    <th>Role Name</th>
                    <th>Date - Time</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedDateRows.map((row, index) => (
                    <tr key={row.id}>
                      <td>
                        <span className="status-badge approved">
                          {index + 1}
                        </span>
                      </td>

                      <td>{row.company_name}</td>
                      <td>{row.role_name}</td>
                      <td>{formatDateTime(row.created_at)}</td>
                      <td>
                        <span className="status-badge approved">Applied</span>
                      </td>
                    </tr>
                  ))}

                  {selectedDateRows.length === 0 && (
                    <tr>
                      <td colSpan="5">No applications found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="rta-app">
      <header className="rta-header">
        <div>
          <h1>{editingProfileId ? "Edit Profile" : "Create Profile"}</h1>
          <p>
            All profile fields are required before you can save and use a
            job-bid profile.
          </p>
        </div>

        <div className="header-actions">
          <button className="user-btn">
            {user.name} · {getAccountType()}
          </button>

          <button className="logout-btn" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="profile-dashboard">
        <section className="card profile-card">
          <div className="profile-card-header">
            <div>
              <h2>
                {editingProfileId ? "Edit Job-Bid Profile" : "Personal Info"}
              </h2>
              <p>
                {editingProfileId
                  ? "Update this job-bid profile."
                  : "Create a candidate profile for job bidding."}
              </p>
            </div>
          </div>

          <div className="resume-input-group">
            <label>Name *</label>
            <input
              className="resume-text-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rahul Gupta"
            />
          </div>

          <div className="resume-input-group">
            <label>Location *</label>
            <input
              className="resume-text-input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="San Francisco, CA"
            />
          </div>

          <div className="resume-input-row">
            <div className="resume-input-group">
              <label>Phone Number *</label>
              <input
                className="resume-text-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(123) 456-7890"
              />
            </div>

            <div className="resume-input-group">
              <label>Email *</label>
              <input
                className="resume-text-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rahul@email.com"
              />
            </div>
          </div>

          <div className="profile-section-block">
            <div className="experience-title-row">
              <h3>Education *</h3>
            </div>

            {education.map((item, index) => (
              <div className="experience-box" key={index}>
                <div className="experience-box-header">
                  <label>Education {index + 1}</label>

                  <button
                    type="button"
                    className="remove-experience-btn"
                    onClick={() => removeEducation(index)}
                  >
                    Remove
                  </button>
                </div>

                <div className="resume-input-group">
                  <label>School *</label>
                  <input
                    className="resume-text-input"
                    value={item.school}
                    onChange={(e) =>
                      updateEducation(index, "school", e.target.value)
                    }
                    placeholder="Stanford University"
                  />
                </div>

                <div className="resume-input-group">
                  <label>Degree *</label>
                  <input
                    className="resume-text-input"
                    value={item.degree}
                    onChange={(e) =>
                      updateEducation(index, "degree", e.target.value)
                    }
                    placeholder="B.Sc. Computer Science"
                  />
                </div>

                <div className="resume-input-group">
                  <label>Timeline *</label>
                  <input
                    className="resume-text-input"
                    value={item.timeline}
                    onChange={(e) =>
                      updateEducation(index, "timeline", e.target.value)
                    }
                    placeholder="2010 - 2014"
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              className="add-experience-btn add-experience-bottom-btn"
              onClick={addEducation}
            >
              Add Education
            </button>
          </div>

          <div className="profile-section-block">
            <div className="experience-title-row">
              <h3>Experience *</h3>
            </div>

            {experience.map((item, index) => (
              <div className="experience-box" key={index}>
                <div className="experience-box-header">
                  <label>Experience {index + 1}</label>

                  <button
                    type="button"
                    className="remove-experience-btn"
                    onClick={() => removeExperience(index)}
                  >
                    Remove
                  </button>
                </div>

                <div className="resume-input-group">
                  <label>Company Name *</label>
                  <input
                    className="resume-text-input"
                    value={item.companyName}
                    onChange={(e) =>
                      updateExperience(index, "companyName", e.target.value)
                    }
                    placeholder="Meta"
                  />
                </div>

                <div className="resume-input-group">
                  <label>Title *</label>
                  <input
                    className="resume-text-input"
                    value={item.title}
                    onChange={(e) =>
                      updateExperience(index, "title", e.target.value)
                    }
                    placeholder="Staff AI/ML Engineer"
                  />
                </div>

                <div className="resume-input-group">
                  <label>Timeline *</label>
                  <input
                    className="resume-text-input"
                    value={item.timeline}
                    onChange={(e) =>
                      updateExperience(index, "timeline", e.target.value)
                    }
                    placeholder="Oct 2023 - Present"
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              className="add-experience-btn add-experience-bottom-btn"
              onClick={addExperience}
            >
              Add Experience
            </button>
          </div>

          <div className="profile-actions">
            <button
              type="button"
              className="generate-resume-btn"
              onClick={saveProfile}
            >
              {editingProfileId ? "Update Profile" : "Create Profile"}
            </button>

            {editingProfileId && (
              <button type="button" className="block-btn" onClick={resetForm}>
                Cancel Edit
              </button>
            )}
          </div>
        </section>

        <section className="card profile-card">
          <div className="profile-card-header">
            <div>
              <h2>Job-Bid Profiles</h2>
              <p>Select one profile to enter Resume Builder.</p>
            </div>
          </div>

          {profiles.length === 0 && (
            <div className="empty-profile-box">
              No profile yet. Create one first.
            </div>
          )}

          {profiles.map((profile) => {
            const counts = getProfileCount(profile.id);

            return (
              <div className="profile-list-item" key={profile.id}>
                <div className="profile-list-content">
                  <h3>{profile.name}</h3>
                  <p>{profile.location || "No location added"}</p>
                  <p>{profile.email}</p>

                  <div className="profile-application-counts">
                    <button
                      type="button"
                      className="profile-count-card"
                      onClick={() =>
                        openProfileApplicationDashboard(profile, "total")
                      }
                    >
                      <strong>{counts.whole_application_count}</strong>
                      <span>Total Applications</span>
                    </button>

                    <button
                      type="button"
                      className="profile-count-card"
                      onClick={() =>
                        openProfileApplicationDashboard(profile, "recent")
                      }
                    >
                      <strong>{counts.most_recent_application_count}</strong>
                      <span>Most Recent Date</span>
                    </button>
                  </div>
                </div>

                <div className="profile-actions">
                  <button
                    type="button"
                    className="approve-btn"
                    onClick={() => onProfileSelected(profile)}
                  >
                    Use Profile
                  </button>

                  <button
                    type="button"
                    className="refresh-btn"
                    onClick={() => startEditProfile(profile)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="block-btn"
                    onClick={() => removeProfile(profile.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}

export default ProfileManager;