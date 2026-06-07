const express = require("express");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const pool = require("../db");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const router = express.Router();

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const PREVIEW_FONT = "Calibri";
const PREVIEW_FONT_SIZE = "20";
const PREVIEW_COLOR = "111827";
const BULLET_NUM_ID = "99";
const BULLET_ABSTRACT_NUM_ID = "99";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const normalizeAccountType = (decoded) => {
  return decoded.account_type || decoded.accountType || "user";
};

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Authorization token is missing.",
    });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const accountType = normalizeAccountType(decoded);

    req.user = {
      ...decoded,
      account_type: accountType,
      accountType,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.account_type !== "admin" && req.user.accountType !== "admin") {
    return res.status(403).json({
      message: "Admin access required.",
    });
  }

  next();
};

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

const escapeXml = (value) => {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

const decodeXmlEntities = (value) => {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
};

const stripBullet = (line) => {
  const text = String(line || "").trim();

  return text.replace(/^[-•]\s+/, "").replace(/^\*\s+/, "").trim();
};

const extractTextFromDocxBuffer = (templateBuffer) => {
  try {
    const zip = new PizZip(templateBuffer);
    const documentFile = zip.file("word/document.xml");

    if (!documentFile) {
      return {
        ok: false,
        text: "",
        paragraphs: [],
        message: "DOCX is invalid. word/document.xml was not found.",
      };
    }

    const documentXml = documentFile.asText();
    const paragraphMatches = documentXml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];

    const paragraphs = paragraphMatches
      .map((paragraphXml) => {
        const textPieces = [];

        const tokenMatches =
          paragraphXml.match(
            /<w:t[\s\S]*?<\/w:t>|<w:tab\/>|<w:br\/>|<w:br [\s\S]*?\/>/g
          ) || [];

        tokenMatches.forEach((token) => {
          if (token.startsWith("<w:t")) {
            const text = token
              .replace(/^<w:t[^>]*>/, "")
              .replace(/<\/w:t>$/, "");

            textPieces.push(decodeXmlEntities(text));
          } else if (token.startsWith("<w:tab")) {
            textPieces.push("\t");
          } else if (token.startsWith("<w:br")) {
            textPieces.push("\n");
          }
        });

        return textPieces.join("").trim();
      })
      .filter(Boolean);

    return {
      ok: true,
      text: paragraphs.join("\n"),
      paragraphs,
      message: "DOCX text extracted.",
    };
  } catch (error) {
    return {
      ok: false,
      text: "",
      paragraphs: [],
      message:
        error.message ||
        "Could not read DOCX. Make sure this is a real .docx file.",
    };
  }
};

const normalizeTemplateText = (value = "") => {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/\n+/g, "\n")
    .trim();
};

const getTemplateValidationReport = ({ templateText = "", paragraphs = [] }) => {
  const text = normalizeTemplateText(templateText);
  const paragraphList = Array.isArray(paragraphs) ? paragraphs : [];

  const errors = [];
  const warnings = [];

  const has = (placeholder) => text.includes(placeholder);

  const requiredPlaceholders = [
    "{{FULL_NAME}}",
    "{{CONTACT}}",
    "{{@SUMMARY}}",
    "{{@SKILLS}}",
    "{{@CERTIFICATIONS}}",
  ];

  requiredPlaceholders.forEach((placeholder) => {
    if (!has(placeholder)) {
      errors.push(`${placeholder} is missing.`);
    }
  });

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

  [
    "{{@SUMMARY}}",
    "{{@EDUCATION}}",
    "{{@SKILLS}}",
    "{{@EXPERIENCE}}",
    "{{@DETAILS}}",
    "{{@CERTIFICATIONS}}",
  ].forEach(validateRawPlaceholderIsAlone);

  // LOCATION is optional. Missing LOCATION is not an error.
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

  const likelyBrokenPlaceholder = text.match(/\{[^{}]*\{|\}[^{}]*\}/g);

  if (likelyBrokenPlaceholder) {
    warnings.push(
      "Some braces look unusual. Make sure placeholders are typed exactly like {{FULL_NAME}}."
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: [...new Set(warnings)],
  };
};

const has = (placeholder) => text.includes(placeholder);

const normalizeParagraphForPlaceholderCheck = (paragraph) => {
  return String(paragraph || "")
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, "")
    .replace(/\s+/g, "")
    .trim();
};

