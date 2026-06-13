const express = require("express");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { jsonHandler } = require("../utils/routeHandler");
const applicationService = require("../services/applications/applicationService");

const router = express.Router();

router.get(
  "/admin/summary",
  requireAuth,
  requireAdmin,
  jsonHandler(applicationService.getAdminSummary, {
    logLabel: "Application summary",
  })
);
router.delete(
  "/admin/profile/:profileId",
  requireAuth,
  requireAdmin,
  jsonHandler(applicationService.deleteProfileApplications, {
    logLabel: "Admin delete profile applications",
  })
);
router.get(
  "/profile-counts",
  requireAuth,
  jsonHandler(applicationService.getProfileCounts, {
    logLabel: "Profile application counts",
  })
);
router.get(
  "/profile/:profileId",
  requireAuth,
  jsonHandler(applicationService.getProfileApplications, {
    logLabel: "Profile applications",
  })
);
router.post(
  "/",
  requireAuth,
  jsonHandler(applicationService.createApplication, {
    logLabel: "Application save",
  })
);

module.exports = router;
