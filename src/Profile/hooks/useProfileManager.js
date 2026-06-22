import { useEffect, useState } from "react";
import { formatDateOnly, parseJsonField } from "../../shared/utils/format";
import {
  deleteProfile,
  fetchProfileApplicationCounts,
  fetchProfileApplications,
  fetchProfileById,
  fetchProfiles,
  saveProfile as saveProfileApi,
} from "../api/profileApi";

const EMPTY_EDUCATION = { school: "", degree: "", timeline: "" };
const EMPTY_EXPERIENCE = { companyName: "", title: "", timeline: "" };

export function useProfileManager(user) {
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
  const [education, setEducation] = useState([{ ...EMPTY_EDUCATION }]);
  const [experience, setExperience] = useState([{ ...EMPTY_EXPERIENCE }]);

  const getProfileCount = (profileId) =>
    profileApplicationCounts[String(profileId)] || {
      whole_application_count: 0,
      most_recent_application_count: 0,
    };

  const getApplicationDateGroups = (rows) => {
    const groups = {};

    rows.forEach((row) => {
      const dateKey = formatDateOnly(row.created_at);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(row);
    });

    return Object.entries(groups).map(([date, dateRows]) => ({
      date,
      rows: dateRows,
    }));
  };

  const refreshProfileCounts = async () => {
    try {
      const counts = await fetchProfileApplicationCounts();
      const countMap = {};

      counts.forEach((item) => {
        countMap[String(item.profile_id)] = {
          whole_application_count: item.whole_application_count || 0,
          most_recent_application_count:
            item.most_recent_application_count || 0,
        };
      });

      setProfileApplicationCounts(countMap);
    } catch (error) {
      console.error("Profile count refresh failed:", error.message);
    }
  };

  const refreshProfileData = async () => {
    try {
      const [nextProfiles, counts] = await Promise.all([
        fetchProfiles(),
        fetchProfileApplicationCounts(),
      ]);

      setProfiles(nextProfiles);

      const countMap = {};
      counts.forEach((item) => {
        countMap[String(item.profile_id)] = {
          whole_application_count: item.whole_application_count || 0,
          most_recent_application_count:
            item.most_recent_application_count || 0,
        };
      });

      setProfileApplicationCounts(countMap);
    } catch (error) {
      alert(error.message);
    }
  };

  useEffect(() => {
    refreshProfileData();
  }, []);

  const openProfileApplicationDashboard = async (profile, mode) => {
    try {
      const allRows = await fetchProfileApplications(profile.id);

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

  const isEducationComplete = (item) =>
    item.school.trim() && item.degree.trim() && item.timeline.trim();

  const isExperienceComplete = (item) =>
    item.companyName.trim() && item.title.trim() && item.timeline.trim();

  const validateProfileForm = () => {
    const missingFields = [];

    if (!name.trim()) missingFields.push("Name");
    if (!location.trim()) missingFields.push("Location");
    if (!phone.trim()) missingFields.push("Phone Number");
    if (!email.trim()) missingFields.push("Email");

    education.forEach((item, index) => {
      const itemNumber = index + 1;
      if (!item.school.trim())
        missingFields.push(`Education ${itemNumber}: School`);
      if (!item.degree.trim())
        missingFields.push(`Education ${itemNumber}: Degree`);
      if (!item.timeline.trim())
        missingFields.push(`Education ${itemNumber}: Timeline`);
    });

    experience.forEach((item, index) => {
      const itemNumber = index + 1;
      if (!item.companyName.trim())
        missingFields.push(`Experience ${itemNumber}: Company Name`);
      if (!item.title.trim())
        missingFields.push(`Experience ${itemNumber}: Title`);
      if (!item.timeline.trim())
        missingFields.push(`Experience ${itemNumber}: Timeline`);
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

    setEducation([...education, { ...EMPTY_EDUCATION }]);
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

    setExperience([...experience, { ...EMPTY_EXPERIENCE }]);
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
    setEducation([{ ...EMPTY_EDUCATION }]);
    setExperience([{ ...EMPTY_EXPERIENCE }]);
  };

  const startEditProfile = async (profile) => {
    try {
      const fullProfile = await fetchProfileById(profile.id);

      setEditingProfileId(fullProfile.id);
      setName(fullProfile.name || "");
      setLocation(fullProfile.location || "");
      setPhone(fullProfile.phone || "");
      setEmail(fullProfile.email || "");

      const parsedEducation = parseJsonField(fullProfile.education);
      const parsedExperience = parseJsonField(fullProfile.experience);

      setEducation(
        parsedEducation.length > 0
          ? parsedEducation.map((item) => ({
              school: item.school || "",
              degree: item.degree || "",
              timeline: item.timeline || "",
            }))
          : [{ ...EMPTY_EDUCATION }]
      );

      setExperience(
        parsedExperience.length > 0
          ? parsedExperience.map((item) => ({
              companyName: item.companyName || "",
              title: item.title || "",
              timeline: item.timeline || "",
            }))
          : [{ ...EMPTY_EXPERIENCE }]
      );

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      alert(error.message);
    }
  };

  const selectProfileForUse = async (profile) => {
    return fetchProfileById(profile.id);
  };

  const handleSaveProfile = async () => {
    if (!validateProfileForm()) return;

    const isEditing = Boolean(editingProfileId);

    try {
      const result = await saveProfileApi({
        editingProfileId,
        payload: {
          name: name.trim(),
          location: location.trim(),
          phone: phone.trim(),
          email: email.trim(),
          education: education.map((item) => ({
            school: item.school.trim(),
            degree: item.degree.trim(),
            timeline: item.timeline.trim(),
          })),
          experience: experience.map((item) => ({
            companyName: item.companyName.trim(),
            title: item.title.trim(),
            timeline: item.timeline.trim(),
          })),
        },
      });

      const savedProfile = result.profile;

      if (savedProfile) {
        setProfiles((current) => {
          if (isEditing) {
            return current.map((item) =>
              String(item.id) === String(savedProfile.id)
                ? { ...item, ...savedProfile }
                : item
            );
          }

          return [savedProfile, ...current];
        });

        if (!isEditing) {
          void refreshProfileCounts();
        }
      } else {
        void refreshProfileData();
      }

      alert(
        isEditing
          ? "Profile updated!"
          : "Profile created! You can now go to the resume builder."
      );

      resetForm();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleRemoveProfile = async (profileId) => {
    const confirmed = window.confirm("Remove this profile?");
    if (!confirmed) return;

    try {
      await deleteProfile(profileId);

      if (editingProfileId === profileId) {
        resetForm();
      }

      setProfiles((current) =>
        current.filter((item) => String(item.id) !== String(profileId))
      );
      void refreshProfileCounts();

      alert("Profile removed.");
    } catch (error) {
      alert(error.message);
    }
  };

  const applicationDateGroups = getApplicationDateGroups(selectedApplicationRows);

  const selectedDateRows = selectedApplicationDate
    ? applicationDateGroups.find(
        (group) => group.date === selectedApplicationDate
      )?.rows || []
    : [];

  return {
    profiles,
    editingProfileId,
    applicationViewMode,
    selectedApplicationProfile,
    selectedCountMode,
    selectedApplicationDate,
    applicationDateGroups,
    selectedDateRows,
    form: {
      name,
      setName,
      location,
      setLocation,
      phone,
      setPhone,
      email,
      setEmail,
      education,
      experience,
    },
    getProfileCount,
    openProfileApplicationDashboard,
    openDateApplicationList,
    backToApplicationDates,
    backToProfilesDashboard,
    addEducation,
    removeEducation,
    updateEducation,
    addExperience,
    removeExperience,
    updateExperience,
    resetForm,
    startEditProfile,
    selectProfileForUse,
    handleSaveProfile,
    handleRemoveProfile,
  };
}
