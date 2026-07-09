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
router.get(
  "/admin/profile-counts",
  requireAuth,
  requireAdmin,
  jsonHandler(applicationService.getAdminProfileCounts, {
    logLabel: "Admin profile application counts",
  })
);
router.get(
  "/admin/profile/:profileId/applications",
  requireAuth,
  requireAdmin,
  jsonHandler(applicationService.getAdminProfileApplications, {
    logLabel: "Admin profile applications",
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
router.get(
  "/check-repeat",
  requireAuth,
  jsonHandler(applicationService.getExistingApplicationMatch, {
    logLabel: "Application repeat check",
  })
);
router.get(
  "/daily-sequence",
  requireAuth,
  jsonHandler(applicationService.getDailyApplicationSequence, {
    logLabel: "Daily application sequence",
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
