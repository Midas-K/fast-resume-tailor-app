import { parseJsonField } from "../../shared/utils/format";

export function ProfileEducationDetails({ profile }) {
  const educationItems = parseJsonField(profile.education);

  if (educationItems.length === 0) {
    return <p className="profile-detail-empty">No education added.</p>;
  }

  return (
    <div className="profile-detail-list">
      {educationItems.map((education, index) => (
        <div className="profile-detail-item" key={index}>
          <strong>
            {education.school ||
              education.university ||
              education.universityName ||
              "University"}
          </strong>

          <p>
            {[education.degree, education.major]
              .filter((value) => value && String(value).trim())
              .join(" - ") || "Degree / Major not provided"}
          </p>

          <p>
            {[education.location, education.timeline]
              .filter((value) => value && String(value).trim())
              .join(" | ") || "Location / timeline not provided"}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ProfileExperienceDetails({ profile }) {
  const experienceItems = parseJsonField(profile.experience);

  if (experienceItems.length === 0) {
    return <p className="profile-detail-empty">No experience added.</p>;
  }

  return (
    <div className="profile-detail-list">
      {experienceItems.map((experience, index) => (
        <div className="profile-detail-item" key={index}>
          <strong>
            {[experience.companyName, experience.title]
              .filter((value) => value && String(value).trim())
              .join(" - ") || "Company / Title"}
          </strong>

          <p>
            {[experience.location, experience.timeline]
              .filter((value) => value && String(value).trim())
              .join(" | ") || "Location / timeline not provided"}
          </p>
        </div>
      ))}
    </div>
  );
}
