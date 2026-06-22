const {
  normalizeRunProperties,
  normalizePPrInner,
} = require("./templateStyles");

const PLACEHOLDERS_TO_REPAIR = [
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
];

const getParagraphText = (paragraphXml) => {
  return (paragraphXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
    .map((token) => token.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>/, ""))
    .join("");
};

const repairSplitPlaceholderParagraph = (paragraphXml, placeholder) => {
  const pPrMatch = paragraphXml.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/);
  const pPr = pPrMatch
    ? `<w:pPr>${normalizePPrInner(pPrMatch[1].trim())}</w:pPr>`
    : "";
  const openTag = paragraphXml.match(/<w:p[^>]*>/)?.[0] || "<w:p>";

  const runs = paragraphXml.match(/<w:r[\s\S]*?<\/w:r>/g) || [];
  let rPrXml = "";

  for (const run of runs) {
    if (!/<w:t[^>]*>/.test(run) || /<w:drawing>/.test(run)) {
      continue;
    }

    const rPrMatch = run.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);

    if (rPrMatch) {
      rPrXml = `<w:rPr>${normalizeRunProperties(rPrMatch[1])}</w:rPr>`;
      break;
    }
  }

  return `${openTag}${pPr}<w:r>${rPrXml}<w:t>${placeholder}</w:t></w:r></w:p>`;
};

const repairSplitPlaceholdersInDocumentXml = (documentXml) => {
  return documentXml.replace(/<w:p[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const joinedText = getParagraphText(paragraphXml);

    for (const placeholder of PLACEHOLDERS_TO_REPAIR) {
      if (!joinedText.includes(placeholder)) {
        continue;
      }

      if (paragraphXml.includes(placeholder)) {
        continue;
      }

      return repairSplitPlaceholderParagraph(paragraphXml, placeholder);
    }

    return paragraphXml;
  });
};

const findSplitPlaceholders = (documentXml) => {
  const splitPlaceholders = [];

  PLACEHOLDERS_TO_REPAIR.forEach((placeholder) => {
    if (documentXml.includes(placeholder)) {
      return;
    }

    const paragraphs = documentXml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];

    for (const paragraphXml of paragraphs) {
      if (getParagraphText(paragraphXml).includes(placeholder)) {
        splitPlaceholders.push(placeholder);
        break;
      }
    }
  });

  return splitPlaceholders;
};

const repairSplitPlaceholdersInZip = (zip) => {
  const documentFile = zip.file("word/document.xml");

  if (!documentFile) {
    return zip;
  }

  const repairedXml = repairSplitPlaceholdersInDocumentXml(documentFile.asText());
  zip.file("word/document.xml", repairedXml);

  return zip;
};

module.exports = {
  PLACEHOLDERS_TO_REPAIR,
  repairSplitPlaceholdersInDocumentXml,
  repairSplitPlaceholdersInZip,
  findSplitPlaceholders,
};
