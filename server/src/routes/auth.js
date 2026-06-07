const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const router = express.Router();

const OWNER_EMAIL = process.env.OWNER_EMAIL;
const OWNER_PASSCODE_HASH = process.env.OWNER_PASSCODE_HASH || "";

const SPECIAL_AUTO_APPROVE_EMAIL = process.env.SPECIAL_AUTO_APPROVE_EMAIL;
const SPECIAL_AUTO_APPROVE_PASSCODE_HASH =
  process.env.SPECIAL_AUTO_APPROVE_PASSCODE_HASH || "";

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const isOwnerEmail = (email) => {
  return OWNER_EMAIL && normalizeEmail(email) === normalizeEmail(OWNER_EMAIL);
};

const isSpecialAdminEmail = (email) => {
  return (
    SPECIAL_AUTO_APPROVE_EMAIL &&
    normalizeEmail(email) === normalizeEmail(SPECIAL_AUTO_APPROVE_EMAIL)
  );
};

const isSpecialPasscodeEmail = (email) => {
  return isOwnerEmail(email) || isSpecialAdminEmail(email);
};

const getPasscodeHashForEmail = (email) => {
  if (isOwnerEmail(email)) return OWNER_PASSCODE_HASH;
  if (isSpecialAdminEmail(email)) return SPECIAL_AUTO_APPROVE_PASSCODE_HASH;
  return "";
};

const canManageAdminAccounts = (email) => {
  return isOwnerEmail(email) || isSpecialAdminEmail(email);
};

const canInspectAdminUsers = (email) => {
  // Only owner can inspect other admins' users/profiles.
  return isOwnerEmail(email);
};

const canDeleteTargetAccount = ({ requesterEmail, requesterId, targetUser }) => {
  if (!targetUser) return false;

  const requesterIsOwner = isOwnerEmail(requesterEmail);
  const requesterIsSpecialAdmin = isSpecialAdminEmail(requesterEmail);

  const targetIsOwner = isOwnerEmail(targetUser.email);
  const targetIsSpecialAdmin = isSpecialAdminEmail(targetUser.email);
  const targetIsAdmin = targetUser.account_type === "admin";
  const targetIsUser = targetUser.account_type === "user";
  const targetIsSelf = String(requesterId) === String(targetUser.id);

  if (targetIsSelf) return false;
  if (targetIsOwner) return false;
  if (targetIsSpecialAdmin) return false;

  // Special admin can approve/block only. No permanent delete.
  if (requesterIsSpecialAdmin) return false;

  // Owner can delete normal admins and users.
  if (requesterIsOwner) {
    return targetIsAdmin || targetIsUser;
  }

  // Normal admins cannot delete admins.
  if (targetIsAdmin) return false;

  // Normal admins can delete pending users or users approved by them.
  if (targetIsUser) {
    if (!targetUser.is_approved) return true;

    return String(targetUser.approved_by_admin_id || "") === String(requesterId);
  }

  return false;
};

const attachPermissionFlags = (user, requester = null) => {
  const requesterEmail = requester?.email || user.email;
  const requesterId = requester?.id || user.id;

  const userCanManageAdmins = canManageAdminAccounts(user.email);
  const userCanInspectAdmins = canInspectAdminUsers(user.email);

  const userIsProtectedAdmin =
    user.account_type === "admin" &&
    (isOwnerEmail(user.email) || isSpecialAdminEmail(user.email));

  const canDelete = requester
    ? canDeleteTargetAccount({
        requesterEmail,
        requesterId,
        targetUser: user,
      })
    : false;

  return {
    ...user,

    accountType: user.account_type,
    isApproved: user.is_approved,
    jobBidStyle: user.job_bid_style,

    can_manage_admin_accounts: userCanManageAdmins,
    canManageAdminAccounts: userCanManageAdmins,

    can_inspect_admin_users: userCanInspectAdmins,
    canInspectAdminUsers: userCanInspectAdmins,

    is_protected_admin: userIsProtectedAdmin,
    isProtectedAdmin: userIsProtectedAdmin,

    can_delete_account: canDelete,
    canDeleteAccount: canDelete,
  };
};

const createToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      account_type: user.account_type,
      accountType: user.account_type,
      is_approved: user.is_approved,
      isApproved: user.is_approved,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Authorization token is missing.",
    });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      ...decoded,
      account_type: decoded.account_type || decoded.accountType,
      accountType: decoded.accountType || decoded.account_type,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.account_type !== "admin" && req.user.accountType !== "admin") {
    return res.status(403).json({
      message: "Admin access required.",
    });
  }

  next();
};

const saveAuthHistory = async ({ email, accountType, eventType }) => {
  try {
    await pool.query(
      `
        INSERT INTO auth_history (email, account_type, event_type)
        VALUES ($1, $2, $3)
      `,
      [email, accountType, eventType]
    );
  } catch (error) {
    console.error("Auth history save error:", error.message);
  }
};

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, accountType, account_type } = req.body;

    const cleanName = String(name || "").trim();
    const cleanEmail = normalizeEmail(email);
    const requestedAccountType = accountType || account_type;

    let cleanAccountType = requestedAccountType === "admin" ? "admin" : "user";

    if (isOwnerEmail(cleanEmail) || isSpecialAdminEmail(cleanEmail)) {
      cleanAccountType = "admin";
    }

    if (!cleanName || !cleanEmail || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required.",
      });
    }

    const existingUser = await pool.query(
      `
        SELECT id
        FROM users
        WHERE LOWER(email) = LOWER($1)
      `,
      [cleanEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: "This email is already registered.",
      });
    }

    const requiresPasscode = isSpecialPasscodeEmail(cleanEmail);
    const hashedPassword = await bcrypt.hash(password, 12);

    const createdUser = await pool.query(
      `
        INSERT INTO users (
          name,
          email,
          password_hash,
          account_type,
          is_approved,
          approved_by_admin_id,
          job_bid_style
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          name,
          email,
          account_type,
          is_approved,
          approved_by_admin_id,
          job_bid_style,
          created_at
      `,
      [
        cleanName,
        cleanEmail,
        hashedPassword,
        cleanAccountType,
        false,
        null,
        "copy_generate",
      ]
    );

    await saveAuthHistory({
      email: cleanEmail,
      accountType: cleanAccountType,
      eventType: "signup",
    });

    return res.status(201).json({
      message: requiresPasscode
        ? "Signup successful. Please complete secure verification."
        : "Signup successful. Please wait for admin approval.",
      requiresPasscode,
      email: requiresPasscode ? cleanEmail : undefined,
      user: attachPermissionFlags(createdUser.rows[0]),
    });
  } catch (error) {
    console.error("Signup error:", error);

    return res.status(500).json({
      message: "Signup failed.",
    });
  }
});

