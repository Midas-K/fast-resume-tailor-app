const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const router = express.Router();

const OWNER_EMAIL = process.env.OWNER_EMAIL;
const SPECIAL_AUTO_APPROVE_EMAIL = process.env.SPECIAL_AUTO_APPROVE_EMAIL;

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

const canAdminManageProfile = async ({ profileId, adminUser }) => {
  const profileCheck = await pool.query(
    `
      SELECT
        profiles.id,
        profiles.user_id,
        users.approved_by_admin_id
      FROM profiles
      JOIN users ON users.id = profiles.user_id
      WHERE profiles.id = $1
    `,
    [profileId]
  );

  if (profileCheck.rows.length === 0) {
    return {
      allowed: false,
      status: 404,
      message: "Profile not found.",
      profile: null,
    };
  }

  const profile = profileCheck.rows[0];

  /*if (isSpecialAdminEmail(adminUser.email)) {
    return {
      allowed: false,
      status: 403,
      message: "Special admin cannot manage user profiles.",
      profile,
    };
  }*/

  if (
    !isOwnerEmail(adminUser.email) &&
    String(profile.approved_by_admin_id) !== String(adminUser.id)
  ) {
    return {
      allowed: false,
      status: 403,
      message: "You can only update profiles for users approved by you.",
      profile,
    };
  }

  return {
    allowed: true,
    status: 200,
    message: "Allowed.",
    profile,
  };
};

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        profiles.id,
        profiles.name,
        profiles.location,
        profiles.phone,
        profiles.email,
        profiles.education,
        profiles.experience,
        profiles.admin_prompt,
        profiles.resume_template_id,
        resume_templates.name AS resume_template_name,
        resume_templates.file_name AS resume_template_file_name,
        profiles.created_at
      FROM profiles
      LEFT JOIN resume_templates
        ON resume_templates.id = profiles.resume_template_id
       AND resume_templates.is_active = true
      WHERE profiles.user_id = $1
      ORDER BY profiles.created_at DESC
      `,
      [req.user.id]
    );

    res.json({
      profiles: result.rows,
    });
  } catch (error) {
    console.error("Load profiles error:", error);

    res.status(500).json({
      message: "Could not load profiles.",
    });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, location, phone, email, education, experience } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        message: "Profile name and email are required.",
      });
    }

    const defaultTemplate = await pool.query(
      `
      SELECT id
      FROM resume_templates
      WHERE is_active = true
      ORDER BY is_default DESC, created_at DESC
      LIMIT 1
      `
    );

    const defaultTemplateId =
      defaultTemplate.rows.length > 0 ? defaultTemplate.rows[0].id : null;

    const profileResult = await pool.query(
      `
      INSERT INTO profiles (
        user_id,
        name,
        location,
        phone,
        email,
        education,
        experience,
        resume_template_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        name,
        location,
        phone,
        email,
        education,
        experience,
        admin_prompt,
        resume_template_id,
        created_at
      `,
      [
        req.user.id,
        name.trim(),
        location || "",
        phone || "",
        email.trim(),
        JSON.stringify(education || []),
        JSON.stringify(experience || []),
        defaultTemplateId,
      ]
    );

    const profile = profileResult.rows[0];

    try {
      await pool.query(
        `
        INSERT INTO profile_history (
          user_id,
          profile_id,
          user_email,
          profile_name,
          event_type
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          req.user.id,
          profile.id,
          req.user.email,
          profile.name,
          "profile_created",
        ]
      );
    } catch (historyError) {
      console.error("Profile history save error:", historyError.message);
    }

    res.status(201).json({
      message: "Profile created!",
      profile,
    });
  } catch (error) {
    console.error("Create profile error:", error);

    res.status(500).json({
      message: "Could not create profile.",
    });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, phone, email, education, experience } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        message: "Profile name and email are required.",
      });
    }

    const result = await pool.query(
      `
      UPDATE profiles
      SET
        name = $1,
        location = $2,
        phone = $3,
        email = $4,
        education = $5,
        experience = $6
      WHERE id = $7 AND user_id = $8
      RETURNING
        id,
        name,
        location,
        phone,
        email,
        education,
        experience,
        admin_prompt,
        resume_template_id,
        created_at
      `,
      [
        name.trim(),
        location || "",
        phone || "",
        email.trim(),
        JSON.stringify(education || []),
        JSON.stringify(experience || []),
        id,
        req.user.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Profile not found.",
      });
    }

    res.json({
      message: "Profile updated!",
      profile: result.rows[0],
    });
  } catch (error) {
    console.error("Update profile error:", error);

    res.status(500).json({
      message: "Could not update profile.",
    });
  }
});

