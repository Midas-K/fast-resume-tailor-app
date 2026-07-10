const PizZip = require("pizzip");
const { findSplitPlaceholders } = require("../buildResume/docxPlaceholderRepair");
const {
  DOCX_MIME_TYPE,
  extractTextFromDocxBuffer,
} = require("./templateDocx");

const isDocxFile = (file) => {
  if (!file) return false;

  const fileName = String(file.originalname || "").trim().toLowerCase();
  const mimeType = String(file.mimetype || "").trim().toLowerCase();

  return fileName.endsWith(".docx") && mimeType === DOCX_MIME_TYPE;
};

const safeDownloadFileName = (fileName, fallback = "resume-template.docx") => {
  const clean = String(fileName || "")
    .replace(/[\r\n"]/g, "")
    .trim();

  return clean || fallback;
};

const normalizeTemplateText = (value = "") => {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/\n+/g, "\n")
    .trim();
};

const getTemplateValidationReport = ({ templateText = "" }) => {
  const text = normalizeTemplateText(templateText);

  const errors = [];
  const warnings = [];

  const has = (placeholder) => text.includes(placeholder);

  const requiredPlaceholders = [
    "{{FULL_NAME}}",
    "{{@SUMMARY}}",
    "{{@SKILLS}}",
  ];

  requiredPlaceholders.forEach((placeholder) => {
    if (!has(placeholder)) {
      errors.push(`${placeholder} is missing.`);
    }
  });

  const hasCertifications = has("{{@CERTIFICATIONS}}");

  if (!hasCertifications) {
    warnings.push(
      "{{@CERTIFICATIONS}} is optional. Templates without it will omit the Certifications section."
    );
  }

  const hasContactBlock = has("{{CONTACT}}");

  const hasSeparateContactFields =
    has("{{EMAIL}}") || has("{{PHONE}}") || has("{{LOCATION}}") || has("{{LINKS}}");

  if (!hasContactBlock && !hasSeparateContactFields) {
    errors.push(
      "Contact section is missing. Add {{CONTACT}} or use separate fields like {{EMAIL}}, {{PHONE}}, {{LOCATION}}, or {{LINKS}}."
    );
  }

  const hasSimpleEducation = has("{{@EDUCATION}}");
  const hasEducationLoopStart = has("{{#EDUCATION_ITEMS}}");
  const hasEducationLoopEnd = has("{{/EDUCATION_ITEMS}}");

  if (!hasSimpleEducation && !hasEducationLoopStart) {
    errors.push(
      "Education section is missing. Add {{@EDUCATION}} or use {{#EDUCATION_ITEMS}} ... {{/EDUCATION_ITEMS}}."
    );
  }

  if (hasEducationLoopStart && !hasEducationLoopEnd) {
    errors.push(
      "{{#EDUCATION_ITEMS}} is opened but {{/EDUCATION_ITEMS}} is missing."
    );
  }

  if (!hasEducationLoopStart && hasEducationLoopEnd) {
    errors.push(
      "{{/EDUCATION_ITEMS}} exists but {{#EDUCATION_ITEMS}} is missing."
    );
  }

  const hasSimpleExperience = has("{{@EXPERIENCE}}");
  const hasExperienceLoopStart = has("{{#EXPERIENCE_ITEMS}}");
  const hasExperienceLoopEnd = has("{{/EXPERIENCE_ITEMS}}");

  if (!hasSimpleExperience && !hasExperienceLoopStart) {
    errors.push(
      "Experience section is missing. Add {{@EXPERIENCE}} or use {{#EXPERIENCE_ITEMS}} ... {{/EXPERIENCE_ITEMS}}."
    );
  }

  if (hasExperienceLoopStart && !hasExperienceLoopEnd) {
    errors.push(
      "{{#EXPERIENCE_ITEMS}} is opened but {{/EXPERIENCE_ITEMS}} is missing."
    );
  }

  if (!hasExperienceLoopStart && hasExperienceLoopEnd) {
    errors.push(
      "{{/EXPERIENCE_ITEMS}} exists but {{#EXPERIENCE_ITEMS}} is missing."
    );
  }

  if (hasExperienceLoopStart && !has("{{@DETAILS}}")) {
    errors.push("{{@DETAILS}} is missing inside the experience loop.");
  }

  if (!has("{{LOCATION}}")) {
    warnings.push("{{LOCATION}} is optional. This template can upload without it.");
  }

  const allowedPlaceholders = new Set([
    "{{FULL_NAME}}",
    "{{TITLE}}",
    "{{CONTACT}}",
    "{{EMAIL}}",
    "{{PHONE}}",
    "{{LOCATION}}",
    "{{LINKS}}",

    "{{@SUMMARY}}",
    "{{@EDUCATION}}",
    "{{@SKILLS}}",
    "{{@EXPERIENCE}}",
    "{{@CERTIFICATIONS}}",

    "{{#EDUCATION_ITEMS}}",
    "{{/EDUCATION_ITEMS}}",
    "{{SCHOOL}}",
    "{{DEGREE}}",
    "{{MAJOR}}",
    "{{TIMELINE}}",
    "{{DEGREE_MAJOR}}",
    "{{SCHOOL_DEGREE_MAJOR}}",

    "{{#EXPERIENCE_ITEMS}}",
    "{{/EXPERIENCE_ITEMS}}",
    "{{COMPANY_NAME}}",
    "{{TITLE_COMPANY}}",
    "{{COMPANY_TITLE}}",
    "{{@DETAILS}}",
  ]);

  const foundPlaceholders = text.match(/\{\{[^}]+\}\}/g) || [];

  foundPlaceholders.forEach((placeholder) => {
    if (!allowedPlaceholders.has(placeholder)) {
      warnings.push(`${placeholder} is not recognized. Check spelling.`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    hasCertifications,
  };
};

const templateHasCertificationsPlaceholder = (templateText = "") => {
  return normalizeTemplateText(templateText).includes("{{@CERTIFICATIONS}}");
};

const getDocxtemplaterErrorMessages = (error) => {
  const messages = [];

  if (error?.properties?.errors && Array.isArray(error.properties.errors)) {
    error.properties.errors.forEach((item) => {
      if (item?.properties?.explanation) {
        messages.push(item.properties.explanation);
      } else if (item?.message) {
        messages.push(item.message);
      }
    });
  }

  if (error?.properties?.explanation) {
    messages.push(error.properties.explanation);
  }

  if (error?.message) {
    messages.push(error.message);
  }

  return [...new Set(messages.filter(Boolean))];
};

const validateTemplateBeforeUpload = async (templateBuffer) => {
  try {
    const extracted = extractTextFromDocxBuffer(templateBuffer);

    if (!extracted.ok) {
      return {
        isValid: false,
        message: extracted.message,
        errors: [extracted.message],
        warnings: [],
      };
    }

    const validationReport = getTemplateValidationReport({
      templateText: extracted.text,
      paragraphs: extracted.paragraphs,
    });

    const documentXml =
      new PizZip(templateBuffer).file("word/document.xml")?.asText() || "";
    const splitPlaceholders = findSplitPlaceholders(documentXml);

    if (splitPlaceholders.length > 0) {
      validationReport.warnings.push(
        `These placeholders are split by Word formatting (often background images): ${splitPlaceholders.join(", ")}. They are auto-repaired when generating resumes.`
      );
    }

    if (!validationReport.isValid) {
      return {
        isValid: false,
        message: `Template is invalid:\n${validationReport.errors.join("\n")}`,
        errors: validationReport.errors,
        warnings: validationReport.warnings,
      };
    }

    return {
      isValid: true,
      message: "Template is valid.",
      errors: [],
      warnings: validationReport.warnings,
      hasCertifications: Boolean(validationReport.hasCertifications),
    };
  } catch (error) {
    console.error("Template validation error:", error);

    const docxErrors = getDocxtemplaterErrorMessages(error);

    if (error.properties && error.properties.errors) {
      console.error(
        "DOCX validation details:",
        JSON.stringify(error.properties.errors, null, 2)
      );
    }

    const errors =
      docxErrors.length > 0
        ? docxErrors
        : [
            error.message ||
              "Template validation failed. Check placeholders and DOCX formatting.",
          ];

    return {
      isValid: false,
      message: `Template validation failed:\n${errors.join("\n")}`,
      errors,
      warnings: [
        "Make sure every {{@...}} placeholder is alone in its own paragraph.",
        "Make sure loop tags like {{#EXPERIENCE_ITEMS}} and {{/EXPERIENCE_ITEMS}} are correctly opened and closed.",
        "Use normal Enter in Word, not Shift + Enter, around raw placeholders like {{@DETAILS}}.",
      ],
    };
  }
};
module.exports = {
  DOCX_MIME_TYPE,
  isDocxFile,
  safeDownloadFileName,
  normalizeTemplateText,
  getTemplateValidationReport,
  getDocxtemplaterErrorMessages,
  validateTemplateBeforeUpload,
  templateHasCertificationsPlaceholder,
};
