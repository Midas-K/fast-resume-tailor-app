import Icon from "../../UI/Icon";
import IconButton from "../../UI/IconButton";
import TemplatePreview from "./TemplatePreview";
import TemplateRequirementsCard from "./TemplateRequirementsCard";
import { splitResumeTemplates } from "../utils/templateHelpers";

function TemplateListItem({
  template,
  templatePreviewUrls,
  onSetDefault,
  onRemoveTemplate,
  onRefreshPreview,
  variant = "custom",
}) {
  const isDefault = variant === "default";

  return (
    <div
      className={
        isDefault
          ? "template-list-item template-list-item--default"
          : "template-list-item template-list-item--custom"
      }
    >
      <div className="template-main-info">
        <div>
          <div className="template-list-item__title-row">
            <h4>{template.name}</h4>
            {isDefault ? (
              <span className="template-badge template-badge--default">
                <Icon name="star" size={12} />
                Default
              </span>
            ) : (
              <span className="template-badge template-badge--custom">Custom</span>
            )}
          </div>
          <p>{template.description || "No description"}</p>
          <small>{template.file_name}</small>
        </div>
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
        {!isDefault && (
          <IconButton
            icon="star"
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
  );
}

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
  const { defaultTemplate, otherTemplates } = splitResumeTemplates(resumeTemplates);

  return (
    <section className="admin-content-card">
      <div className="admin-section-header">
        <div>
          <h2>Resume Templates</h2>
          <p>
            Upload DOCX resume templates. The default template is highlighted and
            always shown first; custom templates are listed oldest to newest.
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
            Default template uses a gold spotlight card. Custom templates use a
            lighter style and appear below in oldest-first order.
          </p>

          {resumeTemplates.length === 0 ? (
            <div className="empty-user-profiles">
              No resume templates uploaded yet.
            </div>
          ) : (
            <div className="template-list-stack">
              {defaultTemplate && (
                <div className="template-list-zone template-list-zone--default">
                  <div className="template-list-zone__label">
                    <Icon name="star" size={14} />
                    Default template
                  </div>
                  <TemplateListItem
                    template={defaultTemplate}
                    templatePreviewUrls={templatePreviewUrls}
                    onSetDefault={onSetDefault}
                    onRemoveTemplate={onRemoveTemplate}
                    onRefreshPreview={onRefreshPreview}
                    variant="default"
                  />
                </div>
              )}

              {otherTemplates.length > 0 && (
                <div className="template-list-zone template-list-zone--custom">
                  <div className="template-list-zone__label">
                    <Icon name="layers" size={14} />
                    Custom templates ({otherTemplates.length})
                  </div>
                  <div className="template-list">
                    {otherTemplates.map((template) => (
                      <TemplateListItem
                        key={template.id}
                        template={template}
                        templatePreviewUrls={templatePreviewUrls}
                        onSetDefault={onSetDefault}
                        onRemoveTemplate={onRemoveTemplate}
                        onRefreshPreview={onRefreshPreview}
                        variant="custom"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ResumeTemplatesSection;
