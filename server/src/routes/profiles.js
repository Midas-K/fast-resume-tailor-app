const express = require("express");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { jsonHandler } = require("../utils/routeHandler");
const profileService = require("../services/profiles/profileService");

const router = express.Router();

router.get(
  "/",
  requireAuth,
  jsonHandler(profileService.listProfiles, { logLabel: "Load profiles" })
);
router.post(
  "/",
  requireAuth,
  jsonHandler(profileService.createProfile, { logLabel: "Create profile" })
);
router.put(
  "/:id",
  requireAuth,
  jsonHandler(profileService.updateProfile, { logLabel: "Update profile" })
);
router.patch(
  "/admin/:id/prompt",
  requireAuth,
  requireAdmin,
  jsonHandler(profileService.updateAdminPrompt, {
    logLabel: "Update profile prompt",
  })
);
router.patch(
  "/admin/:id/resume-template",
  requireAuth,
  requireAdmin,
  jsonHandler(profileService.updateResumeTemplate, {
    logLabel: "Update profile resume template",
  })
);
router.delete(
  "/:id",
  requireAuth,
  jsonHandler(profileService.deleteProfile, { logLabel: "Delete profile" })
);
router.get(
  "/admin/history",
  requireAuth,
  requireAdmin,
  jsonHandler(profileService.listProfileHistory, {
    logLabel: "Profile history",
  })
);
router.get(
  "/admin/all",
  requireAuth,
  requireAdmin,
  jsonHandler(profileService.listAllProfilesForAdmin, {
    logLabel: "All profiles",
  })
);

module.exports = router;
