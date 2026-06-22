const PizZip = require("pizzip");

const decodeXmlEntities = (value) => {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
};

const getParagraphText = (paragraphXml) => {
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
};

const findParagraphByMatch = (documentXml, matcher) => {
  const paragraphs = documentXml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];

  return paragraphs.find((paragraphXml) =>
    matcher(paragraphXml, getParagraphText(paragraphXml))
  );
};

const extractRunProperties = (paragraphXml, placeholderText) => {
  const runs = paragraphXml.match(/<w:r[\s\S]*?<\/w:r>/g) || [];

  for (const runXml of runs) {
    const runText = getParagraphText(runXml);

    if (placeholderText && runText.includes(placeholderText.replace(/[{}@]/g, ""))) {
      const rPr = runXml.match(/<w:rPr[\s\S]*?<\/w:rPr>/);
      if (rPr) {
        return rPr[0];
      }
    }
  }

  for (const runXml of runs) {
    const rPr = runXml.match(/<w:rPr[\s\S]*?<\/w:rPr>/);
    if (rPr) {
      return rPr[0];
    }
  }

  const pPr = paragraphXml.match(/<w:pPr[\s\S]*?<\/w:pPr>/);
  if (pPr) {
    const nestedRPr = pPr[0].match(/<w:rPr[\s\S]*?<\/w:rPr>/);
    if (nestedRPr) {
      return nestedRPr[0];
    }
  }

  return "";
};

const extractParagraphProperties = (paragraphXml) => {
  const pPr = paragraphXml.match(/<w:pPr[\s\S]*?<\/w:pPr>/);
  return pPr ? pPr[0] : "";
};

const getRPrInnerXml = (rPrBlock = "") => {
  if (!rPrBlock) {
    return "";
  }

  return rPrBlock
    .replace(/^<w:rPr[^>]*>/, "")
    .replace(/<\/w:rPr>$/, "")
    .trim();
};

const extractTagXml = (innerXml, tagName) => {
  const pattern = new RegExp(
    `<${tagName}[^>]*/>|<${tagName}>[\\s\\S]*?</${tagName}>`,
    "g"
  );
  const match = String(innerXml || "").match(pattern);
  return match ? match[0] : "";
};

const removeTagXml = (innerXml, tagName) => {
  const pattern = new RegExp(
    `<${tagName}[^>]*/>|<${tagName}>[\\s\\S]*?</${tagName}>`,
    "g"
  );

  return String(innerXml || "").replace(pattern, "");
};

const mergeRunPropertyBlocks = (baseRPr = "", overlayRPr = "") => {
  let inner = getRPrInnerXml(baseRPr);
  const overlayInner = getRPrInnerXml(overlayRPr);

  if (!inner) {
    return overlayRPr;
  }

  if (!overlayInner) {
    return baseRPr;
  }

  [
    "w:rFonts",
    "w:sz",
    "w:szCs",
    "w:color",
    "w:b",
    "w:i",
    "w:u",
    "w:spacing",
  ].forEach((tagName) => {
    const overlayTag = extractTagXml(overlayInner, tagName);

    if (overlayTag) {
      inner = removeTagXml(inner, tagName);
      inner += overlayTag;
    }
  });

  return `<w:rPr>${inner}</w:rPr>`;
};

const extractStyleFromParagraph = (paragraphXml, placeholderText = "") => {
  if (!paragraphXml) {
    return {
      pPr: "",
      rPr: "",
      usesNumbering: false,
    };
  }

  const pPr = extractParagraphProperties(paragraphXml);
  let nestedRPr = "";

  if (pPr) {
    const nestedMatch = pPr.match(/<w:rPr[\s\S]*?<\/w:rPr>/);
    nestedRPr = nestedMatch ? nestedMatch[0] : "";
  }

  const runRPr = extractRunProperties(paragraphXml, placeholderText);
  const rPr = mergeRunPropertyBlocks(nestedRPr, runRPr);

  return {
    pPr,
    rPr,
    usesNumbering: pPr.includes("<w:numPr"),
  };
};

