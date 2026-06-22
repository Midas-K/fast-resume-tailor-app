const PizZip = require("pizzip");

const PLACEHOLDER_MARKERS = {
  SUMMARY: "@SUMMARY",
  SKILLS: "@SKILLS",
  CERTIFICATIONS: "@CERTIFICATIONS",
  DETAILS: "@DETAILS",
  EDUCATION: "@EDUCATION",
  EXPERIENCE: "@EXPERIENCE",
};

const findParagraphXmlContaining = (xml, marker) => {
  const idx = xml.indexOf(marker);
  if (idx < 0) {
    return "";
  }

  const pStart = xml.lastIndexOf("<w:p", idx);
  if (pStart < 0) {
    return "";
  }

  const pEnd = xml.indexOf("</w:p>", idx);
  if (pEnd < 0) {
    return "";
  }

  return xml.slice(pStart, pEnd + 6);
};

const extractPPrInner = (paragraphXml) => {
  const match = paragraphXml.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/);
  return match ? match[1].trim() : "";
};

const extractBaseRPr = (paragraphXml) => {
  const pPrInner = extractPPrInner(paragraphXml);
  const fromParagraphDefault = pPrInner.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);

  if (fromParagraphDefault && fromParagraphDefault[1].trim()) {
    return fromParagraphDefault[1].trim();
  }

  const runs = paragraphXml.match(/<w:r[\s\S]*?<\/w:r>/g) || [];

  for (const run of runs) {
    const rPr = run.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
    if (rPr && rPr[1].trim()) {
      return rPr[1].trim();
    }
  }

  return "";
};

const extractPlaceholderStyles = (templateBuffer) => {
  if (!templateBuffer) {
    return {};
  }

  try {
    const zip = new PizZip(templateBuffer);
    const documentFile = zip.file("word/document.xml");

    if (!documentFile) {
      return {};
    }

    const xml = documentFile.asText();
    const styles = {};

    Object.entries(PLACEHOLDER_MARKERS).forEach(([key, marker]) => {
      const paragraphXml = findParagraphXmlContaining(xml, marker);

      if (!paragraphXml) {
        return;
      }

      styles[key] = {
        pPrInner: extractPPrInner(paragraphXml),
        baseRPr: extractBaseRPr(paragraphXml),
      };
    });

    return styles;
  } catch {
    return {};
  }
};

module.exports = {
  extractPlaceholderStyles,
};
