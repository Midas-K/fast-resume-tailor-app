import { memo } from "react";
import Icon from "../../UI/Icon";
import { parseJsonField } from "../../shared/utils/format";

function ProfileReferencePanel({ profile }) {
  if (!profile) {
    return (
      <div className="empty-profile-box">Select a profile to view education and experience.</div>
    );
  }

  const educationItems = parseJsonField(profile.education);
  const experienceItems = parseJsonField(profile.experience);

  return (
    <div className="fast-profile-reference">
      <div className="fast-profile-reference__meta">
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
          {profile.email || "No email"}
        </span>
        <span>
          <Icon name="fileText" size={13} />
          {profile.resume_template_name || "Default template"}
        </span>
      </div>

      <div className="fast-profile-reference__block">
        <div className="fast-profile-reference__label">
          <Icon name="education" size={14} />
          Education
        </div>
        {educationItems.length === 0 ? (
          <p className="profile-detail-empty">No education added.</p>
        ) : (
          <div className="fast-profile-reference__list">
            {educationItems.map((item, index) => (
              <div className="fast-profile-reference__item" key={index}>
                <strong>{item.school || "School"}</strong>
                <p>
                  {[item.degree, item.major]
                    .filter((value) => value && String(value).trim())
                    .join(" · ") || "Degree not provided"}
                </p>
                <span>
                  {[item.location, item.timeline]
                    .filter((value) => value && String(value).trim())
                    .join(" · ") || "Timeline not provided"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fast-profile-reference__block">
        <div className="fast-profile-reference__label">
          <Icon name="briefcase" size={14} />
          Experience
        </div>
        {experienceItems.length === 0 ? (
          <p className="profile-detail-empty">No experience added.</p>
        ) : (
          <div className="fast-profile-reference__list">
            {experienceItems.map((item, index) => (
              <div className="fast-profile-reference__item" key={index}>
                <strong>
                  {[item.companyName, item.title]
                    .filter((value) => value && String(value).trim())
                    .join(" · ") || "Company · Role"}
                </strong>
                <span>
                  {[item.location, item.timeline]
                    .filter((value) => value && String(value).trim())
                    .join(" · ") || "Timeline not provided"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ProfileReferencePanel);