router.post("/verify-passcode", async (req, res) => {
  try {
    const { email, passcode } = req.body;

    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail || !passcode) {
      return res.status(400).json({
        message: "Email and passcode are required.",
      });
    }

    if (!isSpecialPasscodeEmail(cleanEmail)) {
      return res.status(403).json({
        message: "Secure verification is not available for this account.",
      });
    }

    const passcodeHash = getPasscodeHashForEmail(cleanEmail);

    if (!passcodeHash) {
      return res.status(500).json({
        message: "Secure verification is not configured.",
      });
    }

    const passcodeOk = await bcrypt.compare(String(passcode), passcodeHash);

    if (!passcodeOk) {
      return res.status(403).json({
        message: "Incorrect passcode.",
      });
    }

    const userResult = await pool.query(
      `
        SELECT
          id,
          name,
          email,
          account_type,
          is_approved,
          approved_by_admin_id,
          job_bid_style,
          created_at
        FROM users
        WHERE LOWER(email) = LOWER($1)
      `,
      [cleanEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        message: "Account not found. Please sign up first.",
      });
    }

    const updatedUserResult = await pool.query(
      `
        UPDATE users
        SET is_approved = true
        WHERE id = $1
        RETURNING
          id,
          name,
          email,
          account_type,
          is_approved,
          approved_by_admin_id,
          job_bid_style,
          created_at
      `,
      [userResult.rows[0].id]
    );

    const updatedUser = updatedUserResult.rows[0];
    const token = createToken(updatedUser);

    await saveAuthHistory({
      email: updatedUser.email,
      accountType: updatedUser.account_type,
      eventType: "secure_verification",
    });

    return res.json({
      message: "Secure verification successful.",
      token,
      user: attachPermissionFlags(updatedUser),
    });
  } catch (error) {
    console.error("Verify passcode error:", error);

    return res.status(500).json({
      message: "Secure verification failed.",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const userResult = await pool.query(
      `
        SELECT
          id,
          name,
          email,
          password_hash,
          account_type,
          is_approved,
          approved_by_admin_id,
          job_bid_style,
          created_at
        FROM users
        WHERE LOWER(email) = LOWER($1)
      `,
      [cleanEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const user = userResult.rows[0];
    const passwordOk = await bcrypt.compare(password, user.password_hash);

    if (!passwordOk) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    if (!user.is_approved) {
      if (isSpecialPasscodeEmail(user.email)) {
        return res.status(403).json({
          message: "Secure verification is required.",
          requiresPasscode: true,
          email: user.email,
        });
      }

      return res.status(403).json({
        message: "Your account is waiting for admin approval.",
      });
    }

    const token = createToken(user);

    await saveAuthHistory({
      email: user.email,
      accountType: user.account_type,
      eventType: "login",
    });

    return res.json({
      message: "Login successful.",
      token,
      user: attachPermissionFlags({
        id: user.id,
        name: user.name,
        email: user.email,
        account_type: user.account_type,
        is_approved: user.is_approved,
        approved_by_admin_id: user.approved_by_admin_id,
        job_bid_style: user.job_bid_style,
        created_at: user.created_at,
      }),
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Login failed.",
    });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const userResult = await pool.query(
      `
        SELECT
          id,
          name,
          email,
          account_type,
          is_approved,
          approved_by_admin_id,
          job_bid_style,
          created_at
        FROM users
        WHERE id = $1
      `,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    return res.json({
      user: attachPermissionFlags(userResult.rows[0]),
    });
  } catch (error) {
    console.error("Me error:", error);

    return res.status(500).json({
      message: "Could not load user.",
    });
  }
});

router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const requesterIsOwner = isOwnerEmail(req.user.email);
    const requesterIsSpecialAdmin = isSpecialAdminEmail(req.user.email);

    let usersResult;

    if (requesterIsOwner) {
      // Owner sees all admins and all users.
      usersResult = await pool.query(
        `
          SELECT
            u.id,
            u.name,
            u.email,
            u.account_type,
            u.is_approved,
            u.approved_by_admin_id,
            a.name AS approved_by_admin_name,
            a.email AS approved_by_admin_email,
            u.job_bid_style,
            u.created_at
          FROM users u
          LEFT JOIN users a ON u.approved_by_admin_id = a.id
          ORDER BY u.created_at DESC
        `
      );
    } else if (requesterIsSpecialAdmin) {
      // Special admin sees:
      // - all admins
      // - pending users
      // - users approved by special admin
      usersResult = await pool.query(
        `
          SELECT
            u.id,
            u.name,
            u.email,
            u.account_type,
            u.is_approved,
            u.approved_by_admin_id,
            a.name AS approved_by_admin_name,
            a.email AS approved_by_admin_email,
            u.job_bid_style,
            u.created_at
          FROM users u
          LEFT JOIN users a ON u.approved_by_admin_id = a.id
          WHERE
            u.account_type = 'admin'
            OR (
              u.account_type = 'user'
              AND (
                u.is_approved = false
                OR u.approved_by_admin_id = $1
              )
            )
          ORDER BY u.created_at DESC
        `,
        [req.user.id]
      );
    } else {
      // Normal admin sees:
      // - pending users
      // - users approved by this admin
      // Normal admin cannot see admins.
      usersResult = await pool.query(
        `
          SELECT
            u.id,
            u.name,
            u.email,
            u.account_type,
            u.is_approved,
            u.approved_by_admin_id,
            a.name AS approved_by_admin_name,
            a.email AS approved_by_admin_email,
            u.job_bid_style,
            u.created_at
          FROM users u
          LEFT JOIN users a ON u.approved_by_admin_id = a.id
          WHERE
            u.account_type = 'user'
            AND (
              u.is_approved = false
              OR u.approved_by_admin_id = $1
            )
          ORDER BY u.created_at DESC
        `,
        [req.user.id]
      );
    }

    return res.json({
      users: usersResult.rows.map((row) =>
        attachPermissionFlags(row, {
          id: req.user.id,
          email: req.user.email,
        })
      ),
    });
  } catch (error) {
    console.error("Users error:", error);

    return res.status(500).json({
      message: "Could not load users.",
    });
  }
});

