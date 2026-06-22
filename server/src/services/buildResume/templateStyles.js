const PizZip = require("pizzip");

const PLACEHOLDER_MARKERS = {
  SUMMARY: "@SUMMARY",
  SKILLS: "@SKILLS",
  CERTIFICATIONS: "@CERTIFICATIONS",
  DETAILS: "@DETAILS",
  EDUCATION: "@EDUCATION",
  EXPERIENCE: "@EXPERIENCE",
};

const getParagraphText = (paragraphXml) => {
  return (paragraphXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
    .map((token) => token.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>/, ""))
    .join("");
};

const findParagraphXmlContaining = (xml, marker) => {
  const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];

  for (const paragraphXml of paragraphs) {
    const text = getParagraphText(paragraphXml);

    if (text.includes(marker) || text.replace(/\s/g, "").includes(marker)) {
      return paragraphXml;
    }
  }

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

const extractRPrContent = (xmlFragment) => {
  const match = xmlFragment.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
  return match ? match[1].trim() : "";
};

const mergeRunProperties = (primary = "", secondary = "") => {
  let merged = primary || secondary || "";

  if (primary && secondary) {
    merged = primary;

    if (secondary.includes("<w:b") && !merged.includes("<w:b")) {
      merged += "<w:b/>";
    }

    if (secondary.includes("<w:i") && !merged.includes("<w:i")) {
      merged += "<w:i/>";
    }

    if (secondary.includes("<w:u ") && !merged.includes("<w:u")) {
      const underline = secondary.match(/<w:u[^/]*\/>/);
      if (underline) {
        merged += underline[0];
      }
    }

    if (!merged.includes("<w:sz") && secondary.includes("<w:sz")) {
      const size = secondary.match(/<w:sz[^/]*\/>/);
      if (size) {
        merged += size[0];
      }
    }

    if (!merged.includes("<w:szCs") && secondary.includes("<w:szCs")) {
      const sizeCs = secondary.match(/<w:szCs[^/]*\/>/);
      if (sizeCs) {
        merged += sizeCs[0];
      }
    }

    if (!merged.includes("<w:rFonts") && secondary.includes("<w:rFonts")) {
      const fonts = secondary.match(/<w:rFonts[^/]*\/>/);
      if (fonts) {
        merged = fonts[0] + merged;
      }
    }

    if (!merged.includes("<w:color") && secondary.includes("<w:color")) {
      const color = secondary.match(/<w:color[^/]*\/>/);
      if (color) {
        merged += color[0];
      }
    }
  }

  return normalizeRunProperties(merged);
};

const normalizeRunProperties = (rPr = "") => {
  return rPr
    .replace(/\s*w:themeColor="[^"]*"/g, "")
    .replace(/\s*w:themeTint="[^"]*"/g, "")
    .replace(/\s*w:themeShade="[^"]*"/g, "")
    .trim();
};

const extractBaseRPr = (paragraphXml) => {
  const pPrInner = extractPPrInner(paragraphXml);
  const pPrRPr = extractRPrContent(pPrInner);

  const runs = paragraphXml.match(/<w:r[\s\S]*?<\/w:r>/g) || [];
  let runRPr = "";

  for (const run of runs) {
    const content = extractRPrContent(run);
    if (content) {
      runRPr = content;
      break;
    }
  }

  return mergeRunProperties(pPrRPr, runRPr);
};

const normalizePPrInner = (pPrInner = "") => {
  if (!pPrInner) {
    return pPrInner;
  }

  return pPrInner.replace(/<w:rPr>([\s\S]*?)<\/w:rPr>/g, (match, content) => {
    return `<w:rPr>${normalizeRunProperties(content)}</w:rPr>`;
  });
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
  normalizeRunProperties,
  normalizePPrInner,
};