const isRawPlaceholderAlone = (paragraph, placeholder) => {
  return normalizeParagraphForPlaceholderCheck(paragraph) === placeholder;
};

const validateRawPlaceholderIsAlone = (placeholder) => {
  if (!has(placeholder)) return;

  const matchingParagraphs = paragraphList.filter((paragraph) =>
    paragraph.includes(placeholder)
  );

  if (matchingParagraphs.length === 0) {
    return;
  }

  const hasValidParagraph = matchingParagraphs.some((paragraph) =>
    isRawPlaceholderAlone(paragraph, placeholder)
  );

  if (!hasValidParagraph) {
    errors.push(
      `${placeholder} must be alone in its own paragraph. Do not write text before or after ${placeholder}.`
    );
  }
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

const parseStyledSegments = (text, options = {}) => {
  const { boldBeforeColon = false } = options;
  const cleanText = String(text || "").trim();

  if (!cleanText) return [];

  const segments = [];
  const regex = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*)/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(cleanText)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: cleanText.slice(lastIndex, match.index),
        bold: false,
        italic: false,
        underline: false,
      });
    }

    const token = match[0];

    if (token.startsWith("**") && token.endsWith("**")) {
      segments.push({
        text: token.slice(2, -2),
        bold: true,
        italic: false,
        underline: false,
      });
    } else if (token.startsWith("__") && token.endsWith("__")) {
      segments.push({
        text: token.slice(2, -2),
        bold: false,
        italic: false,
        underline: true,
      });
    } else if (token.startsWith("*") && token.endsWith("*")) {
      segments.push({
        text: token.slice(1, -1),
        bold: false,
        italic: true,
        underline: false,
      });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < cleanText.length) {
    segments.push({
      text: cleanText.slice(lastIndex),
      bold: false,
      italic: false,
      underline: false,
    });
  }

  if (!boldBeforeColon) {
    return segments;
  }

  const plainText = segments.map((segment) => segment.text).join("");
  const colonIndex = plainText.indexOf(":");

  if (colonIndex <= 0) {
    return segments;
  }

  const rebuilt = [];
  let cursor = 0;

  segments.forEach((segment) => {
    const start = cursor;
    const end = cursor + segment.text.length;
    cursor = end;

    if (end <= colonIndex + 1) {
      rebuilt.push({
        ...segment,
        bold: true,
      });
      return;
    }

    if (start > colonIndex) {
      rebuilt.push(segment);
      return;
    }

    const splitAt = colonIndex + 1 - start;

    rebuilt.push({
      text: segment.text.slice(0, splitAt),
      bold: true,
      italic: segment.italic,
      underline: segment.underline,
    });

    rebuilt.push({
      text: segment.text.slice(splitAt),
      bold: segment.bold,
      italic: segment.italic,
      underline: segment.underline,
    });
  });

  return rebuilt.filter((segment) => segment.text);
};

const makeRunXml = ({
  text,
  bold = false,
  italic = false,
  underline = false,
}) => {
  return `
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="${PREVIEW_FONT}" w:hAnsi="${PREVIEW_FONT}"/>
        <w:sz w:val="${PREVIEW_FONT_SIZE}"/>
        <w:szCs w:val="${PREVIEW_FONT_SIZE}"/>
        <w:color w:val="${PREVIEW_COLOR}"/>
        ${bold ? "<w:b/>" : ""}
        ${italic ? "<w:i/>" : ""}
        ${underline ? '<w:u w:val="single"/>' : ""}
      </w:rPr>
      <w:t xml:space="preserve">${escapeXml(text)}</w:t>
    </w:r>
  `;
};

