import Icon from "../../UI/Icon";
import IconButton from "../../UI/IconButton";

function ProfileForm({
  editingProfileId,
  form,
  onAddEducation,
  onRemoveEducation,
  onUpdateEducation,
  onAddExperience,
  onRemoveExperience,
  onUpdateExperience,
  onSave,
  onCancelEdit,
}) {
  const { name, setName, location, setLocation, phone, setPhone, email, setEmail, education, experience } =
    form;

  return (
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
                className="remove-experience-btn icon-btn-like"
                onClick={() => onRemoveEducation(index)}
                title="Remove education"
                aria-label="Remove education"
              >
                <Icon name="trash" size={15} />
              </button>
            </div>

            <div className="resume-input-group">
              <label>School *</label>
              <input
                className="resume-text-input"
                value={item.school}
                onChange={(e) => onUpdateEducation(index, "school", e.target.value)}
                placeholder="Stanford University"
              />
            </div>

            <div className="resume-input-group">
              <label>Degree *</label>
              <input
                className="resume-text-input"
                value={item.degree}
                onChange={(e) => onUpdateEducation(index, "degree", e.target.value)}
                placeholder="B.Sc. Computer Science"
              />
            </div>

            <div className="resume-input-group">
              <label>Timeline *</label>
              <input
                className="resume-text-input"
                value={item.timeline}
                onChange={(e) => onUpdateEducation(index, "timeline", e.target.value)}
                placeholder="2010 - 2014"
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          className="add-experience-btn add-experience-bottom-btn btn-with-icon"
          onClick={onAddEducation}
        >
          <Icon name="plus" size={16} /> Add Education
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
                className="remove-experience-btn icon-btn-like"
                onClick={() => onRemoveExperience(index)}
                title="Remove experience"
                aria-label="Remove experience"
              >
                <Icon name="trash" size={15} />
              </button>
            </div>

            <div className="resume-input-group">
              <label>Company Name *</label>
              <input
                className="resume-text-input"
                value={item.companyName}
                onChange={(e) =>
                  onUpdateExperience(index, "companyName", e.target.value)
                }
                placeholder="Meta"
              />
            </div>

            <div className="resume-input-group">
              <label>Title *</label>
              <input
                className="resume-text-input"
                value={item.title}
                onChange={(e) => onUpdateExperience(index, "title", e.target.value)}
                placeholder="Staff AI/ML Engineer"
              />
            </div>

            <div className="resume-input-group">
              <label>Timeline *</label>
              <input
                className="resume-text-input"
                value={item.timeline}
                onChange={(e) =>
                  onUpdateExperience(index, "timeline", e.target.value)
                }
                placeholder="Oct 2023 - Present"
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          className="add-experience-btn add-experience-bottom-btn btn-with-icon"
          onClick={onAddExperience}
        >
          <Icon name="plus" size={16} /> Add Experience
        </button>
      </div>

      <div className="profile-actions">
        <IconButton
          icon={editingProfileId ? "save" : "plus"}
          label={editingProfileId ? "Update profile" : "Create profile"}
          variant="primary"
          size="lg"
          onClick={onSave}
        />

        {editingProfileId && (
          <IconButton
            icon="close"
            label="Cancel edit"
            variant="ghost"
            onClick={onCancelEdit}
          />
        )}
      </div>
    </section>
  );
}

export default ProfileForm;
