import Icon from "../../UI/Icon";
import { parseJsonField } from "../../shared/utils/format";

function formatEducationLine(education) {
  const school =
    education.school ||
    education.university ||
    education.universityName ||
    "University";

  const degreeMajor = [education.degree, education.major]
    .filter((value) => value && String(value).trim())
    .join(" · ");

  const meta = [education.location, education.timeline]
    .filter((value) => value && String(value).trim())
    .join(" · ");

  return { title: school, subtitle: degreeMajor || "Degree not provided", meta };
}

function formatExperienceLine(experience) {
  const title = [experience.companyName, experience.title]
    .filter((value) => value && String(value).trim())
    .join(" · ");

  const meta = [experience.location, experience.timeline]
    .filter((value) => value && String(value).trim())
    .join(" · ");

  return {
    title: title || "Company · Role",
    subtitle: meta || "Timeline not provided",
    meta: "",
  };
}

function TimelineBlock({ icon, label, items, emptyText }) {
  return (
    <div className="admin-timeline-block">
      <div className="admin-timeline-block__head">
        <Icon name={icon} size={14} />
        <span>{label}</span>
      </div>

      {items.length === 0 ? (
        <p className="profile-detail-empty">{emptyText}</p>
      ) : (
        <div className="admin-timeline-list">
          {items.map((item, index) => (
            <div className="admin-timeline-item" key={index}>
              <div className="admin-timeline-item__dot" />
              <div className="admin-timeline-item__body">
                <strong>{item.title}</strong>
                {item.subtitle && <p>{item.subtitle}</p>}
                {item.meta && <span>{item.meta}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProfileEducationDetails({ profile, compact = false }) {
  const educationItems = parseJsonField(profile.education).map(formatEducationLine);

  if (compact) {
    return (
      <TimelineBlock
        icon="education"
        label="Education"
        items={educationItems}
        emptyText="No education added."
      />
    );
  }

  if (educationItems.length === 0) {
    return <p className="profile-detail-empty">No education added.</p>;
  }

  return (
    <div className="profile-detail-list">
      {educationItems.map((education, index) => (
        <div className="profile-detail-item" key={index}>
          <strong>{education.title}</strong>
          <p>{education.subtitle}</p>
          {education.meta && <span>{education.meta}</span>}
        </div>
      ))}
    </div>
  );
}

export function ProfileExperienceDetails({ profile, compact = false }) {
  const experienceItems = parseJsonField(profile.experience).map(
    formatExperienceLine
  );

  if (compact) {
    return (
      <TimelineBlock
        icon="briefcase"
        label="Experience"
        items={experienceItems}
        emptyText="No experience added."
      />
    );
  }

  if (experienceItems.length === 0) {
    return <p className="profile-detail-empty">No experience added.</p>;
  }

  return (
    <div className="profile-detail-list">
      {experienceItems.map((experience, index) => (
        <div className="profile-detail-item" key={index}>
          <strong>{experience.title}</strong>
          <p>{experience.subtitle}</p>
        </div>
      ))}
    </div>
  );
}

export function ProfileCareerSnapshot({ profile }) {
  return (
    <div className="admin-career-snapshot">
      <ProfileEducationDetails profile={profile} compact />
      <ProfileExperienceDetails profile={profile} compact />
    </div>
  );
}

export function ProfileContactStrip({ profile }) {
  return (
    <div className="admin-contact-strip">
      <span>
        <Icon name="mapPin" size={13} />
        {profile.location || "No location"}
      </span>
      <span>
        <Icon name="phone" size={13} />
        {profile.phone || "No phone"}
      </span>
      <span>
        <Icon name="mail" size={13} />
        {profile.profile_email || profile.email || "No email"}
      </span>
    </div>
  );
}
