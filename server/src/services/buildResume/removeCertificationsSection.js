const getParagraphText = (paragraphXml) => {
  return (paragraphXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
    .map((token) => token.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>/, ""))
    .join("");
};

const CERTIFICATION_HEADING_PATTERNS = [
  /^licenses and certifications$/i,
  /^licenses & certifications$/i,
  /^certifications and licenses$/i,
  /^certifications & licenses$/i,
  /^professional certifications$/i,
  /^certifications$/i,
  /^certification$/i,
];

const OTHER_SECTION_HEADING_PATTERNS = [
  /^summary$/i,
  /^professional summary$/i,
  /^profile summary$/i,
  /^education$/i,
  /^skills$/i,
  /^technical skills$/i,
  /^core competencies$/i,
  /^experience$/i,
  /^work experience$/i,
  /^professional experience$/i,
  /^employment history$/i,
  /^projects$/i,
  /^references$/i,
];

const normalizeHeadingText = (text) => {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ");
};

const isCertificationHeading = (text) => {
  const normalized = normalizeHeadingText(text);

  if (!normalized) {
    return false;
  }

  return CERTIFICATION_HEADING_PATTERNS.some((pattern) => pattern.test(normalized));
};

const isOtherSectionHeading = (text) => {
  const normalized = normalizeHeadingText(text);

  if (!normalized) {
    return false;
  }

  return OTHER_SECTION_HEADING_PATTERNS.some((pattern) => pattern.test(normalized));
};

const splitDocumentParagraphs = (documentXml) => {
  const paragraphRegex = /<w:p[\s\S]*?<\/w:p>/g;
  const paragraphs = [];
  const spans = [];
  let match;

  while ((match = paragraphRegex.exec(documentXml)) !== null) {
    paragraphs.push(match[0]);
    spans.push({ start: match.index, end: match.index + match[0].length });
  }

  return { paragraphs, spans };
};

const rebuildDocumentWithoutParagraphs = (
  documentXml,
  { paragraphs, spans },
  indicesToRemove
) => {
  const removeSet =
    indicesToRemove instanceof Set ? indicesToRemove : new Set(indicesToRemove);

  if (removeSet.size === 0) {
    return documentXml;
  }

  let result = "";
  let cursor = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const { start, end } = spans[i];

    if (removeSet.has(i)) {
      result += documentXml.slice(cursor, start);
      cursor = end;
    }
  }

  result += documentXml.slice(cursor);
  return result;
};

const findCertificationsPlaceholderParagraphIndex = (documentXml) => {
  const { paragraphs } = splitDocumentParagraphs(documentXml);

  for (let i = 0; i < paragraphs.length; i++) {
    const text = getParagraphText(paragraphs[i]);

    if (text.includes("@CERTIFICATIONS")) {
      return i;
    }
  }

  return -1;
};

const collectCertificationsSectionIndices = (
  paragraphs,
  { certificationsPlaceholderIndex = -1 } = {}
) => {
  const toRemove = new Set();

  if (
    certificationsPlaceholderIndex >= 0 &&
    certificationsPlaceholderIndex < paragraphs.length
  ) {
    toRemove.add(certificationsPlaceholderIndex);

    for (
      let i = certificationsPlaceholderIndex - 1;
      i >= Math.max(0, certificationsPlaceholderIndex - 3);
      i -= 1
    ) {
      const text = getParagraphText(paragraphs[i]).trim();

      if (!text) {
        toRemove.add(i);
        continue;
      }

      if (isCertificationHeading(text)) {
        toRemove.add(i);
        break;
      }

      break;
    }

    for (let j = certificationsPlaceholderIndex + 1; j < paragraphs.length; j += 1) {
      const text = getParagraphText(paragraphs[j]).trim();

      if (isOtherSectionHeading(text)) {
        break;
      }

      if (!text) {
        toRemove.add(j);
        continue;
      }

      break;
    }
  }

  for (let i = 0; i < paragraphs.length; i += 1) {
    if (toRemove.has(i)) {
      continue;
    }

    const text = getParagraphText(paragraphs[i]).trim();

    if (!isCertificationHeading(text)) {
      continue;
    }

    toRemove.add(i);

    for (let j = i + 1; j < paragraphs.length; j += 1) {
      if (toRemove.has(j)) {
        continue;
      }

      const nextText = getParagraphText(paragraphs[j]).trim();

      if (isOtherSectionHeading(nextText) || isCertificationHeading(nextText)) {
        break;
      }

      if (!nextText) {
        toRemove.add(j);
        continue;
      }

      break;
    }
  }

  return toRemove;
};

const removeCertificationsSectionFromDocumentXml = (
  documentXml,
  { certificationsPlaceholderIndex = -1 } = {}
) => {
  const split = splitDocumentParagraphs(documentXml);
  const indicesToRemove = collectCertificationsSectionIndices(split.paragraphs, {
    certificationsPlaceholderIndex,
  });

  return rebuildDocumentWithoutParagraphs(documentXml, split, indicesToRemove);
};

module.exports = {
  CERTIFICATION_HEADING_PATTERNS,
  findCertificationsPlaceholderParagraphIndex,
  removeCertificationsSectionFromDocumentXml,
  getParagraphText,
  isCertificationHeading,
};
