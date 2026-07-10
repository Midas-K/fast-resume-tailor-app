const express = require("express");
const multer = require("multer");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const {
  DOCX_MIME_TYPE,
  isDocxFile,
  safeDownloadFileName,
  validateTemplateBeforeUpload,
  getDocxtemplaterErrorMessages,
} = require("../services/resumeTemplates/validation");
const {
  makePreviewDocxBuffer,
  runLibreOfficeConvertForPreview,
} = require("../services/resumeTemplates/templateDocx");
const templateService = require("../services/resumeTemplates/templateService");

const previewPdfCache = new Map();

const getCachedPreviewPdf = (templateId) =>
  previewPdfCache.get(String(templateId));

const setCachedPreviewPdf = (templateId, pdfBuffer) => {
  previewPdfCache.set(String(templateId), pdfBuffer);
};

const clearPreviewPdfCache = (templateId = null) => {
  if (!templateId) {
    previewPdfCache.clear();
    return;
  }

  previewPdfCache.delete(String(templateId));
};

const formatTemplateUploadError = (error) => {
  const rawMessage = String(error?.message || "Unknown upload error.").trim();

  if (/has_certifications/i.test(rawMessage)) {
    return "Could not upload resume template. The database is still updating. Wait a moment and try again. Templates without {{@CERTIFICATIONS}} are allowed.";
  }

  if (/duplicate key|unique constraint/i.test(rawMessage)) {
    return "Could not upload resume template. A template with this name or default setting already exists.";
  }

  return `Could not upload resume template. ${rawMessage}`;
};

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const templates = await templateService.listActiveTemplates();

    return res.json({ templates });
  } catch (error) {
    console.error("Resume templates list error:", error);

    return res.status(500).json({
      message: "Could not load resume templates.",
    });
  }
});

router.get("/:templateId/file", requireAuth, async (req, res) => {
  try {
    const { templateId } = req.params;
    const template = await templateService.getActiveTemplateFile(templateId);

    if (!template) {
      return res.status(404).json({
        message: "Resume template not found.",
      });
    }

    const fileName = safeDownloadFileName(template.file_name);

    res.setHeader("Content-Type", template.mime_type || DOCX_MIME_TYPE);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    return res.send(template.file_data);
  } catch (error) {
    console.error("Resume template file error:", error);

    return res.status(500).json({
      message: "Could not load resume template file.",
    });
  }
});

router.get(
  "/:templateId/preview-pdf",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    let tempDir = null;

    try {
      const { templateId } = req.params;
      const template = await templateService.getActiveTemplateForPreview(
        templateId
      );

      if (!template) {
        return res.status(404).json({
          message: "Resume template not found.",
        });
      }

      if (template.mime_type !== DOCX_MIME_TYPE) {
        return res.status(400).json({
          message: "Only DOCX templates can be previewed.",
        });
      }

      const cachedPdf = getCachedPreviewPdf(templateId);

      if (cachedPdf) {
        const baseFileName = `template_preview_${template.id}`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `inline; filename="${baseFileName}.pdf"`
        );

        return res.send(cachedPdf);
      }

      const docxBuffer = makePreviewDocxBuffer(template.file_data);

      tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "frt-template-preview-")
      );

      const baseFileName = `template_preview_${template.id}`;
      const docxPath = path.join(tempDir, `${baseFileName}.docx`);
      const pdfPath = path.join(tempDir, `${baseFileName}.pdf`);

      await fs.writeFile(docxPath, docxBuffer);
      await runLibreOfficeConvertForPreview(docxPath, tempDir);

      const pdfBuffer = await fs.readFile(pdfPath);

      setCachedPreviewPdf(templateId, pdfBuffer);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${baseFileName}.pdf"`
      );

      return res.send(pdfBuffer);
    } catch (error) {
      console.error("Resume template preview error:", error);

      const docxErrors = getDocxtemplaterErrorMessages(error);

      if (docxErrors.length > 0) {
        return res.status(400).json({
          message: `Could not generate preview resume:\n${docxErrors.join(
            "\n"
          )}`,
          errors: docxErrors,
        });
      }

      return res.status(500).json({
        message: `Could not generate preview resume. ${
          error.message || "Unknown preview error."
        }`,
      });
    } finally {
      if (tempDir) {
        try {
          await fs.rm(tempDir, {
            recursive: true,
            force: true,
          });
        } catch (cleanupError) {
          console.error("Preview cleanup error:", cleanupError.message);
        }
      }
    }
  }
);

router.post(
  "/",
  requireAuth,
  requireAdmin,
  upload.single("templateFile"),
  async (req, res) => {
    try {
      const { name, description, isDefault } = req.body;

      const cleanName = String(name || "").trim();
      const cleanDescription = String(description || "").trim();

      if (!cleanName) {
        return res.status(400).json({
          message: "Template name is required.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "DOCX template file is required.",
        });
      }

      if (!isDocxFile(req.file)) {
        return res.status(400).json({
          message: "Only DOCX resume templates are allowed.",
        });
      }

      const validationResult = await validateTemplateBeforeUpload(
        req.file.buffer
      );

      if (!validationResult.isValid) {
        return res.status(400).json({
          message: validationResult.message,
          errors: validationResult.errors || [],
          warnings: validationResult.warnings || [],
        });
      }

      const shouldSetDefault = String(isDefault) === "true";
      const activeCount = await templateService.countActiveTemplates();
      const isFirstTemplate = activeCount === 0;
      const finalIsDefault = shouldSetDefault || isFirstTemplate;

      const template = await templateService.uploadTemplate({
        name: cleanName,
        description: cleanDescription,
        fileName: req.file.originalname,
        fileBuffer: req.file.buffer,
        isDefault: finalIsDefault,
        uploadedByAdminId: req.user.id,
        hasCertifications: Boolean(validationResult.hasCertifications),
      });

      clearPreviewPdfCache();

      return res.status(201).json({
        message: "DOCX resume template uploaded successfully.",
        template,
        warnings: validationResult.warnings || [],
      });
    } catch (error) {
      console.error("Resume template upload error:", error);

      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "Template file is too large. Max file size is 10MB.",
        });
      }

      return res.status(500).json({
        message: formatTemplateUploadError(error),
      });
    }
  }
);

router.patch(
  "/:templateId/default",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { templateId } = req.params;
      const existing = await templateService.getActiveTemplateById(templateId);

      if (!existing) {
        return res.status(404).json({
          message: "Resume template not found.",
        });
      }

      const template = await templateService.setDefaultTemplate(templateId);

      return res.json({
        message: "Default resume template updated.",
        template,
      });
    } catch (error) {
      console.error("Set default template error:", error);

      return res.status(500).json({
        message: "Could not set default template.",
      });
    }
  }
);

router.delete("/:templateId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { templateId } = req.params;
    const removed = await templateService.removeTemplate(templateId);

    if (!removed) {
      return res.status(404).json({
        message: "Resume template not found.",
      });
    }

    clearPreviewPdfCache(templateId);

    return res.json({
      message: "Resume template removed.",
      template: removed,
    });
  } catch (error) {
    console.error("Remove template error:", error);

    return res.status(500).json({
      message: "Could not remove resume template.",
    });
  }
});

module.exports = router;