const makeParagraphXml = ({
  text = "",
  bullet = false,
  bold = false,
  italic = false,
  underline = false,
  boldBeforeColon = false,
  justify = true,
}) => {
  const cleanText = bullet ? stripBullet(text) : String(text || "").trim();

  if (!cleanText) return "";

  const segments = bold
    ? [
        {
          text: cleanText,
          bold: true,
          italic,
          underline,
        },
      ]
    : parseStyledSegments(cleanText, {
        boldBeforeColon,
      });

  const bodyRuns = segments
    .map((segment) =>
      makeRunXml({
        text: segment.text,
        bold: segment.bold,
        italic: segment.italic,
        underline: segment.underline,
      })
    )
    .join("");

  return `
    <w:p>
      <w:pPr>
        ${
          bullet
            ? `
        <w:pStyle w:val="ListParagraph"/>
        <w:numPr>
          <w:ilvl w:val="0"/>
          <w:numId w:val="${BULLET_NUM_ID}"/>
        </w:numPr>
        <w:ind w:left="360" w:hanging="180"/>
        `
            : ""
        }
        ${justify ? '<w:jc w:val="both"/>' : ""}
        <w:spacing w:after="80"/>
      </w:pPr>
      ${bodyRuns}
    </w:p>
  `;
};

const makeSectionXml = ({
  lines,
  bullet = false,
  boldBeforeColon = false,
  justify = true,
}) => {
  return lines
    .map((line) =>
      makeParagraphXml({
        text: line,
        bullet,
        boldBeforeColon,
        justify,
      })
    )
    .join("");
};

const ensureBulletNumberingXml = (zip) => {
  const numberingPath = "word/numbering.xml";
  const relsPath = "word/_rels/document.xml.rels";
  const contentTypesPath = "[Content_Types].xml";

  const bulletDefinition = `
  <w:abstractNum w:abstractNumId="${BULLET_ABSTRACT_NUM_ID}">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="•"/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:tabs>
          <w:tab w:val="num" w:pos="360"/>
        </w:tabs>
        <w:ind w:left="360" w:hanging="180"/>
      </w:pPr>
      <w:rPr>
        <w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/>
      </w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="${BULLET_NUM_ID}">
    <w:abstractNumId w:val="${BULLET_ABSTRACT_NUM_ID}"/>
  </w:num>`;

  if (!zip.file(numberingPath)) {
    zip.file(
      numberingPath,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
${bulletDefinition}
</w:numbering>`
    );
  } else {
    const existingNumbering = zip.file(numberingPath).asText();

    if (!existingNumbering.includes(`w:numId="${BULLET_NUM_ID}"`)) {
      zip.file(
        numberingPath,
        existingNumbering.replace(
          "</w:numbering>",
          `${bulletDefinition}</w:numbering>`
        )
      );
    }
  }

  const relsFile = zip.file(relsPath);

  if (relsFile) {
    const relsXml = relsFile.asText();

    if (!relsXml.includes("numbering.xml")) {
      const nextRidMatches = [...relsXml.matchAll(/Id="rId(\d+)"/g)]
        .map((match) => Number(match[1]))
        .filter((value) => Number.isFinite(value));

      const nextRid =
        nextRidMatches.length > 0 ? Math.max(...nextRidMatches) + 1 : 1;

      const numberingRel = `<Relationship Id="rId${nextRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>`;

      zip.file(
        relsPath,
        relsXml.replace("</Relationships>", `${numberingRel}</Relationships>`)
      );
    }
  }

  const contentTypesFile = zip.file(contentTypesPath);

  if (contentTypesFile) {
    const contentTypesXml = contentTypesFile.asText();

    if (!contentTypesXml.includes('PartName="/word/numbering.xml"')) {
      const numberingOverride =
        '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>';

      zip.file(
        contentTypesPath,
        contentTypesXml.replace("</Types>", `${numberingOverride}</Types>`)
      );
    }
  }
};

const makePreviewExperienceDetails = (lines) => {
  return makeSectionXml({
    lines,
    bullet: true,
    justify: true,
  });
};

