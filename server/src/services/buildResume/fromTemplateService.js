const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const pool = require("../../db");
const { parseJsonField } = require("../../utils/parse");
const {
  assertApplicationIsNew,
  getDailySequenceNumber,
  recordApplicationAfterResume,
} = require("../applications/applicationService");
const {
  extractPlaceholderStyles,
  extractBulletListConfig,
  normalizePPrInner,
  normalizeRunProperties,
  applyBoldToRPr,
} = require("./templateStyles");
const { repairSplitPlaceholdersInZip } = require("./docxPlaceholderRepair");
const { runLibreOfficeConvert } = require("./libreOfficeConvert");

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const BULLET_NUM_ID = "99";
const BULLET_ABSTRACT_NUM_ID = "99";

const templatePrepCache = new Map();
const templateRowCache = new Map();

const cacheTemplateRow = (template) => {
  if (!template?.id) {
    return template;
  }

  templateRowCache.set(String(template.id), template);
  return template;
};

const getCachedTemplateRow = (templateId) => {
  if (!templateId) {
    return null;
  }

  return templateRowCache.get(String(templateId)) || null;
};

const getTemplatePrep = (templateId, fileData) => {
  const cacheKey = String(templateId);

  if (templatePrepCache.has(cacheKey)) {
    return templatePrepCache.get(cacheKey);
  }

  const prep = {
    templateStyles: extractPlaceholderStyles(fileData),
    bulletConfig: extractBulletListConfig(fileData),
  };

  templatePrepCache.set(cacheKey, prep);

  return prep;
};

const sanitizeFileName = (value, fallback = "resume") => {
  const clean = String(value || "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");

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

const stripBullet = (line) => {
  return String(line || "")
    .trim()
    .replace(/^[-•*●○◦+]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/^>\s+/, "")
    .trim();
};

const splitBulletLines = (value) => {
  return splitCleanLines(value).map(stripBullet).filter(Boolean);
};

const splitCleanLines = (value) => {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
};

const parseBoldSegments = (text, options = {}) => {
  const { boldBeforeColon = false } = options;
  const cleanText = String(text || "").trim();

  if (!cleanText) return [];

  const segments = [];
  const regex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(cleanText)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: cleanText.slice(lastIndex, match.index),
        bold: false,
      });
    }

    segments.push({
      text: match[1],
      bold: true,
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < cleanText.length) {
    segments.push({
      text: cleanText.slice(lastIndex),
      bold: false,
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
    });

    rebuilt.push({
      text: segment.text.slice(splitAt),
      bold: segment.bold,
    });
  });

  return rebuilt.filter((segment) => segment.text);
};

