function TemplateRequirementsCard() {
  return (
    <div className="template-requirements-card">
      <h3>DOCX Template Requirements</h3>
      <p>
        Upload a valid DOCX layout with placeholders. Admin controls section
        order, headings, fonts, colors, spacing, margins, and left/right
        alignment. Invalid templates are rejected before they are added.
      </p>

      <div className="requirements-grid">
        <div>
          <strong>Plain placeholders</strong>
          <code>{"{{FULL_NAME}}"}</code>
          <code>{"{{TITLE}}"}</code>
          <code>{"{{CONTACT}}"}</code>
          <code>{"{{EMAIL}}"}</code>
          <code>{"{{LOCATION}}"}</code>
          <code>{"{{PHONE}}"}</code>
          <code>{"{{LINKS}}"}</code>
        </div>

        <div>
          <strong>Formatted block placeholders</strong>
          <code>{"{{@SUMMARY}}"}</code>
          <code>{"{{@EDUCATION}}"}</code>
          <code>{"{{@SKILLS}}"}</code>
          <code>{"{{@EXPERIENCE}}"}</code>
          <code>{"{{@CERTIFICATIONS}}"}</code>
          <span>Use these for simple one-block sections.</span>
          <span>
            {"{{@CERTIFICATIONS}}"} is optional. You can upload templates with
            or without a Certifications section.
          </span>
        </div>

        <div>
          <strong>Education loop placeholders</strong>
          <code>{"{{#EDUCATION_ITEMS}}"}</code>
          <code>{"{{SCHOOL}}"}</code>
          <code>{"{{DEGREE}}"}</code>
          <code>{"{{MAJOR}}"}</code>
          <code>{"{{LOCATION}}"}</code>
          <code>{"{{TIMELINE}}"}</code>
          <code>{"{{DEGREE_MAJOR}}"}</code>
          <code>{"{{SCHOOL_DEGREE_MAJOR}}"}</code>
          <code>{"{{/EDUCATION_ITEMS}}"}</code>
        </div>

        <div>
          <strong>Experience loop placeholders</strong>
          <code>{"{{#EXPERIENCE_ITEMS}}"}</code>
          <code>{"{{TITLE}}"}</code>
          <code>{"{{COMPANY_NAME}}"}</code>
          <code>{"{{LOCATION}}"}</code>
          <code>{"{{TIMELINE}}"}</code>
          <code>{"{{TITLE_COMPANY}}"}</code>
          <code>{"{{COMPANY_TITLE}}"}</code>
          <code>{"{{@DETAILS}}"}</code>
          <code>{"{{/EXPERIENCE_ITEMS}}"}</code>
        </div>

        <div>
          <strong>Auto formatting</strong>
          <span>Real Word bullets</span>
          <span>Justified paragraphs</span>
          <span>Bold: **text**</span>
          <span>Italic: *text*</span>
          <span>Underline: __text__</span>
          <span>Skill categories auto-bold before ":"</span>
          <span>DOCX converts to PDF for user download</span>
        </div>

        <div>
          <strong>Right-side timeline tip</strong>
          <span>Use a borderless 2-column table in Word.</span>
          <span>Left cell: title/company/degree/location</span>
          <span>Right cell: {"{{TIMELINE}}"}</span>
          <span>Do not use spaces for alignment.</span>
          <span>{"{{@DETAILS}}"} must be alone in its own paragraph.</span>
        </div>
      </div>
    </div>
  );
}

export default TemplateRequirementsCard;
