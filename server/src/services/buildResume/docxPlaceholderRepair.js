const {
  normalizeRunProperties,
  normalizePPrInner,
  mergePlaceholderRunRPr,
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

const getParagraphRuns = (paragraphXml) => {
  return paragraphXml.match(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g) || [];
};

const getRunText = (runXml) => {
  return (runXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
    .map((token) => token.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>/, ""))
    .join("");
};

const extractRPrContent = (xmlFragment) => {
  const match = xmlFragment.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
  return match ? match[1].trim() : "";
};

const shouldMergeTextRuns = (left, right) => {
  const combined = `${left}${right}`;

  if (PLACEHOLDERS_TO_REPAIR.includes(combined)) {
    return true;
  }

  if (left.includes("{{") && !left.includes("}}")) {
    return true;
  }

  if (right.includes("}}") && !right.includes("{{")) {
    return true;
  }

  return PLACEHOLDERS_TO_REPAIR.some(
    (placeholder) =>
      placeholder.includes(combined) && combined.length < placeholder.length
  );
};

const buildTextRunXml = ({ text, openTag, rPr, preserveSpace }) => {
  const rPrXml = rPr ? `<w:rPr>${normalizeRunProperties(rPr)}</w:rPr>` : "";
  const spaceAttr = preserveSpace ? ' xml:space="preserve"' : "";

  return `${openTag}${rPrXml}<w:t${spaceAttr}>${text}</w:t></w:r>`;
};

const mergeBrokenTextRunsInParagraph = (paragraphXml) => {
  const openTag = paragraphXml.match(/<w:p[^>]*>/)?.[0] || "<w:p>";
  const pPrMatch = paragraphXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  const pPr = pPrMatch ? pPrMatch[0] : "";
  const bodyWithoutPPr = paragraphXml
    .replace(/^<w:p[^>]*>/, "")
    .replace(/<\/w:p>$/, "")
    .replace(/<w:pPr>[\s\S]*?<\/w:pPr>/, "");
  const tokens =
    bodyWithoutPPr.match(
      /<w:bookmarkStart[^>]*\/>|<w:bookmarkEnd[^>]*\/>|<w:r[\s\S]*?<\/w:r>/g
    ) || [];
  const mergedTokens = [];
  let pendingTextRuns = [];

  const flushTextRuns = () => {
    if (pendingTextRuns.length === 0) {
      return;
    }

    let runs = [...pendingTextRuns];
    let changed = true;

    while (changed && runs.length > 1) {
      changed = false;

      for (let index = 0; index < runs.length - 1; index += 1) {
        if (!shouldMergeTextRuns(runs[index].text, runs[index + 1].text)) {
          continue;
        }

        runs[index] = {
          text: runs[index].text + runs[index + 1].text,
          openTag: runs[index].openTag,
          rPr: runs[index].rPr || runs[index + 1].rPr,
          preserveSpace:
            runs[index].preserveSpace || runs[index + 1].preserveSpace,
        };
        runs.splice(index + 1, 1);
        changed = true;
        break;
      }
    }

    runs.forEach((run) => {
      mergedTokens.push(buildTextRunXml(run));
    });
    pendingTextRuns = [];
  };

  tokens.forEach((token) => {
    if (token.startsWith("<w:bookmark")) {
      flushTextRuns();
      mergedTokens.push(token);
      return;
    }

    if (!/<w:t[^>]*>/.test(token) || /<w:drawing>/.test(token)) {
      flushTextRuns();
      mergedTokens.push(token);
      return;
    }

    pendingTextRuns.push({
      text: getRunText(token),
      openTag: token.match(/<w:r[^>]*>/)?.[0] || "<w:r>",
      rPr: extractRPrContent(token),
      preserveSpace: /xml:space="preserve"/.test(token),
    });
  });

  flushTextRuns();

  return `${openTag}${pPr}${mergedTokens.join("")}</w:p>`;
};

const repairSplitPlaceholderParagraph = (paragraphXml, placeholder) => {
  const pPrMatch = paragraphXml.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/);
  const pPr = pPrMatch
    ? `<w:pPr>${normalizePPrInner(pPrMatch[1].trim())}</w:pPr>`
    : "";
  const openTag = paragraphXml.match(/<w:p[^>]*>/)?.[0] || "<w:p>";
  const mergedRPr = mergePlaceholderRunRPr(paragraphXml);
  const rPrXml = mergedRPr ? `<w:rPr>${mergedRPr}</w:rPr>` : "";

  return `${openTag}${pPr}<w:r>${rPrXml}<w:t>${placeholder}</w:t></w:r></w:p>`;
};

const repairParagraph = (paragraphXml) => {
  const joinedText = getParagraphText(paragraphXml);
  const splitPlaceholders = PLACEHOLDERS_TO_REPAIR.filter(
    (placeholder) =>
      joinedText.includes(placeholder) && !paragraphXml.includes(placeholder)
  );

  if (splitPlaceholders.length === 0) {
    return paragraphXml;
  }

  const trimmed = joinedText.trim();

  if (splitPlaceholders.length === 1 && trimmed === splitPlaceholders[0]) {
    return repairSplitPlaceholderParagraph(
      paragraphXml,
      splitPlaceholders[0]
    );
  }

  return mergeBrokenTextRunsInParagraph(paragraphXml);
};

const repairSplitPlaceholdersInDocumentXml = (documentXml) => {
  return documentXml.replace(/<w:p[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    return repairParagraph(paragraphXml);
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
