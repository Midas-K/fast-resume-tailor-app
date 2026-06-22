const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const pool = require("../../db");
const { parseJsonField } = require("../../utils/parse");
const { extractPlaceholderStyles, normalizePPrInner, normalizeRunProperties } = require("./templateStyles");

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const BULLET_NUM_ID = "99";
const BULLET_ABSTRACT_NUM_ID = "99";

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
  const text = String(line || "").trim();

  return text.replace(/^[-•]\s+/, "").replace(/^\*\s+/, "").trim();
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

const createXmlBuilders = (templateStyles = {}) => {
  const getStyle = (styleKey) => templateStyles[styleKey] || {};

  const mergeBoldIntoRPr = (baseRPr, bold) => {
    if (!bold) {
      return baseRPr || "";
    }

    if (baseRPr && /<w:b(?:\/>|>)/.test(baseRPr)) {
      return baseRPr;
    }

    return `${baseRPr || ""}<w:b/>`;
  };

  const buildFallbackPPrContent = ({ bullet, justify }) => {
    const parts = [];

    if (bullet) {
      parts.push(
        `<w:pStyle w:val="ListParagraph"/>
        <w:numPr>
          <w:ilvl w:val="0"/>
          <w:numId w:val="${BULLET_NUM_ID}"/>
        </w:numPr>
        <w:ind w:left="360" w:hanging="180"/>`
      );
    }

    if (justify) {
      parts.push('<w:jc w:val="both"/>');
    }

    parts.push('<w:spacing w:after="80"/>');

    return parts.join("");
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

  const compactBulletPPr = (pPrInner = "") => {
    if (!pPrInner) {
      return pPrInner;
    }

    let cleaned = pPrInner.replace(/<w:tabs>[\s\S]*?<\/w:tabs>/g, "").trim();
    cleaned = cleaned.replace(/<w:ind[^/]*\/>/g, "").trim();

    // Bullet + 2 spaces: hang wrapped lines under the text, not the page margin.
    const bulletIndent = '<w:ind w:left="360" w:hanging="360"/>';

    if (!cleaned.includes("<w:ind")) {
      cleaned = `${cleaned}${bulletIndent}`;
    }

    return cleaned;
  };

  const BULLET_GAP = "  ";

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

  const makeBulletPrefixedRuns = ({ text, styleKey }) => {
    const baseRPr = getNormalizedRPr(styleKey);

    return `
    <w:r>
      <w:rPr>${baseRPr}</w:rPr>
      <w:t xml:space="preserve">•${BULLET_GAP}${escapeXml(text)}</w:t>
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
    const useTextBullet =
      bullet && templatePPr && !templateHasWordBullets && !bold;

    let bodyRuns = "";

    if (useTextBullet && !boldBeforeColon && !/\*\*/.test(cleanText)) {
      bodyRuns = makeBulletPrefixedRuns({
        text: cleanText,
        styleKey,
      });
    } else {
      const segments = bold
        ? [{ text: cleanText, bold: true }]
        : parseBoldSegments(cleanText, { boldBeforeColon });

      bodyRuns = segments
        .map((segment, index) => {
          const run = makeRunXml({
            text: segment.text,
            bold: segment.bold,
            styleKey,
          });

          if (useTextBullet && index === 0) {
            const baseRPr = getNormalizedRPr(styleKey);

            return `
    <w:r>
      <w:rPr>${baseRPr}</w:rPr>
      <w:t xml:space="preserve">•${BULLET_GAP}</w:t>
    </w:r>${run}`;
          }

          return run;
        })
        .join("");
    }

    let pPrContent = templatePPr
      ? normalizePPrInner(templatePPr)
      : buildFallbackPPrContent({ bullet, justify });

    if (useTextBullet && templatePPr) {
      pPrContent = compactBulletPPr(normalizePPrInner(templatePPr));
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

const runLibreOfficeConvert = (inputPath, outputDir) => {
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
          console.error("LibreOffice stdout:", stdout);
          console.error("LibreOffice stderr:", stderr);
          reject(error);
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
    return assignedTemplate.rows[0];
  }

  const defaultTemplate = await pool.query(
    `
      SELECT
        id,
        name,
        file_name,
        mime_type,
        file_data
      FROM resume_templates
      WHERE is_active = true
      ORDER BY is_default DESC, created_at DESC
      LIMIT 1
    `
  );

  if (defaultTemplate.rows.length > 0) {
    return defaultTemplate.rows[0];
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
    const detailsLines = splitCleanLines(item.details).map(stripBullet);

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
  const lines = splitCleanLines(skills).map(stripBullet);

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
  const lines = splitCleanLines(certifications).map(stripBullet);

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

const createDocxBuffer = ({ templateBuffer, data }) => {
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

  doc.render(data);

  return doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
};

const createServiceError = (message, status) => {
  return Object.assign(new Error(message), { status });
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
    } = body;

    if (!profileId) {
      throw createServiceError("Profile is required.", 400);
    }

    if (!roleName || !String(roleName).trim()) {
      throw createServiceError("Role name is required.", 400);
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

    const template = await getAssignedOrDefaultTemplate(profile.id);

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

    const templateStyles = extractPlaceholderStyles(template.file_data);
    const xml = createXmlBuilders(templateStyles);

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
    });

    const safeProfileName = sanitizeFileName(profile.name, "profile");
    const baseFileName = safeProfileName;

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "frt-resume-"));

    const docxPath = path.join(tempDir, `${baseFileName}.docx`);
    const pdfPath = path.join(tempDir, `${baseFileName}.pdf`);

    await fs.writeFile(docxPath, docxBuffer);

    await runLibreOfficeConvert(docxPath, tempDir);

    const pdfBuffer = await fs.readFile(pdfPath);

    return {
      type: "pdf",
      buffer: pdfBuffer,
      fileName: `${baseFileName}.pdf`,
      templateName: template.name,
      templateFileName: template.file_name,
      usesDefaultTemplate: !profile.resume_template_id,
    };
  } finally {
    if (tempDir) {
      try {
        await fs.rm(tempDir, {
          recursive: true,
          force: true,
        });
      } catch (cleanupError) {
        console.error("Temp cleanup error:", cleanupError.message);
      }
    }
  }
}

async function buildResumeFromProfile({ user, body }) {
  const { profileId, roleName, companyName, jobDescription } = body;

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
    },
  });
}

module.exports = { buildResumeFromTemplate, buildResumeFromProfile };
