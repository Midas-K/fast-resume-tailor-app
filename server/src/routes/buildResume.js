const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { buildResumeFromTemplate } = require("../services/buildResume/fromTemplateService");

const router = express.Router();

router.post("/from-template", requireAuth, async (req, res) => {
  try {
    const result = await buildResumeFromTemplate({
      user: req.user,
      body: req.body,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.fileName}"`
    );

    return res.send(result.buffer);
  } catch (error) {
    console.error("Build resume from template error:", error);

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
  }
});

module.exports = router;