router.patch(
  "/users/:userId/approval",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { isApproved } = req.body;

      const requesterIsOwner = isOwnerEmail(req.user.email);
      const requesterIsSpecialAdmin = isSpecialAdminEmail(req.user.email);

      const targetUserResult = await pool.query(
        `
          SELECT
            id,
            email,
            account_type,
            is_approved,
            approved_by_admin_id
          FROM users
          WHERE id = $1
        `,
        [userId]
      );

      if (targetUserResult.rows.length === 0) {
        return res.status(404).json({
          message: "User not found.",
        });
      }

      const targetUser = targetUserResult.rows[0];

      const targetIsOwner = isOwnerEmail(targetUser.email);
      const targetIsSpecialAdmin = isSpecialAdminEmail(targetUser.email);
      const targetIsAdmin = targetUser.account_type === "admin";
      const targetIsUser = targetUser.account_type === "user";

      if (targetIsOwner && !requesterIsOwner) {
        return res.status(403).json({
          message: "Only owner can update owner account.",
        });
      }

      if (targetIsSpecialAdmin && !requesterIsOwner) {
        return res.status(403).json({
          message: "Only owner can update special admin account.",
        });
      }

      if (targetIsAdmin && !requesterIsOwner && !requesterIsSpecialAdmin) {
        return res.status(403).json({
          message: "Only owner or special admin can approve or block admins.",
        });
      }

      if (!targetIsAdmin && !targetIsUser) {
        return res.status(400).json({
          message: "Invalid target account type.",
        });
      }

      if (targetIsUser && !requesterIsOwner) {
        const alreadyApprovedBySomeone =
          targetUser.is_approved && targetUser.approved_by_admin_id;

        const approvedByAnotherAdmin =
          alreadyApprovedBySomeone &&
          String(targetUser.approved_by_admin_id) !== String(req.user.id);

        if (approvedByAnotherAdmin) {
          return res.status(403).json({
            message: "You can only manage pending users or users approved by you.",
          });
        }
      }

      const approvedByAdminId = Boolean(isApproved) ? req.user.id : null;

      const updatedUser = await pool.query(
        `
          UPDATE users
          SET
            is_approved = $1,
            approved_by_admin_id = $2
          WHERE id = $3
          RETURNING
            id,
            name,
            email,
            account_type,
            is_approved,
            approved_by_admin_id,
            job_bid_style,
            created_at
        `,
        [Boolean(isApproved), approvedByAdminId, userId]
      );

      return res.json({
        message: Boolean(isApproved)
          ? "Account approved successfully."
          : "Account blocked successfully.",
        user: attachPermissionFlags(updatedUser.rows[0], {
          id: req.user.id,
          email: req.user.email,
        }),
      });
    } catch (error) {
      console.error("Approval error:", error);

      return res.status(500).json({
        message: "Could not update approval.",
      });
    }
  }
);