const createXmlBuilders = (templateStyles = {}, bulletConfig = {}) => {
  const getStyle = (styleKey) => templateStyles[styleKey] || {};
  const listConfig = {
    numId: bulletConfig.numId || BULLET_NUM_ID,
    left: bulletConfig.left || "720",
    hanging: bulletConfig.hanging || "360",
  };

  const getSectionNumId = (styleKey) => {
    const templatePPr = getStyle(styleKey).pPrInner || "";
    const match = templatePPr.match(
      /<w:numPr>[\s\S]*?<w:numId w:val="(\d+)"/
    );

    if (match) {
      return match[1];
    }

    return listConfig.numId;
  };

  const mergeBoldIntoRPr = (baseRPr, bold) => {
    if (!bold) {
      return baseRPr || "";
    }

    return applyBoldToRPr(baseRPr || "");
  };

  const extractTemplateParagraphExtras = (pPrInner = "") => {
    const normalized = normalizePPrInner(pPrInner);
    const parts = [];

    const jc = normalized.match(/<w:jc[^/]*\/>/);

    if (jc) {
      parts.push(jc[0]);
    }

    const spacing = normalized.match(/<w:spacing[^/]*\/>/);

    if (spacing) {
      parts.push(spacing[0]);
    }

    const pPrRPr = normalized.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);

    if (pPrRPr) {
      parts.push(pPrRPr[0]);
    }

    return parts.join("");
  };

  const extractReferenceLeft = (pPrInner = "") => {
    const normalized = normalizePPrInner(pPrInner);
    const ind = normalized.match(/<w:ind[^/]*\/>/);

    if (ind) {
      const left = ind[0].match(/w:left="(\d+)"/);

      if (left) {
        return left[1];
      }
    }

    return "0";
  };

  const computeBulletLeft = (templatePPr = "") => {
    const referenceLeft = Number(extractReferenceLeft(templatePPr));
    const hanging = Number(listConfig.hanging);

    return String(referenceLeft + hanging);
  };

  const buildWordBulletPPr = ({
    templatePPr,
    justify,
    left,
    styleKey = "SUMMARY",
  }) => {
    const bulletLeft = left || listConfig.left;
    const sectionNumId = getSectionNumId(styleKey);
    const extras = templatePPr ? extractTemplateParagraphExtras(templatePPr) : "";
    const parts = [
      '<w:pStyle w:val="ListParagraph"/>',
      `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${sectionNumId}"/></w:numPr>`,
      `<w:ind w:left="${bulletLeft}" w:hanging="${listConfig.hanging}"/>`,
      extras,
    ];

    if (!extras.includes("<w:jc") && justify) {
      parts.push('<w:jc w:val="both"/>');
    }

    if (!extras.includes("<w:spacing")) {
      parts.push('<w:spacing w:after="80"/>');
    }

    return parts.filter(Boolean).join("");
  };

  const buildFallbackPPrContent = ({
    bullet,
    justify,
    templatePPr,
    styleKey = "SUMMARY",
  }) => {
    if (bullet) {
      return buildWordBulletPPr({
        templatePPr: templatePPr || "",
        justify,
        left: computeBulletLeft(templatePPr),
        styleKey,
      });
    }

    const parts = [];

    if (justify) {
      parts.push('<w:jc w:val="both"/>');
    }

    parts.push('<w:spacing w:after="80"/>');

    return parts.join("");
  };

  const getNormalizedRPr = (styleKey) => {
    let rPr = normalizeRunProperties(getStyle(styleKey).baseRPr || "");

    if (!/<w:sz/.test(rPr)) {
      const summaryRPr = normalizeRunProperties(getStyle("SUMMARY").baseRPr || "");
      const size = summaryRPr.match(/<w:sz[^/]*\/>/);
      const sizeCs = summaryRPr.match(/<w:szCs[^/]*\/>/);

      if (size) {
        rPr += size[0];
      }

      if (sizeCs) {
        rPr += sizeCs[0];
      }
    }

    if (!/<w:rFonts/.test(rPr)) {
      const summaryRPr = normalizeRunProperties(getStyle("SUMMARY").baseRPr || "");
      const fonts = summaryRPr.match(/<w:rFonts[^/]*\/>/);

      if (fonts) {
        rPr = fonts[0] + rPr;
      }
    }

    return rPr;
  };

  const makeRunXml = ({ text, bold = false, styleKey = "SUMMARY" }) => {
    const baseRPr = getNormalizedRPr(styleKey);
    const rPr = mergeBoldIntoRPr(baseRPr, bold);

    return `
    <w:r>
      <w:rPr>${rPr}</w:rPr>
      <w:t xml:space="preserve">${escapeXml(text)}</w:t>
    </w:r>
  `;
  };

  const makeParagraphXml = ({
    text = "",
    bold = false,
    bullet = false,
    justify = true,
    boldBeforeColon = false,
    styleKey = "SUMMARY",
  }) => {
    const cleanText = bullet ? stripBullet(text) : String(text || "").trim();

    if (!cleanText) return "";

    const templatePPr = getStyle(styleKey).pPrInner;
    const templateHasWordBullets = /<w:numPr>/.test(templatePPr || "");

    const segments = bold
      ? [{ text: cleanText, bold: true }]
      : parseBoldSegments(cleanText, { boldBeforeColon });

    const bodyRuns = segments
      .map((segment) =>
        makeRunXml({
          text: segment.text,
          bold: segment.bold,
          styleKey,
        })
      )
      .join("");

    let pPrContent;

    if (bullet) {
      if (templateHasWordBullets) {
        // Clone the template list paragraph exactly (ListParagraph + numPr).
        // FULL.docx-style templates already define the bullet in the placeholder row.
        pPrContent = normalizePPrInner(templatePPr);
      } else {
        pPrContent = buildWordBulletPPr({
          templatePPr,
          justify,
          left: computeBulletLeft(templatePPr),
          styleKey,
        });
      }
    } else {
      pPrContent = templatePPr
        ? normalizePPrInner(templatePPr)
        : buildFallbackPPrContent({ bullet: false, justify, styleKey });
    }

    return `
    <w:p>
      <w:pPr>${pPrContent}</w:pPr>
      ${bodyRuns}
    </w:p>
  `;
  };

  const makeBlankParagraphXml = () => {
    return `
    <w:p>
      <w:pPr>
        <w:spacing w:after="80"/>
      </w:pPr>
    </w:p>
  `;
  };

  const makeSectionXmlFromLines = ({
    lines,
    bullet = false,
    boldBeforeColon = false,
    justify = true,
    styleKey = "SUMMARY",
  }) => {
    return lines
      .map((line) =>
        makeParagraphXml({
          text: line,
          bullet,
          boldBeforeColon,
          justify,
          styleKey,
        })
      )
      .join("");
  };

  return {
    makeParagraphXml,
    makeBlankParagraphXml,
    makeSectionXmlFromLines,
  };
};

