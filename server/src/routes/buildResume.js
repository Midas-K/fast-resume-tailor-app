const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  buildResumeFromTemplate,
  buildResumeFromProfile,
} = require("../services/buildResume/fromTemplateService");

const router = express.Router();

const sendPdfResult = (res, result) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${result.fileName}"`
  );

  if (result.templateName) {
    res.setHeader("X-Resume-Template-Name", result.templateName);
  }

  if (result.templateFileName) {
    res.setHeader("X-Resume-Template-File", result.templateFileName);
  }

  if (typeof result.usesDefaultTemplate === "boolean") {
    res.setHeader(
      "X-Resume-Uses-Default-Template",
      result.usesDefaultTemplate ? "true" : "false"
    );
  }

  if (result.sequenceNumber) {
    res.setHeader("X-Application-Sequence", String(result.sequenceNumber));
  }

  return res.send(result.buffer);
};

const handleBuildError = (res, error, logLabel) => {
  console.error(`${logLabel} error:`, error);

  if (error.properties && error.properties.errors) {
    console.error(
      "DOCX template errors:",
      JSON.stringify(error.properties.errors, null, 2)
    );

    return res.status(400).json({
      message:
        "DOCX template has invalid placeholders. Use {{FULL_NAME}} for plain text, {{@SUMMARY}} for formatted blocks, and loops like {{#EXPERIENCE_ITEMS}}...{{/EXPERIENCE_ITEMS}} for custom layouts.",
    });
  }

  if (error.status) {
    return res.status(error.status).json({
      message: error.message,
    });
  }

  return res.status(500).json({
    message: "Could not build resume from DOCX template.",
  });
};

router.post("/from-template", requireAuth, async (req, res) => {
  try {
    const result = await buildResumeFromTemplate({
      user: req.user,
      body: req.body,
    });

    return sendPdfResult(res, result);
  } catch (error) {
    return handleBuildError(res, error, "Build resume from template");
  }
});

router.post("/from-profile", requireAuth, async (req, res) => {
  try {
    const result = await buildResumeFromProfile({
      user: req.user,
      body: req.body,
    });

    return sendPdfResult(res, result);
  } catch (error) {
    return handleBuildError(res, error, "Build resume from profile");
  }
});

module.exports = router;
