const assert = require("assert");
const {
  findCertificationsPlaceholderParagraphIndex,
  removeCertificationsSectionFromDocumentXml,
  getParagraphText,
  isCertificationHeading,
} = require("./removeCertificationsSection");

const makeParagraph = (text) => {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
};

const wrapDocument = (paragraphs) => {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${paragraphs.join("")}</w:body>
</w:document>`;
};

const getParagraphTexts = (documentXml) => {
  const matches = documentXml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
  return matches.map((paragraph) => getParagraphText(paragraph).trim());
};

assert.strictEqual(isCertificationHeading("Certifications"), true);
assert.strictEqual(isCertificationHeading("Licenses & Certifications"), true);
assert.strictEqual(isCertificationHeading("Skills"), false);

const withPlaceholder = wrapDocument([
  makeParagraph("Skills"),
  makeParagraph("Certifications"),
  makeParagraph("{{@CERTIFICATIONS}}"),
  makeParagraph("Education"),
]);

assert.strictEqual(
  findCertificationsPlaceholderParagraphIndex(withPlaceholder),
  2
);

const removed = removeCertificationsSectionFromDocumentXml(withPlaceholder, {
  certificationsPlaceholderIndex: 2,
});

assert.deepStrictEqual(getParagraphTexts(removed), ["Skills", "Education"]);

const headingOnly = wrapDocument([
  makeParagraph("Experience"),
  makeParagraph("Professional Certifications"),
  makeParagraph(""),
  makeParagraph("Education"),
]);

const removedHeadingOnly =
  removeCertificationsSectionFromDocumentXml(headingOnly);

assert.deepStrictEqual(getParagraphTexts(removedHeadingOnly), [
  "Experience",
  "Education",
]);

const preservesOtherSections = wrapDocument([
  makeParagraph("Summary"),
  makeParagraph("Professional summary text"),
  makeParagraph("Skills"),
  makeParagraph("JavaScript"),
  makeParagraph("Education"),
  makeParagraph("BS Computer Science"),
]);

assert.deepStrictEqual(
  getParagraphTexts(
    removeCertificationsSectionFromDocumentXml(preservesOtherSections)
  ),
  getParagraphTexts(preservesOtherSections)
);

console.log("removeCertificationsSection.test.js: all tests passed");
