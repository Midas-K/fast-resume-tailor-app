import IconButton from "../../UI/IconButton";

function TemplatePreview({ template, previewUrl, onRefresh }) {
  return (
    <div className="template-preview-card">
      <div className="template-preview-top">
        <strong>Sample Resume Preview</strong>

        <IconButton
          icon="refresh"
          label="Refresh preview"
          variant="ghost"
          size="sm"
          className="prompt-action-btn view"
          onClick={onRefresh}
        />
      </div>

      {previewUrl ? (
        <iframe
          title={`${template.name} preview`}
          src={previewUrl}
          className="template-preview-frame"
        />
      ) : (
        <div className="template-preview-empty">
          Preview not loaded. Click Refresh Preview to generate it.
        </div>
      )}
    </div>
  );
}

export default TemplatePreview;
