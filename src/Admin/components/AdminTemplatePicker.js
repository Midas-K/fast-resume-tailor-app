import Icon from "../../UI/Icon";
import { splitResumeTemplates } from "../utils/templateHelpers";

function AdminTemplatePicker({ value, templates, onChange, currentLabel }) {
  const { defaultTemplate, otherTemplates } = splitResumeTemplates(templates);
  const selectedValue = value ? String(value) : "";

  const handleSelect = (templateId) => {
    onChange(templateId || null);
  };

  return (
    <div className="admin-template-picker">
      <div className="admin-template-picker__default-zone">
        <span className="admin-template-picker__zone-label">
          <Icon name="star" size={13} />
          Default template
        </span>
        <button
          type="button"
          className={
            selectedValue === ""
              ? "admin-template-picker__option admin-template-picker__option--default is-selected"
              : "admin-template-picker__option admin-template-picker__option--default"
          }
          onClick={() => handleSelect(null)}
        >
          <span className="admin-template-picker__option-title">
            {defaultTemplate?.name || "System default"}
          </span>
          <span className="admin-template-picker__option-meta">
            Used when no custom template is assigned
          </span>
        </button>
      </div>

      {otherTemplates.length > 0 && (
        <div className="admin-template-picker__custom-zone">
          <span className="admin-template-picker__zone-label">
            <Icon name="layers" size={13} />
            Custom templates (oldest first)
          </span>
          <div className="admin-template-picker__custom-list">
            {otherTemplates.map((template) => (
              <button
                type="button"
                key={template.id}
                className={
                  selectedValue === String(template.id)
                    ? "admin-template-picker__option admin-template-picker__option--custom is-selected"
                    : "admin-template-picker__option admin-template-picker__option--custom"
                }
                onClick={() => handleSelect(template.id)}
              >
                <span className="admin-template-picker__option-title">
                  {template.name}
                </span>
                <span className="admin-template-picker__option-meta">
                  {template.file_name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="admin-template-picker__current">
        Assigned: {currentLabel || defaultTemplate?.name || "Default template"}
      </p>
    </div>
  );
}

export default AdminTemplatePicker;