const makePreviewDocxBuffer = (templateBuffer) => {
  const zip = new PizZip(templateBuffer);

  ensureBulletNumberingXml(zip);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: {
      start: "{{",
      end: "}}",
    },
  });

  const educationItems = [
    {
      SCHOOL: "Metropolitan State University",
      DEGREE: "Bachelor's Degree",
      MAJOR: "Computer Science",
      TIMELINE: "2013 - 2017",
      LOCATION: "Saint Paul, MN",
      DEGREE_MAJOR: "Bachelor's Degree in Computer Science",
      SCHOOL_DEGREE_MAJOR:
        "Metropolitan State University, Bachelor's Degree, Computer Science",

      school: "Metropolitan State University",
      degree: "Bachelor's Degree",
      major: "Computer Science",
      timeline: "2013 - 2017",
      location: "Saint Paul, MN",
      degree_major: "Bachelor's Degree in Computer Science",
      school_degree_major:
        "Metropolitan State University, Bachelor's Degree, Computer Science",
    },
  ];

  const experienceItems = [
    {
      COMPANY_NAME: "Meta",
      TITLE: "Staff AI/ML Engineer",
      TIMELINE: "2022 - 2026",
      LOCATION: "Menlo Park, CA",
      TITLE_COMPANY: "Staff AI/ML Engineer - Meta",
      COMPANY_TITLE: "Meta - Staff AI/ML Engineer",
      DETAILS: makePreviewExperienceDetails([
        "Designed and deployed 12+ custom AI/ML models for document review automation, **reducing manual workflow steps** by 63%.",
        "Built scalable ML pipelines on AWS using SageMaker, Lambda, and Step Functions to automate *model training* and deployment cycles.",
        "Integrated NLP classification models into Java backend services and React frontend workflows for real-time document triage.",
      ]),

      companyName: "Meta",
      company_name: "Meta",
      title: "Staff AI/ML Engineer",
      timeline: "2022 - 2026",
      location: "Menlo Park, CA",
      title_company: "Staff AI/ML Engineer - Meta",
      company_title: "Meta - Staff AI/ML Engineer",
      details: makePreviewExperienceDetails([
        "Designed and deployed 12+ custom AI/ML models for document review automation, **reducing manual workflow steps** by 63%.",
        "Built scalable ML pipelines on AWS using SageMaker, Lambda, and Step Functions to automate model training and deployment cycles.",
      ]),
    },
    {
      COMPANY_NAME: "Amazon",
      TITLE: "Senior AI/ML Engineer",
      TIMELINE: "2020 - 2022",
      LOCATION: "Seattle, WA",
      TITLE_COMPANY: "Senior AI/ML Engineer - Amazon",
      COMPANY_TITLE: "Amazon - Senior AI/ML Engineer",
      DETAILS: makePreviewExperienceDetails([
        "Developed forecasting and fraud detection systems using Python, XGBoost, TensorFlow, and AWS production services.",
        "Improved deployment reliability through CI/CD automation, model monitoring, and reproducible ML pipeline design.",
      ]),

      companyName: "Amazon",
      company_name: "Amazon",
      title: "Senior AI/ML Engineer",
      timeline: "2020 - 2022",
      location: "Seattle, WA",
      title_company: "Senior AI/ML Engineer - Amazon",
      company_title: "Amazon - Senior AI/ML Engineer",
      details: makePreviewExperienceDetails([
        "Developed forecasting and fraud detection systems using Python, XGBoost, TensorFlow, and AWS production services.",
        "Improved deployment reliability through CI/CD automation, model monitoring, and reproducible ML pipeline design.",
      ]),
    },
  ];

  const sampleData = {
    FULL_NAME: "JOHN SMITH",
    TITLE: "Staff AI/ML Engineer",
    EMAIL: "john.smith@email.com",
    LOCATION: "San Francisco, CA",
    PHONE: "(123) 456-7890",
    LINKS: "linkedin.com/in/johnsmith",
    CONTACT:
      "john.smith@email.com • San Francisco, CA • (123) 456-7890 • linkedin.com/in/johnsmith",

    SUMMARY: makeSectionXml({
      lines: [
        "**Staff AI/ML Engineer with 10 years of experience** designing and deploying production machine learning systems across AWS cloud environments.",
        "Specializes in integrating *ML capabilities* into Java and React workflows, improving document automation, compliance reporting, and model reliability.",
      ],
      justify: true,
    }),

    EDUCATION: makeSectionXml({
      lines: [
        "**Bachelor's Degree** in Computer Science, Metropolitan State University | Saint Paul, MN | 2013 - 2017",
      ],
      justify: true,
    }),

    SKILLS: makeSectionXml({
      lines: [
        "LLMOps & Model Operations: Model versioning, experiment tracking, CI/CD for ML, model monitoring, drift detection",
        "AI Governance & Compliance: FISMA controls, NIST 800-53 frameworks, model explainability, audit logging",
        "Natural Language Processing: Text classification, named entity recognition, summarization, information extraction",
        "Agile Collaboration: Remote workflows, cross-functional communication, stakeholder alignment",
      ],
      bullet: true,
      boldBeforeColon: true,
      justify: true,
    }),

    EXPERIENCE: [
      makeParagraphXml({
        text: "Staff AI/ML Engineer - Meta | Menlo Park, CA | 2022 - 2026",
        bold: true,
        justify: false,
      }),
      makePreviewExperienceDetails([
        "Designed and deployed 12+ custom AI/ML models for document review automation, **reducing manual workflow steps** by 63%.",
        "Built scalable ML pipelines on AWS using SageMaker, Lambda, and Step Functions to automate *model training* and deployment cycles.",
        "Integrated NLP classification models into Java backend services and React frontend workflows for __real-time document triage__.",
      ]),
      makeParagraphXml({
        text: "Senior AI/ML Engineer - Amazon | Seattle, WA | 2020 - 2022",
        bold: true,
        justify: false,
      }),
      makePreviewExperienceDetails([
        "Developed forecasting and fraud detection systems using Python, XGBoost, TensorFlow, and AWS production services.",
        "Improved deployment reliability through CI/CD automation, model monitoring, and reproducible ML pipeline design.",
      ]),
    ].join(""),

    CERTIFICATIONS: makeSectionXml({
      lines: [
        "**AWS Certified Machine Learning - Specialty**",
        "*TensorFlow Developer Certificate*",
        "Certified AI Governance Professional",
      ],
      bullet: true,
      justify: true,
    }),

    EDUCATION_ITEMS: educationItems,
    EXPERIENCE_ITEMS: experienceItems,

    full_name: "JOHN SMITH",
    title: "Staff AI/ML Engineer",
    email: "john.smith@email.com",
    location: "San Francisco, CA",
    phone: "(123) 456-7890",
    links: "linkedin.com/in/johnsmith",
    contact:
      "john.smith@email.com • San Francisco, CA • (123) 456-7890 • linkedin.com/in/johnsmith",

    summary: makeSectionXml({
      lines: [
        "**Staff AI/ML Engineer with 10 years of experience** designing and deploying production machine learning systems across AWS cloud environments.",
      ],
      justify: true,
    }),

    education: makeSectionXml({
      lines: [
        "**Bachelor's Degree** in Computer Science, Metropolitan State University | Saint Paul, MN | 2013 - 2017",
      ],
      justify: true,
    }),

    skills: makeSectionXml({
      lines: [
        "LLMOps & Model Operations: Model versioning, experiment tracking, CI/CD for ML",
        "AI Governance & Compliance: FISMA controls, NIST 800-53 frameworks",
      ],
      bullet: true,
      boldBeforeColon: true,
      justify: true,
    }),

    experience: "",

    certifications: makeSectionXml({
      lines: [
        "**AWS Certified Machine Learning - Specialty**",
        "*TensorFlow Developer Certificate*",
        "__Certified AI Governance Professional__",
      ],
      bullet: true,
      justify: true,
    }),

    education_items: educationItems,
    experience_items: experienceItems,
  };

  doc.render(sampleData);

  return doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
};