const PLACEHOLDER_LOOKUPS = [
  { key: "SUMMARY", match: (_p, text) => text.includes("{{@SUMMARY}}") },
  { key: "SKILLS", match: (_p, text) => text.includes("{{@SKILLS}}") },
  {
    key: "CERTIFICATIONS",
    match: (_p, text) => text.includes("{{@CERTIFICATIONS}}"),
  },
  { key: "EDUCATION", match: (_p, text) => text.includes("{{@EDUCATION}}") },
  { key: "EXPERIENCE", match: (_p, text) => text.includes("{{@EXPERIENCE}}") },
  { key: "DETAILS", match: (_p, text) => text.includes("{{@DETAILS}}") },
  {
    key: "EXPERIENCE_HEADER",
    match: (_p, text) =>
      text.includes("{{COMPANY_NAME}}") && text.includes("{{TITLE}}"),
  },
  {
    key: "EXPERIENCE_TIMELINE",
    match: (paragraphXml, text) =>
      text === "{{TIMELINE}}" && paragraphXml.includes('w:pos="864"'),
  },
  { key: "EDUCATION_DEGREE", match: (_p, text) => text === "{{DEGREE}}" },
  { key: "EDUCATION_SCHOOL", match: (_p, text) => text === "{{SCHOOL}}" },
];

const extractTemplateStyleMap = (templateBuffer) => {
  const zip = new PizZip(templateBuffer);
  const documentFile = zip.file("word/document.xml");

  if (!documentFile) {
    return {};
  }

  const documentXml = documentFile.asText();
  const styleMap = {};

  PLACEHOLDER_LOOKUPS.forEach(({ key, match }) => {
    const paragraphXml = findParagraphByMatch(documentXml, match);

    if (!paragraphXml) {
      return;
    }

    styleMap[key] = extractStyleFromParagraph(
      paragraphXml,
      key.startsWith("EXPERIENCE") || key === "DETAILS" ? "" : `{{@${key}}}`
    );
  });

  return styleMap;
};

const setBoldInRPrInner = (innerXml, bold) => {
  let next = String(innerXml || "");

  if (bold) {
    if (!/<w:b(?:\s|\/|>)/.test(next)) {
      next = `${next}<w:b/>`;
    }
    return next;
  }

  return next.replace(/<w:b[^>]*\/>/g, "").replace(/<w:b>[^<]*<\/w:b>/g, "");
};

const mergeTemplateRunProperties = (baseRPr = "", { bold = null } = {}) => {
  let merged = getRPrInnerXml(baseRPr);

  if (bold === true) {
    merged = setBoldInRPrInner(merged, true);
  } else if (bold === false) {
    merged = setBoldInRPrInner(merged, false);
  }

  if (!merged) {
    if (bold === true) {
      return "<w:rPr><w:b/></w:rPr>";
    }

    return "";
  }

  return `<w:rPr>${merged}</w:rPr>`;
};

const getSectionStyles = (styleMap, key, fallbackKey) => {
  return styleMap[key] || styleMap[fallbackKey] || {
    pPr: "",
    rPr: "",
    usesNumbering: false,
  };
};

const mergeTemplatePPrWithBullets = (templatePPr, { numId = "99" } = {}) => {
  const leftIndent = 0;
  const hangingIndent = 360;

  if (!templatePPr) {
    return `
      <w:pPr>
        <w:pStyle w:val="ListParagraph"/>
        <w:numPr>
          <w:ilvl w:val="0"/>
          <w:numId w:val="${numId}"/>
        </w:numPr>
        <w:ind w:left="${leftIndent}" w:hanging="${hangingIndent}"/>
      </w:pPr>
    `;
  }

  let inner = templatePPr
    .replace(/^<w:pPr[^>]*>/, "")
    .replace(/<\/w:pPr>$/, "")
    .trim();

  inner = inner.replace(/<w:tabs[\s\S]*?<\/w:tabs>/g, "");
  inner = inner.replace(/<w:numPr[\s\S]*?<\/w:numPr>/g, "");
  inner = inner.replace(/<w:pStyle[^>]*\/>/g, "");
  inner = inner.replace(/<w:pStyle[^>]*>[\s\S]*?<\/w:pStyle>/g, "");
  inner = inner.replace(/<w:ind[^>]*\/>/g, "");

  const bulletBlock = `
    <w:pStyle w:val="ListParagraph"/>
    <w:numPr>
      <w:ilvl w:val="0"/>
      <w:numId w:val="${numId}"/>
    </w:numPr>
    <w:ind w:left="${leftIndent}" w:hanging="${hangingIndent}"/>
  `;

  return `<w:pPr>${bulletBlock}${inner}</w:pPr>`;
};

module.exports = {
  extractTemplateStyleMap,
  getSectionStyles,
  mergeTemplateRunProperties,
  mergeTemplatePPrWithBullets,
};
