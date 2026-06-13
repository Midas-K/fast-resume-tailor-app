const express = require("express");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { jsonHandler } = require("../utils/routeHandler");
const authService = require("../services/auth/authService");

const router = express.Router();

router.post("/signup", jsonHandler(authService.signup, { logLabel: "Signup" }));
router.post(
  "/verify-passcode",
  jsonHandler(authService.verifyPasscode, { logLabel: "Verify passcode" })
);
router.post("/login", jsonHandler(authService.login, { logLabel: "Login" }));
router.get(
  "/me",
  requireAuth,
  jsonHandler(authService.getCurrentUser, { logLabel: "Me" })
);
router.get(
  "/users",
  requireAuth,
  requireAdmin,
  jsonHandler(authService.listUsers, { logLabel: "Users" })
);
router.patch(
  "/users/:userId/approval",
  requireAuth,
  requireAdmin,
  jsonHandler(authService.updateUserApproval, { logLabel: "Approval" })
);
router.delete(
  "/users/:userId",
  requireAuth,
  requireAdmin,
  jsonHandler(authService.deleteUserForever, { logLabel: "Delete user" })
);
router.patch(
  "/users/:userId/job-bid-style",
  requireAuth,
  requireAdmin,
  jsonHandler(authService.updateJobBidStyle, { logLabel: "Job-bid style" })
);

module.exports = router;