const defaultXmlBuilders = createXmlBuilders();

const buildContact = ({ email, location, phone, links }) => {
  return [email, location, phone, links]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" • ");
};

const getAssignedOrDefaultTemplate = async (profileId) => {
  const assignedTemplate = await pool.query(
    `
      SELECT
        resume_templates.id,
        resume_templates.name,
        resume_templates.file_name,
        resume_templates.mime_type,
        resume_templates.file_data
      FROM profiles
      JOIN resume_templates
        ON resume_templates.id = profiles.resume_template_id
       AND resume_templates.is_active = true
      WHERE profiles.id = $1
      LIMIT 1
    `,
    [profileId]
  );

  if (assignedTemplate.rows.length > 0) {
    return cacheTemplateRow(assignedTemplate.rows[0]);
  }

  const cachedDefault = [...templateRowCache.values()].find(
    (template) => template?.is_default
  );

  if (cachedDefault) {
    return cachedDefault;
  }

  const defaultTemplate = await pool.query(
    `
      SELECT
        id,
        name,
        file_name,
        mime_type,
        file_data,
        is_default
      FROM resume_templates
      WHERE is_active = true
      ORDER BY is_default DESC, created_at DESC
      LIMIT 1
    `
  );

  if (defaultTemplate.rows.length > 0) {
    return cacheTemplateRow(defaultTemplate.rows[0]);
  }

  return null;
};

const formatEducationItems = (educationValue, profileLocation = "") => {
  const educationList = parseJsonField(educationValue);

  return educationList.map((item) => {
    const school = item.school || item.university || "";
    const degree = item.degree || "";
    const major = item.major || "";
    const timeline = item.timeline || "";
    const location = item.location || profileLocation || "";

    const degreeMajor = [degree, major]
      .filter((value) => value && String(value).trim())
      .join(" in ");

    const schoolDegreeMajor = [school, degree, major]
      .filter((value) => value && String(value).trim())
      .join(", ");

    return {
      SCHOOL: school,
      DEGREE: degree,
      MAJOR: major,
      TIMELINE: timeline,
      LOCATION: location,
      DEGREE_MAJOR: degreeMajor,
      SCHOOL_DEGREE_MAJOR: schoolDegreeMajor,

      school,
      degree,
      major,
      timeline,
      location,
      degree_major: degreeMajor,
      school_degree_major: schoolDegreeMajor,
    };
  });
};

const formatExperienceItems = (
  experienceInputs,
  profileLocation = "",
  xml = defaultXmlBuilders
) => {
  if (!Array.isArray(experienceInputs)) return [];

  return experienceInputs.map((item) => {
    const companyName = item.companyName || "";
    const title = item.title || "";
    const timeline = item.timeline || "";
    const location = item.location || profileLocation || "";
    const detailsLines = splitBulletLines(item.details);

    const titleCompany = [title, companyName]
      .filter((value) => value && String(value).trim())
      .join(" - ");

    const companyTitle = [companyName, title]
      .filter((value) => value && String(value).trim())
      .join(" - ");

    const detailsXml = xml.makeSectionXmlFromLines({
      lines: detailsLines,
      bullet: true,
      justify: true,
      styleKey: "DETAILS",
    });

    return {
      COMPANY_NAME: companyName,
      TITLE: title,
      TIMELINE: timeline,
      LOCATION: location,
      TITLE_COMPANY: titleCompany,
      COMPANY_TITLE: companyTitle,
      DETAILS: detailsXml,

      companyName,
      company_name: companyName,
      title,
      timeline,
      location,
      title_company: titleCompany,
      company_title: companyTitle,
      details: detailsXml,
    };
  });
};