const runLibreOfficeConvertForPreview = (inputPath, outputDir) => {
  return new Promise((resolve, reject) => {
    execFile(
      "libreoffice",
      [
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        outputDir,
        inputPath,
      ],
      {
        timeout: 120000,
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error("LibreOffice preview stdout:", stdout);
          console.error("LibreOffice preview stderr:", stderr);
          reject(
            new Error(
              stderr ||
                stdout ||
                error.message ||
                "LibreOffice failed to convert DOCX to PDF."
            )
          );
          return;
        }

        resolve();
      }
    );
  });
};

const validateTemplateBeforeUpload = async (templateBuffer) => {
  let tempDir = null;

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

    if (!validationReport.isValid) {
      return {
        isValid: false,
        message: `Template is invalid:\n${validationReport.errors.join("\n")}`,
        errors: validationReport.errors,
        warnings: validationReport.warnings,
      };
    }

    const docxBuffer = makePreviewDocxBuffer(templateBuffer);

    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "frt-template-validation-")
    );

    const docxPath = path.join(tempDir, "template_validation.docx");

    await fs.writeFile(docxPath, docxBuffer);

    await runLibreOfficeConvertForPreview(docxPath, tempDir);

    return {
      isValid: true,
      message: "Template is valid.",
      errors: [],
      warnings: validationReport.warnings,
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
              "Template preview generation failed. Check placeholders and DOCX formatting.",
          ];

    return {
      isValid: false,
      message: `Could not generate preview resume:\n${errors.join("\n")}`,
      errors,
      warnings: [
        "Make sure every {{@...}} placeholder is alone in its own paragraph.",
        "Make sure loop tags like {{#EXPERIENCE_ITEMS}} and {{/EXPERIENCE_ITEMS}} are correctly opened and closed.",
        "Use normal Enter in Word, not Shift + Enter, around raw placeholders like {{@DETAILS}}.",
      ],
    };
  } finally {
    if (tempDir) {
      try {
        await fs.rm(tempDir, {
          recursive: true,
          force: true,
        });
      } catch (cleanupError) {
        console.error("Template validation cleanup error:", cleanupError.message);
      }
    }
  }
};

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT
          id,
          name,
          description,
          file_name,
          mime_type,
          is_active,
          is_default,
          uploaded_by_admin_id,
          created_at
        FROM resume_templates
        WHERE is_active = true
        ORDER BY is_default DESC, created_at DESC
      `
    );

    return res.json({
      templates: result.rows,
    });
  } catch (error) {
    console.error("Resume templates list error:", error);

    return res.status(500).json({
      message: "Could not load resume templates.",
    });
  }
});

router.get("/:templateId/file", requireAuth, async (req, res) => {
  try {
    const { templateId } = req.params;

    const result = await pool.query(
      `
        SELECT
          id,
          file_name,
          mime_type,
          file_data
        FROM resume_templates
        WHERE id = $1
          AND is_active = true
      `,
      [templateId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Resume template not found.",
      });
    }

    const template = result.rows[0];
    const fileName = safeDownloadFileName(template.file_name);

    res.setHeader("Content-Type", template.mime_type || DOCX_MIME_TYPE);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    return res.send(template.file_data);
  } catch (error) {
    console.error("Resume template file error:", error);

    return res.status(500).json({
      message: "Could not load resume template file.",
    });
  }
});

router.get(
  "/:templateId/preview-pdf",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    let tempDir = null;

    try {
      const { templateId } = req.params;

      const result = await pool.query(
        `
          SELECT
            id,
            name,
            file_name,
            mime_type,
            file_data
          FROM resume_templates
          WHERE id = $1
            AND is_active = true
        `,
        [templateId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "Resume template not found.",
        });
      }

      const template = result.rows[0];

      if (template.mime_type !== DOCX_MIME_TYPE) {
        return res.status(400).json({
          message: "Only DOCX templates can be previewed.",
        });
      }

      const docxBuffer = makePreviewDocxBuffer(template.file_data);

      tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "frt-template-preview-")
      );

      const baseFileName = `template_preview_${template.id}`;
      const docxPath = path.join(tempDir, `${baseFileName}.docx`);
      const pdfPath = path.join(tempDir, `${baseFileName}.pdf`);

      await fs.writeFile(docxPath, docxBuffer);

      await runLibreOfficeConvertForPreview(docxPath, tempDir);

      const pdfBuffer = await fs.readFile(pdfPath);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${baseFileName}.pdf"`
      );

      return res.send(pdfBuffer);
    } catch (error) {
      console.error("Resume template preview error:", error);

      const docxErrors = getDocxtemplaterErrorMessages(error);

      if (docxErrors.length > 0) {
        return res.status(400).json({
          message: `Could not generate preview resume:\n${docxErrors.join(
            "\n"
          )}`,
          errors: docxErrors,
        });
      }

      return res.status(500).json({
        message: `Could not generate preview resume. ${
          error.message || "Unknown preview error."
        }`,
      });
    } finally {
      if (tempDir) {
        try {
          await fs.rm(tempDir, {
            recursive: true,
            force: true,
          });
        } catch (cleanupError) {
          console.error("Preview cleanup error:", cleanupError.message);
        }
      }
    }
  }
);