router.delete("/users/:userId", requireAuth, requireAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    const { userId } = req.params;

    const targetUserResult = await client.query(
      `
        SELECT
          id,
          name,
          email,
          account_type,
          is_approved,
          approved_by_admin_id
        FROM users
        WHERE id = $1
      `,
      [userId]
    );

    if (targetUserResult.rows.length === 0) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const targetUser = targetUserResult.rows[0];

    const allowedToDelete = canDeleteTargetAccount({
      requesterEmail: req.user.email,
      requesterId: req.user.id,
      targetUser,
    });

    if (!allowedToDelete) {
      return res.status(403).json({
        message:
          "You do not have permission to permanently delete this account.",
      });
    }

    await client.query("BEGIN");

    await client.query(
      `
        DELETE FROM applications
        WHERE profile_id IN (
          SELECT id
          FROM profiles
          WHERE user_id = $1
        )
      `,
      [userId]
    );

    await client.query(
      `
        DELETE FROM profiles
        WHERE user_id = $1
      `,
      [userId]
    );

    await client.query(
      `
        UPDATE users
        SET approved_by_admin_id = NULL
        WHERE approved_by_admin_id = $1
      `,
      [userId]
    );

    try {
      await client.query(
        `
          UPDATE resume_templates
          SET uploaded_by_admin_id = NULL
          WHERE uploaded_by_admin_id = $1
        `,
        [userId]
      );
    } catch (cleanupError) {
      console.error(
        "Resume template uploader cleanup warning:",
        cleanupError.message
      );
    }

    const deletedUser = await client.query(
      `
        DELETE FROM users
        WHERE id = $1
        RETURNING id, name, email, account_type
      `,
      [userId]
    );

    await client.query("COMMIT");

    return res.json({
      message: "Account permanently deleted.",
      user: deletedUser.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    console.error("Delete user error:", error);

    return res.status(500).json({
      message: "Could not permanently delete account.",
    });
  } finally {
    client.release();
  }
});

router.patch(
  "/users/:userId/job-bid-style",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { jobBidStyle } = req.body;

      const allowedStyles = ["copy_generate", "build_resume"];

      if (!allowedStyles.includes(jobBidStyle)) {
        return res.status(400).json({
          message: "Invalid job-bid style.",
        });
      }

      const targetUserResult = await pool.query(
        `
          SELECT
            id,
            email,
            account_type,
            is_approved,
            approved_by_admin_id
          FROM users
          WHERE id = $1
        `,
        [userId]
      );

      if (targetUserResult.rows.length === 0) {
        return res.status(404).json({
          message: "User not found.",
        });
      }

      const targetUser = targetUserResult.rows[0];

      const requesterIsOwner = isOwnerEmail(req.user.email);
      const requesterIsSpecialAdmin = isSpecialAdminEmail(req.user.email);
      const targetIsUser = targetUser.account_type === "user";
      const targetIsAdmin = targetUser.account_type === "admin";

      if (!targetUser.is_approved) {
        return res.status(403).json({
          message: "You can only update approved accounts.",
        });
      }

      if (targetIsAdmin && !requesterIsOwner && !requesterIsSpecialAdmin) {
        return res.status(403).json({
          message: "Only owner or special admin can update admins.",
        });
      }

      if (targetIsUser && !requesterIsOwner) {
        const approvedByThisAdmin =
          String(targetUser.approved_by_admin_id || "") === String(req.user.id);

        if (!approvedByThisAdmin) {
          return res.status(403).json({
            message: "You can only update users approved by you.",
          });
        }
      }

      const updatedUser = await pool.query(
        `
          UPDATE users
          SET job_bid_style = $1
          WHERE id = $2
          RETURNING
            id,
            name,
            email,
            account_type,
            is_approved,
            approved_by_admin_id,
            job_bid_style,
            created_at
        `,
        [jobBidStyle, userId]
      );

      return res.json({
        message: "Job-bid style updated.",
        user: attachPermissionFlags(updatedUser.rows[0], {
          id: req.user.id,
          email: req.user.email,
        }),
      });
    } catch (error) {
      console.error("Job-bid style error:", error);

      return res.status(500).json({
        message: "Could not update job-bid style.",
      });
    }
  }
);

module.exports = router;