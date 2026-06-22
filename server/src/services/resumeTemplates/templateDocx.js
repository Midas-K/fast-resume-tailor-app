const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const { pathToFileURL } = require("url");
const { repairSplitPlaceholdersInZip } = require("../buildResume/docxPlaceholderRepair");

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const PREVIEW_FONT = "Calibri";
const PREVIEW_FONT_SIZE = "20";
const PREVIEW_COLOR = "111827";
const BULLET_NUM_ID = "99";
const BULLET_ABSTRACT_NUM_ID = "99";

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
  text = "",
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

  repairSplitPlaceholdersInZip(zip);
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

const runLibreOfficeConvertForPreview = async (inputPath, outputDir) => {
  const libreOfficeProfileDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "frt-libreoffice-profile-")
  );

  const userInstallationUrl = pathToFileURL(libreOfficeProfileDir).href;

  const runCommand = (command) => {
    return new Promise((resolve, reject) => {
      execFile(
        command,
        [
          "--headless",
          "--nologo",
          "--nofirststartwizard",
          "--nolockcheck",
          "--nodefault",
          "--convert-to",
          "pdf",
          "--outdir",
          outputDir,
          inputPath,
        ],
        {
          timeout: 120000,
          env: {
            ...process.env,
            HOME: libreOfficeProfileDir,
            UserInstallation: userInstallationUrl,
          },
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(
              new Error(
                [
                  `LibreOffice command failed: ${command}`,
                  stdout ? `stdout: ${stdout}` : "",
                  stderr ? `stderr: ${stderr}` : "",
                  error.message ? `error: ${error.message}` : "",
                ]
                  .filter(Boolean)
                  .join("\n")
              )
            );
            return;
          }

          resolve({
            stdout,
            stderr,
          });
        }
      );
    });
  };

  try {
    try {
      await runCommand("libreoffice");
    } catch (firstError) {
      console.error("libreoffice failed, trying soffice:", firstError.message);
      await runCommand("soffice");
    }

    const expectedPdfPath = path.join(
      outputDir,
      `${path.basename(inputPath, path.extname(inputPath))}.pdf`
    );

    try {
      await fs.access(expectedPdfPath);
    } catch (error) {
      const files = await fs.readdir(outputDir).catch(() => []);

      throw new Error(
        `LibreOffice finished but PDF was not created. Expected: ${expectedPdfPath}. Files in output folder: ${files.join(
          ", "
        )}`
      );
    }
  } finally {
    await fs
      .rm(libreOfficeProfileDir, {
        recursive: true,
        force: true,
      })
      .catch((cleanupError) => {
        console.error(
          "LibreOffice profile cleanup error:",
          cleanupError.message
        );
      });
  }
};
module.exports = {
  DOCX_MIME_TYPE,
  PREVIEW_FONT,
  PREVIEW_FONT_SIZE,
  PREVIEW_COLOR,
  BULLET_NUM_ID,
  BULLET_ABSTRACT_NUM_ID,
  escapeXml,
  decodeXmlEntities,
  stripBullet,
  extractTextFromDocxBuffer,
  parseStyledSegments,
  makeRunXml,
  makeParagraphXml,
  makeSectionXml,
  ensureBulletNumberingXml,
  makePreviewExperienceDetails,
  makePreviewDocxBuffer,
  runLibreOfficeConvertForPreview,
};