router.patch(
  "/admin/:id/prompt",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { adminPrompt } = req.body;

      const permission = await canAdminManageProfile({
        profileId: id,
        adminUser: req.user,
      });

      if (!permission.allowed) {
        return res.status(permission.status).json({
          message: permission.message,
        });
      }

      const result = await pool.query(
        `
        UPDATE profiles
        SET admin_prompt = $1
        WHERE id = $2
        RETURNING
          id,
          user_id,
          name,
          location,
          phone,
          email,
          education,
          experience,
          admin_prompt,
          resume_template_id,
          created_at
        `,
        [adminPrompt || "", id]
      );

      res.json({
        message: adminPrompt
          ? "Profile prompt updated."
          : "Profile prompt removed.",
        profile: result.rows[0],
      });
    } catch (error) {
      console.error("Update profile prompt error:", error);

      res.status(500).json({
        message: "Could not update profile prompt.",
      });
    }
  }
);

router.patch(
  "/admin/:id/resume-template",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { resumeTemplateId } = req.body;

      const permission = await canAdminManageProfile({
        profileId: id,
        adminUser: req.user,
      });

      if (!permission.allowed) {
        return res.status(permission.status).json({
          message: permission.message,
        });
      }

      let finalTemplateId = null;

      if (resumeTemplateId) {
        const templateCheck = await pool.query(
          `
          SELECT id
          FROM resume_templates
          WHERE id = $1
            AND is_active = true
          `,
          [resumeTemplateId]
        );

        if (templateCheck.rows.length === 0) {
          return res.status(404).json({
            message: "Resume template not found.",
          });
        }

        finalTemplateId = resumeTemplateId;
      }

      const result = await pool.query(
        `
        UPDATE profiles
        SET resume_template_id = $1
        WHERE id = $2
        RETURNING
          id,
          user_id,
          name,
          location,
          phone,
          email,
          education,
          experience,
          admin_prompt,
          resume_template_id,
          created_at
        `,
        [finalTemplateId, id]
      );

      res.json({
        message: "Profile resume template updated.",
        profile: result.rows[0],
      });
    } catch (error) {
      console.error("Update profile resume template error:", error);

      res.status(500).json({
        message: "Could not update profile resume template.",
      });
    }
  }
);

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const profileResult = await pool.query(
      `
      SELECT id, name
      FROM profiles
      WHERE id = $1 AND user_id = $2
      `,
      [id, req.user.id]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({
        message: "Profile not found.",
      });
    }

    const profile = profileResult.rows[0];

    await pool.query(
      `
      DELETE FROM profiles
      WHERE id = $1 AND user_id = $2
      `,
      [id, req.user.id]
    );

    try {
      await pool.query(
        `
        INSERT INTO profile_history (
          user_id,
          profile_id,
          user_email,
          profile_name,
          event_type
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          req.user.id,
          profile.id,
          req.user.email,
          profile.name,
          "profile_removed",
        ]
      );
    } catch (historyError) {
      console.error("Profile history save error:", historyError.message);
    }

    res.json({
      message: "Profile removed.",
    });
  } catch (error) {
    console.error("Delete profile error:", error);

    res.status(500).json({
      message: "Could not remove profile.",
    });
  }
});

router.get("/admin/history", requireAuth, requireAdmin, async (req, res) => {
  try {
    let result;

    if (isOwnerEmail(req.user.email)) {
      result = await pool.query(
        `
        SELECT
          profile_history.id,
          profile_history.user_id,
          users.name AS user_name,
          profile_history.user_email,
          profile_history.profile_id,
          profile_history.profile_name,
          profile_history.event_type,
          profile_history.created_at
        FROM profile_history
        LEFT JOIN users ON users.id = profile_history.user_id
        ORDER BY profile_history.created_at DESC
        LIMIT 200
        `
      );
    } else if (isSpecialAdminEmail(req.user.email)) {
      result = await pool.query(
        `
        SELECT
          profile_history.id,
          profile_history.user_id,
          users.name AS user_name,
          profile_history.user_email,
          profile_history.profile_id,
          profile_history.profile_name,
          profile_history.event_type,
          profile_history.created_at
        FROM profile_history
        JOIN users ON users.id = profile_history.user_id
        WHERE users.account_type = 'user'
        AND users.approved_by_admin_id = $1
        ORDER BY profile_history.created_at DESC
        LIMIT 200
        `,
        [req.user.id]
      );
    } else {
      result = await pool.query(
        `
        SELECT
          profile_history.id,
          profile_history.user_id,
          users.name AS user_name,
          profile_history.user_email,
          profile_history.profile_id,
          profile_history.profile_name,
          profile_history.event_type,
          profile_history.created_at
        FROM profile_history
        JOIN users ON users.id = profile_history.user_id
        WHERE users.account_type = 'user'
        AND users.approved_by_admin_id = $1
        ORDER BY profile_history.created_at DESC
        LIMIT 200
        `,
        [req.user.id]
      );
    }

    res.json({
      history: result.rows,
    });
  } catch (error) {
    console.error("Profile history error:", error);

    res.status(500).json({
      message: "Could not load profile history.",
    });
  }
});

router.get("/admin/all", requireAuth, requireAdmin, async (req, res) => {
  try {
    let result;

    if (isOwnerEmail(req.user.email)) {
      result = await pool.query(
        `
        SELECT
          profiles.id,
          profiles.user_id,
          users.name AS user_name,
          users.email AS user_email,
          profiles.name AS profile_name,
          profiles.location,
          profiles.phone,
          profiles.email AS profile_email,
          profiles.education,
          profiles.experience,
          profiles.admin_prompt,
          profiles.resume_template_id,
          resume_templates.name AS resume_template_name,
          resume_templates.file_name AS resume_template_file_name,
          profiles.created_at
        FROM profiles
        JOIN users ON users.id = profiles.user_id
        LEFT JOIN resume_templates
          ON resume_templates.id = profiles.resume_template_id
         AND resume_templates.is_active = true
        ORDER BY profiles.created_at DESC
        `
      );
    } else if (isSpecialAdminEmail(req.user.email)) {
      result = await pool.query(
        `
        SELECT
          profiles.id,
          profiles.user_id,
          users.name AS user_name,
          users.email AS user_email,
          profiles.name AS profile_name,
          profiles.location,
          profiles.phone,
          profiles.email AS profile_email,
          profiles.education,
          profiles.experience,
          profiles.admin_prompt,
          profiles.resume_template_id,
          resume_templates.name AS resume_template_name,
          resume_templates.file_name AS resume_template_file_name,
          profiles.created_at
        FROM profiles
        JOIN users ON users.id = profiles.user_id
        LEFT JOIN resume_templates
          ON resume_templates.id = profiles.resume_template_id
         AND resume_templates.is_active = true
        WHERE users.account_type = 'user'
        AND users.approved_by_admin_id = $1
        ORDER BY profiles.created_at DESC
        `,
        [req.user.id]
      );
    } else {
      result = await pool.query(
        `
        SELECT
          profiles.id,
          profiles.user_id,
          users.name AS user_name,
          users.email AS user_email,
          profiles.name AS profile_name,
          profiles.location,
          profiles.phone,
          profiles.email AS profile_email,
          profiles.education,
          profiles.experience,
          profiles.admin_prompt,
          profiles.resume_template_id,
          resume_templates.name AS resume_template_name,
          resume_templates.file_name AS resume_template_file_name,
          profiles.created_at
        FROM profiles
        JOIN users ON users.id = profiles.user_id
        LEFT JOIN resume_templates
          ON resume_templates.id = profiles.resume_template_id
         AND resume_templates.is_active = true
        WHERE users.account_type = 'user'
        AND users.approved_by_admin_id = $1
        ORDER BY profiles.created_at DESC
        `,
        [req.user.id]
      );
    }

    res.json({
      profiles: result.rows,
    });
  } catch (error) {
    console.error("All profiles error:", error);

    res.status(500).json({
      message: "Could not load profiles.",
    });
  }
});
module.exports = router;