const formatEducationXml = (educationValue, xml = defaultXmlBuilders) => {
  const educationItems = formatEducationItems(educationValue);

  if (educationItems.length === 0) {
    return "";
  }

  return educationItems
    .map((item) => {
      const lineOne = [item.SCHOOL, item.DEGREE, item.MAJOR]
        .filter((value) => value && String(value).trim())
        .join(", ");

      const finalLine = item.TIMELINE
        ? `${lineOne} | ${item.TIMELINE}`
        : lineOne;

      return xml.makeParagraphXml({
        text: finalLine,
        justify: true,
        styleKey: "EDUCATION",
      });
    })
    .join("");
};

const formatSummaryXml = (summary, xml = defaultXmlBuilders) => {
  const lines = splitCleanLines(summary);

  if (lines.length === 0) return "";

  return xml.makeSectionXmlFromLines({
    lines,
    bullet: false,
    justify: true,
    styleKey: "SUMMARY",
  });
};

const formatSkillsXml = (skills, xml = defaultXmlBuilders) => {
  const lines = splitBulletLines(skills);

  if (lines.length === 0) return "";

  return xml.makeSectionXmlFromLines({
    lines,
    bullet: true,
    boldBeforeColon: true,
    justify: true,
    styleKey: "SKILLS",
  });
};

const formatCertificationsXml = (certifications, xml = defaultXmlBuilders) => {
  const lines = splitBulletLines(certifications);

  if (lines.length === 0) return "";

  return xml.makeSectionXmlFromLines({
    lines,
    bullet: true,
    justify: true,
    styleKey: "CERTIFICATIONS",
  });
};

const formatExperienceXml = (experienceInputs, xml = defaultXmlBuilders) => {
  const experienceItems = formatExperienceItems(experienceInputs, "", xml);

  if (experienceItems.length === 0) {
    return "";
  }

  return experienceItems
    .map((item) => {
      const header = item.TIMELINE
        ? `${item.TITLE_COMPANY} | ${item.TIMELINE}`
        : item.TITLE_COMPANY;

      const headerXml = xml.makeParagraphXml({
        text: header,
        bold: true,
        justify: false,
        styleKey: "EXPERIENCE",
      });

      return `${headerXml}${item.DETAILS}${xml.makeBlankParagraphXml()}`;
    })
    .join("");
};

