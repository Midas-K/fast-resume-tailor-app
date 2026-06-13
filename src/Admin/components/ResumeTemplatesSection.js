import IconButton from "../../UI/IconButton";
import TemplatePreview from "./TemplatePreview";
import TemplateRequirementsCard from "./TemplateRequirementsCard";

function ResumeTemplatesSection({
  resumeTemplates,
  templateName,
  templateDescription,
  templateIsDefault,
  templateUploading,
  templatePreviewUrls,
  onTemplateNameChange,
  onTemplateDescriptionChange,
  onTemplateIsDefaultChange,
  onTemplateFileChange,
  onUpload,
  onRefreshTemplates,
  onSetDefault,
  onRemoveTemplate,
  onRefreshPreview,
}) {
  return (
    <section className="admin-content-card">
      <div className="admin-section-header">
        <div>
          <h2>Resume Templates</h2>
          <p>
            Upload DOCX resume templates. Admins can set one default template and
            assign templates to user profiles.
          </p>
        </div>

        <IconButton
          icon="refresh"
          label="Refresh templates"
          variant="primary"
          className="admin-primary-btn"
          onClick={onRefreshTemplates}
        />
      </div>

      <div className="template-admin-grid with-requirements">
        <TemplateRequirementsCard />

        <div className="template-upload-card">
          <h3>Upload DOCX Template</h3>
          <p>
            Upload a DOCX file with simple placeholders like {"{{FULL_NAME}}"}{" "}
            and {"{{CONTACT}}"}, formatted blocks like {"{{@SKILLS}}"}, or
            advanced loops like {"{{#EXPERIENCE_ITEMS}}"} with {"{{@DETAILS}}"}.
          </p>

          <div className="resume-input-group">
            <label>Template Name</label>
            <input
              className="resume-text-input"
              value={templateName}
              onChange={(e) => onTemplateNameChange(e.target.value)}
              placeholder="Classic ATS Template"
            />
          </div>

          <div className="resume-input-group">
            <label>Description</label>
            <input
              className="resume-text-input"
              value={templateDescription}
              onChange={(e) => onTemplateDescriptionChange(e.target.value)}
              placeholder="Clean DOCX resume layout"
            />
          </div>

          <div className="resume-input-group">
            <label>DOCX File</label>
            <input
              id="resumeTemplateFile"
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="resume-text-input file-input-modern"
              onChange={(e) => onTemplateFileChange(e.target.files?.[0] || null)}
            />
          </div>

          <label className="template-default-check">
            <input
              type="checkbox"
              checked={templateIsDefault}
              onChange={(e) => onTemplateIsDefaultChange(e.target.checked)}
            />
            <span>Set as default template</span>
          </label>

          <IconButton
            icon="upload"
            label={
              templateUploading ? "Validating template..." : "Upload DOCX template"
            }
            variant="primary"
            className="admin-primary-btn"
            loading={templateUploading}
            disabled={templateUploading}
            onClick={onUpload}
          />
        </div>

        <div className="template-list-card">
          <h3>Available Templates</h3>
          <p>
            These DOCX templates can be assigned to user profiles. Preview shows
            a realistic sample resume generated from each uploaded template.
          </p>

          {resumeTemplates.length === 0 ? (
            <div className="empty-user-profiles">
              No resume templates uploaded yet.
            </div>
          ) : (
            <div className="template-list">
              {resumeTemplates.map((template) => (
                <div className="template-list-item" key={template.id}>
                  <div className="template-main-info">
                    <div>
                      <h4>{template.name}</h4>
                      <p>{template.description || "No description"}</p>
                      <small>{template.file_name}</small>
                    </div>

                    {template.is_default && (
                      <span className="status-badge approved">Default</span>
                    )}
                  </div>

                  <div className="template-meta-row">
                    <span>
                      Uploaded: {new Date(template.created_at).toLocaleString()}
                    </span>
                  </div>

                  <TemplatePreview
                    template={template}
                    previewUrl={templatePreviewUrls[template.id]}
                    onRefresh={() => onRefreshPreview(template.id, true)}
                  />

                  <div className="template-actions">
                    {!template.is_default && (
                      <IconButton
                        icon="check"
                        label="Set as default"
                        variant="success"
                        size="sm"
                        onClick={() => onSetDefault(template.id)}
                      />
                    )}

                    <IconButton
                      icon="trash"
                      label="Remove template"
                      variant="danger"
                      size="sm"
                      onClick={() => onRemoveTemplate(template.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ResumeTemplatesSection;