router.post(
  "/",
  requireAuth,
  requireAdmin,
  upload.single("templateFile"),
  async (req, res) => {
    try {
      const { name, description, isDefault } = req.body;

      const cleanName = String(name || "").trim();
      const cleanDescription = String(description || "").trim();

      if (!cleanName) {
        return res.status(400).json({
          message: "Template name is required.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "DOCX template file is required.",
        });
      }

      if (!isDocxFile(req.file)) {
        return res.status(400).json({
          message: "Only DOCX resume templates are allowed.",
        });
      }

      const validationResult = await validateTemplateBeforeUpload(
        req.file.buffer
      );

      if (!validationResult.isValid) {
        return res.status(400).json({
          message: validationResult.message,
          errors: validationResult.errors || [],
          warnings: validationResult.warnings || [],
        });
      }

      const shouldSetDefault = String(isDefault) === "true";

      const existingActiveTemplates = await pool.query(
        `
          SELECT COUNT(*)::int AS count
          FROM resume_templates
          WHERE is_active = true
        `
      );

      const isFirstTemplate = existingActiveTemplates.rows[0].count === 0;
      const finalIsDefault = shouldSetDefault || isFirstTemplate;

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        if (finalIsDefault) {
          await client.query(
            `
              UPDATE resume_templates
              SET is_default = false
              WHERE is_active = true
            `
          );
        }

        const inserted = await client.query(
          `
            INSERT INTO resume_templates (
              name,
              description,
              file_name,
              mime_type,
              file_data,
              is_active,
              is_default,
              uploaded_by_admin_id
            )
            VALUES ($1, $2, $3, $4, $5, true, $6, $7)
            RETURNING
              id,
              name,
              description,
              file_name,
              mime_type,
              is_active,
              is_default,
              uploaded_by_admin_id,
              created_at
          `,
          [
            cleanName,
            cleanDescription,
            req.file.originalname,
            DOCX_MIME_TYPE,
            req.file.buffer,
            finalIsDefault,
            req.user.id,
          ]
        );

        await client.query("COMMIT");

        return res.status(201).json({
          message: "DOCX resume template uploaded successfully.",
          template: inserted.rows[0],
          warnings: validationResult.warnings || [],
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Resume template upload error:", error);

      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "Template file is too large. Max file size is 10MB.",
        });
      }

      return res.status(500).json({
        message: `Could not upload resume template. ${
          error.message || "Unknown upload error."
        }`,
      });
    }
  }
);