const ensureBulletNumberingXml = (zip, bulletConfig = {}) => {
  if (bulletConfig.useTemplateNumId) {
    return;
  }

  const numberingPath = "word/numbering.xml";
  const relsPath = "word/_rels/document.xml.rels";
  const contentTypesPath = "[Content_Types].xml";

  const left = bulletConfig.left || "720";
  const hanging = bulletConfig.hanging || "360";

  const bulletDefinition = `
  <w:abstractNum w:abstractNumId="${BULLET_ABSTRACT_NUM_ID}">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="•"/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="${left}" w:hanging="${hanging}"/>
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

const createDocxBuffer = ({ templateBuffer, data, bulletConfig = {} }) => {
  const zip = new PizZip(templateBuffer);

  repairSplitPlaceholdersInZip(zip);
  ensureBulletNumberingXml(zip, bulletConfig);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: {
      start: "{{",
      end: "}}",
    },
  });

  doc.render(data);

  return doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
};

const createServiceError = (message, status) => {
  return Object.assign(new Error(message), { status });
};

const mapServiceError = (error) => {
  if (error?.status && error?.message) {
    throw createServiceError(error.message, error.status);
  }

  throw error;
};

async function buildResumeFromTemplate({ user, body }) {
  let tempDir = null;

  try {
    const {
      profileId,
      roleName,
      companyName,
      summary,
      skills,
      certification,
      certifications,
      experienceInputs,
      links,
      dayStart,
      dayEnd,
      recordApplication = true,
      allowReapply = false,
    } = body;

    if (!profileId) {
      throw createServiceError("Profile is required.", 400);
    }

    if (!roleName || !String(roleName).trim()) {
      throw createServiceError("Role name is required.", 400);
    }

    const profileQuery = pool.query(
      `
        SELECT
          id,
          user_id,
          name,
          location,
          phone,
          email,
          education,
          experience,
          resume_template_id
        FROM profiles
        WHERE id = $1
          AND user_id = $2
      `,
      [profileId, user.id]
    );

    const templateQuery = getAssignedOrDefaultTemplate(profileId);

    const sequenceQuery =
      recordApplication && dayStart && dayEnd
        ? getDailySequenceNumber({
            profileId,
            userId: user.id,
            dayStart,
            dayEnd,
          })
        : Promise.resolve(null);

    const duplicateCheckQuery = recordApplication
      ? assertApplicationIsNew({
          profileId,
          userId: user.id,
          companyName,
          roleName,
          allowReapply,
        })
      : Promise.resolve();

    let profileResult;
    let sequenceNumber;
    let template;

    try {
      [, profileResult, sequenceNumber, template] = await Promise.all([
        duplicateCheckQuery,
        profileQuery,
        sequenceQuery,
        templateQuery,
      ]);
    } catch (error) {
      mapServiceError(error);
    }

    if (profileResult.rows.length === 0) {
      throw createServiceError("Selected profile was not found.", 404);
    }

    const profile = profileResult.rows[0];

    if (!template) {
      const cachedTemplate = getCachedTemplateRow(profile.resume_template_id);

      if (cachedTemplate) {
        template = cachedTemplate;
      }
    }

    if (!template) {
      throw createServiceError(
        "No DOCX resume template found. Please ask admin to upload a template.",
        404
      );
    }

    if (template.mime_type !== DOCX_MIME_TYPE) {
      throw createServiceError(
        "The selected resume template is not a DOCX file. Please upload a DOCX template.",
        400
      );
    }

    const finalCertifications = certification || certifications || "";

    const { templateStyles, bulletConfig } = getTemplatePrep(
      template.id,
      template.file_data
    );
    const xml = createXmlBuilders(templateStyles, bulletConfig);

    const contact = buildContact({
      email: profile.email,
      location: profile.location,
      phone: profile.phone,
      links,
    });

    const educationItems = formatEducationItems(
      profile.education,
      profile.location
    );
    
    const experienceItems = formatExperienceItems(
      experienceInputs,
      profile.location,
      xml
    );

    const data = {
      FULL_NAME: profile.name || "",
      TITLE: String(roleName || "").trim(),
      EMAIL: profile.email || "",
      LOCATION: profile.location || "",
      PHONE: profile.phone || "",
      LINKS: links || "",
      CONTACT: contact,

      SUMMARY: formatSummaryXml(summary, xml),
      EDUCATION: formatEducationXml(profile.education, xml),
      SKILLS: formatSkillsXml(skills, xml),
      EXPERIENCE: formatExperienceXml(experienceInputs, xml),
      CERTIFICATIONS: formatCertificationsXml(finalCertifications, xml),

      EDUCATION_ITEMS: educationItems,
      EXPERIENCE_ITEMS: experienceItems,

      full_name: profile.name || "",
      title: String(roleName || "").trim(),
      email: profile.email || "",
      location: profile.location,
      phone: profile.phone,
      links: links || "",
      contact,

      summary: formatSummaryXml(summary, xml),
      education: formatEducationXml(profile.education, xml),
      skills: formatSkillsXml(skills, xml),
      experience: formatExperienceXml(experienceInputs, xml),
      certifications: formatCertificationsXml(finalCertifications, xml),

      education_items: educationItems,
      experience_items: experienceItems,
    };

    const docxBuffer = createDocxBuffer({
      templateBuffer: template.file_data,
      data,
      bulletConfig,
    });

    const safeProfileName = sanitizeFileName(profile.name, "profile");
    const baseFileName = safeProfileName;

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "frt-resume-"));

    const docxPath = path.join(tempDir, `${baseFileName}.docx`);
    const pdfPath = path.join(tempDir, `${baseFileName}.pdf`);

    await fs.writeFile(docxPath, docxBuffer);

    await runLibreOfficeConvert(docxPath, tempDir);

    const pdfBuffer = await fs.readFile(pdfPath);

    if (recordApplication) {
      recordApplicationAfterResume({
        userId: user.id,
        profileId,
        companyName,
        roleName,
        allowReapply,
      }).catch((error) => {
        console.error("Deferred application record error:", error.message);
      });
    }

    return {
      type: "pdf",
      buffer: pdfBuffer,
      fileName: `${baseFileName}.pdf`,
      templateName: template.name,
      templateFileName: template.file_name,
      usesDefaultTemplate: !profile.resume_template_id,
      sequenceNumber,
    };
  } finally {
    if (tempDir) {
      fs.rm(tempDir, {
        recursive: true,
        force: true,
      }).catch((cleanupError) => {
        console.error("Temp cleanup error:", cleanupError.message);
      });
    }
  }
}

async function buildResumeFromProfile({ user, body }) {
  const {
    profileId,
    roleName,
    companyName,
    jobDescription,
    dayStart,
    dayEnd,
    recordApplication = true,
    allowReapply = false,
  } = body;

  if (!profileId) {
    throw createServiceError("Profile is required.", 400);
  }

  if (!roleName || !String(roleName).trim()) {
    throw createServiceError("Role name is required.", 400);
  }

  if (!companyName || !String(companyName).trim()) {
    throw createServiceError("Company name is required.", 400);
  }

  if (!jobDescription || !String(jobDescription).trim()) {
    throw createServiceError("Job description is required.", 400);
  }

  const profileResult = await pool.query(
    `
      SELECT
        id,
        user_id,
        name,
        location,
        phone,
        email,
        education,
        experience,
        resume_template_id
      FROM profiles
      WHERE id = $1
        AND user_id = $2
    `,
    [profileId, user.id]
  );

  if (profileResult.rows.length === 0) {
    throw createServiceError("Selected profile was not found.", 404);
  }

  const profile = profileResult.rows[0];
  const experienceList = parseJsonField(profile.experience);

  if (experienceList.length === 0) {
    throw createServiceError(
      "Add at least one experience item to your profile before building a resume.",
      400
    );
  }

  const template = await getAssignedOrDefaultTemplate(profile.id);

  if (!template) {
    throw createServiceError(
      "No DOCX resume template found. Please ask admin to upload a template.",
      404
    );
  }

  const experienceInputs = experienceList.map((item) => ({
    companyName: item.companyName || "",
    title: item.title || "",
    timeline: item.timeline || "",
    location: item.location || profile.location || "",
    details: item.details || "",
  }));

  return buildResumeFromTemplate({
    user,
    body: {
      profileId,
      roleName: String(roleName).trim(),
      companyName: String(companyName).trim(),
      summary: "",
      skills: "",
      certification: "",
      experienceInputs,
      dayStart,
      dayEnd,
      recordApplication,
      allowReapply,
    },
  });
}

const buildDocxFromTemplateBuffer = ({
  templateBuffer,
  summary = "",
  skills = "",
  certification = "",
  experienceInputs = [],
  profile = {},
  roleName = "",
}) => {
  const { templateStyles, bulletConfig } = {
    templateStyles: extractPlaceholderStyles(templateBuffer),
    bulletConfig: extractBulletListConfig(templateBuffer),
  };
  const xml = createXmlBuilders(templateStyles, bulletConfig);
  const experienceItems = formatExperienceItems(
    experienceInputs,
    profile.location || "",
    xml
  );
  const educationItems = formatEducationItems(
    profile.education || [],
    profile.location || ""
  );
  const finalCertifications = certification || "";

  const data = {
    FULL_NAME: profile.name || "",
    TITLE: String(roleName || "").trim(),
    EMAIL: profile.email || "",
    LOCATION: profile.location || "",
    PHONE: profile.phone || "",
    LINKS: "",
    CONTACT: buildContact({
      email: profile.email,
      location: profile.location,
      phone: profile.phone,
      links: "",
    }),
    SUMMARY: formatSummaryXml(summary, xml),
    EDUCATION: formatEducationXml(profile.education, xml),
    SKILLS: formatSkillsXml(skills, xml),
    EXPERIENCE: formatExperienceXml(experienceInputs, xml),
    CERTIFICATIONS: formatCertificationsXml(finalCertifications, xml),
    EDUCATION_ITEMS: educationItems,
    EXPERIENCE_ITEMS: experienceItems,
    full_name: profile.name || "",
    title: String(roleName || "").trim(),
    email: profile.email || "",
    location: profile.location || "",
    phone: profile.phone || "",
    links: "",
    contact: buildContact({
      email: profile.email,
      location: profile.location,
      phone: profile.phone,
      links: "",
    }),
    summary: formatSummaryXml(summary, xml),
    education: formatEducationXml(profile.education, xml),
    skills: formatSkillsXml(skills, xml),
    experience: formatExperienceXml(experienceInputs, xml),
    certifications: formatCertificationsXml(finalCertifications, xml),
    education_items: educationItems,
    experience_items: experienceItems,
  };

  return createDocxBuffer({
    templateBuffer,
    data,
    bulletConfig,
  });
};

module.exports = {
  buildResumeFromTemplate,
  buildResumeFromProfile,
  buildDocxFromTemplateBuffer,
};
