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

const getDateRange = ({ deleteType, date, month, year }) => {
  if (deleteType === "all") {
    return {
      start: null,
      end: null,
    };
  }

  if (deleteType === "day") {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("Valid date is required. Use YYYY-MM-DD.");
    }

    return {
      start: `${date}T00:00:00.000Z`,
      end: `${date}T23:59:59.999Z`,
    };
  }

  if (deleteType === "month") {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new Error("Valid month is required. Use YYYY-MM.");
    }

    const [yearValue, monthValue] = month.split("-").map(Number);
    const start = new Date(Date.UTC(yearValue, monthValue - 1, 1));
    const end = new Date(Date.UTC(yearValue, monthValue, 1));

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  if (deleteType === "year") {
    if (!year || !/^\d{4}$/.test(String(year))) {
      throw new Error("Valid year is required. Use YYYY.");
    }

    const yearValue = Number(year);

    return {
      start: new Date(Date.UTC(yearValue, 0, 1)).toISOString(),
      end: new Date(Date.UTC(yearValue + 1, 0, 1)).toISOString(),
    };
  }

  throw new Error("Invalid delete type. Use all, day, month, or year.");
};

const canAdminManageProfileApplications = async ({ profileId, adminUser }) => {
  if (isSpecialAdminEmail(adminUser.email)) {
    return {
      allowed: false,
      status: 403,
      message: "Special admin cannot delete user application counts.",
      profile: null,
    };
  }

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

  if (isOwnerEmail(adminUser.email)) {
    return {
      allowed: true,
      status: 200,
      message: "Allowed.",
      profile,
    };
  }

  if (String(profile.approved_by_admin_id) !== String(adminUser.id)) {
    return {
      allowed: false,
      status: 403,
      message: "You can only delete applications for users approved by you.",
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

router.get("/admin/summary", requireAuth, requireAdmin, async (req, res) => {
  try {
    let result;

    if (isOwnerEmail(req.user.email)) {
      result = await pool.query(
        `
        SELECT
          applications.normalized_company_name,
          applications.normalized_role_name,
          MIN(applications.company_name) AS company_name,
          MIN(applications.role_name) AS role_name,
          COUNT(*) AS application_count,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'userId', users.id,
              'userName', users.name,
              'userEmail', users.email,
              'profileId', profiles.id,
              'profileName', profiles.name,
              'profileEmail', profiles.email,
              'profileLocation', profiles.location,
              'appliedAt', applications.created_at
            )
            ORDER BY applications.created_at DESC
          ) AS profiles
        FROM applications
        JOIN users ON users.id = applications.user_id
        JOIN profiles ON profiles.id = applications.profile_id
        GROUP BY
          applications.normalized_company_name,
          applications.normalized_role_name
        ORDER BY application_count DESC, company_name ASC
        `
      );
    } else if (isSpecialAdminEmail(req.user.email)) {
      result = await pool.query(
        `
        SELECT
          applications.normalized_company_name,
          applications.normalized_role_name,
          MIN(applications.company_name) AS company_name,
          MIN(applications.role_name) AS role_name,
          COUNT(*) AS application_count,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'userId', users.id,
              'userName', users.name,
              'userEmail', users.email,
              'profileId', profiles.id,
              'profileName', profiles.name,
              'profileEmail', profiles.email,
              'profileLocation', profiles.location,
              'appliedAt', applications.created_at
            )
            ORDER BY applications.created_at DESC
          ) AS profiles
        FROM applications
        JOIN users ON users.id = applications.user_id
        JOIN profiles ON profiles.id = applications.profile_id
        WHERE users.account_type = 'user'
        AND users.approved_by_admin_id = $1
        GROUP BY
          applications.normalized_company_name,
          applications.normalized_role_name
        ORDER BY application_count DESC, company_name ASC
        `,
        [req.user.id]
      );
    } else {
      result = await pool.query(
        `
        SELECT
          applications.normalized_company_name,
          applications.normalized_role_name,
          MIN(applications.company_name) AS company_name,
          MIN(applications.role_name) AS role_name,
          COUNT(*) AS application_count,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'userId', users.id,
              'userName', users.name,
              'userEmail', users.email,
              'profileId', profiles.id,
              'profileName', profiles.name,
              'profileEmail', profiles.email,
              'profileLocation', profiles.location,
              'appliedAt', applications.created_at
            )
            ORDER BY applications.created_at DESC
          ) AS profiles
        FROM applications
        JOIN users ON users.id = applications.user_id
        JOIN profiles ON profiles.id = applications.profile_id
        WHERE users.account_type = 'user'
        AND users.approved_by_admin_id = $1
        GROUP BY
          applications.normalized_company_name,
          applications.normalized_role_name
        ORDER BY application_count DESC, company_name ASC
        `,
        [req.user.id]
      );
    }

    res.json({
      applications: result.rows,
    });
  } catch (error) {
    console.error("Application summary error:", error);

    res.status(500).json({
      message: "Could not load application summary.",
    });
  }
});

router.delete(
  "/admin/profile/:profileId",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { profileId } = req.params;
      const { deleteType, date, month, year } = req.body || {};

      const permission = await canAdminManageProfileApplications({
        profileId,
        adminUser: req.user,
      });

      if (!permission.allowed) {
        return res.status(permission.status).json({
          message: permission.message,
        });
      }

      let range;

      try {
        range = getDateRange({
          deleteType,
          date,
          month,
          year,
        });
      } catch (rangeError) {
        return res.status(400).json({
          message: rangeError.message,
        });
      }

      let deleted;

      if (deleteType === "all") {
        deleted = await pool.query(
          `
          DELETE FROM applications
          WHERE profile_id = $1
          RETURNING id
          `,
          [profileId]
        );
      } else {
        deleted = await pool.query(
          `
          DELETE FROM applications
          WHERE profile_id = $1
          AND created_at >= $2
          AND created_at < $3
          RETURNING id
          `,
          [profileId, range.start, range.end]
        );
      }

      return res.json({
        message: `${deleted.rowCount} application record(s) deleted.`,
        deletedCount: deleted.rowCount,
      });
    } catch (error) {
      console.error("Admin delete profile applications error:", error);

      return res.status(500).json({
        message: "Could not delete application records.",
      });
    }
  }
);

router.get("/profile-counts", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      WITH profile_applications AS (
        SELECT
          p.id AS profile_id,
          a.id AS application_id,
          a.created_at AS applied_at
        FROM profiles p
        LEFT JOIN applications a ON a.profile_id = p.id
        WHERE p.user_id = $1
      ),
      latest_dates AS (
        SELECT
          profile_id,
          DATE(MAX(applied_at)) AS latest_application_date
        FROM profile_applications
        GROUP BY profile_id
      )
      SELECT
        pa.profile_id,
        COUNT(pa.application_id)::int AS whole_application_count,
        COUNT(pa.application_id) FILTER (
          WHERE DATE(pa.applied_at) = ld.latest_application_date
        )::int AS most_recent_application_count
      FROM profile_applications pa
      LEFT JOIN latest_dates ld ON ld.profile_id = pa.profile_id
      GROUP BY pa.profile_id, ld.latest_application_date
      ORDER BY pa.profile_id DESC
      `,
      [req.user.id]
    );

    res.json({
      counts: result.rows,
    });
  } catch (error) {
    console.error("Profile application counts error:", error);

    res.status(500).json({
      message: "Could not load profile application counts.",
    });
  }
});

router.get("/profile/:profileId", requireAuth, async (req, res) => {
  try {
    const { profileId } = req.params;

    const profileCheck = await pool.query(
      `
      SELECT id
      FROM profiles
      WHERE id = $1 AND user_id = $2
      `,
      [profileId, req.user.id]
    );

    if (profileCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Profile not found.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        company_name,
        role_name,
        created_at
      FROM applications
      WHERE profile_id = $1 AND user_id = $2
      ORDER BY created_at DESC
      `,
      [profileId, req.user.id]
    );

    return res.json({
      applications: result.rows,
    });
  } catch (error) {
    console.error("Profile applications error:", error);

    return res.status(500).json({
      message: "Could not load profile applications.",
    });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { companyName, roleName, profileId } = req.body;

    if (!companyName || !roleName || !profileId) {
      return res.status(400).json({
        message: "Company name, role name, and selected profile are required.",
      });
    }

    const profileCheck = await pool.query(
      `
      SELECT id
      FROM profiles
      WHERE id = $1 AND user_id = $2
      `,
      [profileId, req.user.id]
    );

    if (profileCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Selected profile was not found.",
      });
    }

    const normalizedCompany = companyName.trim().toLowerCase();
    const normalizedRole = roleName.trim().toLowerCase();

    const existingApplication = await pool.query(
      `
      SELECT id
      FROM applications
      WHERE profile_id = $1
      AND normalized_company_name = $2
      AND normalized_role_name = $3
      `,
      [profileId, normalizedCompany, normalizedRole]
    );

    if (existingApplication.rows.length > 0) {
      return res.status(409).json({
        message: "This profile already applied to this company and role.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO applications (
        user_id,
        profile_id,
        company_name,
        role_name,
        normalized_company_name,
        normalized_role_name
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id, profile_id, company_name, role_name, created_at
      `,
      [
        req.user.id,
        profileId,
        companyName.trim(),
        roleName.trim(),
        normalizedCompany,
        normalizedRole,
      ]
    );

    res.status(201).json({
      message: "Application saved.",
      application: result.rows[0],
    });
  } catch (error) {
    console.error("Application save error:", error);

    res.status(500).json({
      message: "Could not save application.",
    });
  }
});

module.exports = router;