router.patch(
  "/:templateId/default",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { templateId } = req.params;

      const existing = await pool.query(
        `
          SELECT id
          FROM resume_templates
          WHERE id = $1
            AND is_active = true
        `,
        [templateId]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({
          message: "Resume template not found.",
        });
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        await client.query(
          `
            UPDATE resume_templates
            SET is_default = false
            WHERE is_active = true
          `
        );

        const updated = await client.query(
          `
            UPDATE resume_templates
            SET is_default = true
            WHERE id = $1
            RETURNING
              id,
              name,
              description,
              file_name,
              mime_type,
              is_active,
              is_default,
              uploaded_by_admin_id,
              created_at
          `,
          [templateId]
        );

        await client.query("COMMIT");

        return res.json({
          message: "Default resume template updated.",
          template: updated.rows[0],
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Set default template error:", error);

      return res.status(500).json({
        message: "Could not set default template.",
      });
    }
  }
);

router.delete("/:templateId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { templateId } = req.params;

    const existing = await pool.query(
      `
        SELECT id, is_default
        FROM resume_templates
        WHERE id = $1
          AND is_active = true
      `,
      [templateId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        message: "Resume template not found.",
      });
    }

    const wasDefault = existing.rows[0].is_default;

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const removed = await client.query(
        `
          UPDATE resume_templates
          SET
            is_active = false,
            is_default = false
          WHERE id = $1
          RETURNING id, name
        `,
        [templateId]
      );

      if (wasDefault) {
        await client.query(
          `
            UPDATE resume_templates
            SET is_default = true
            WHERE id = (
              SELECT id
              FROM resume_templates
              WHERE is_active = true
              ORDER BY created_at DESC
              LIMIT 1
            )
          `
        );
      }

      await client.query("COMMIT");

      return res.json({
        message: "Resume template removed.",
        template: removed.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Remove template error:", error);

    return res.status(500).json({
      message: "Could not remove resume template.",
    });
  }
});

module.exports = router;