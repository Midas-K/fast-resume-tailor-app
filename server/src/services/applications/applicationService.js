const pool = require("../../db");
const { isOwnerEmail, isSpecialAdminEmail } = require("../../utils/email");
const { HttpError } = require("../../utils/httpError");
const { getDateRange } = require("../../utils/dateRange");

const canAdminManageProfileApplications = async ({ profileId, adminUser }) => {
  if (isSpecialAdminEmail(adminUser.email)) {
    throw new HttpError(
      403,
      "Special admin cannot delete user application counts."
    );
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
    throw new HttpError(404, "Profile not found.");
  }

  const profile = profileCheck.rows[0];

  if (
    !isOwnerEmail(adminUser.email) &&
    String(profile.approved_by_admin_id) !== String(adminUser.id)
  ) {
    throw new HttpError(
      403,
      "You can only delete applications for users approved by you."
    );
  }

  return profile;
};

const assertAdminCanViewProfile = async ({ profileId, adminUser }) => {
  const profileCheck = await pool.query(
    `
      SELECT
        profiles.id,
        profiles.user_id,
        users.account_type,
        users.approved_by_admin_id
      FROM profiles
      JOIN users ON users.id = profiles.user_id
      WHERE profiles.id = $1
    `,
    [profileId]
  );

  if (profileCheck.rows.length === 0) {
    throw new HttpError(404, "Profile not found.");
  }

  const profile = profileCheck.rows[0];

  if (isOwnerEmail(adminUser.email)) {
    return profile;
  }

  if (isSpecialAdminEmail(adminUser.email)) {
    if (
      profile.account_type === "user" &&
      String(profile.approved_by_admin_id) === String(adminUser.id)
    ) {
      return profile;
    }

    throw new HttpError(403, "You do not have permission to view this profile.");
  }

  if (String(profile.approved_by_admin_id) !== String(adminUser.id)) {
    throw new HttpError(
      403,
      "You can only view applications for users approved by you."
    );
  }

  return profile;
};

const adminSummaryQuery = `
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
`;

const adminProfileCountsQuery = `
  WITH profile_applications AS (
    SELECT
      p.id AS profile_id,
      a.id AS application_id,
      a.created_at AS applied_at
    FROM profiles p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN applications a ON a.profile_id = p.id
    WHERE 1 = 1
`;

const getAdminProfileCounts = async (req) => {
  let result;

  if (isOwnerEmail(req.user.email)) {
    result = await pool.query(
      `
        ${adminProfileCountsQuery}
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
        )::int AS most_recent_application_count,
        MAX(pa.applied_at) AS latest_application_at
      FROM profile_applications pa
      LEFT JOIN latest_dates ld ON ld.profile_id = pa.profile_id
      GROUP BY pa.profile_id, ld.latest_application_date
      ORDER BY pa.profile_id DESC
      `
    );
  } else {
    result = await pool.query(
      `
        ${adminProfileCountsQuery}
        AND u.account_type = 'user'
        AND u.approved_by_admin_id = $1
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
        )::int AS most_recent_application_count,
        MAX(pa.applied_at) AS latest_application_at
      FROM profile_applications pa
      LEFT JOIN latest_dates ld ON ld.profile_id = pa.profile_id
      GROUP BY pa.profile_id, ld.latest_application_date
      ORDER BY pa.profile_id DESC
      `,
      [req.user.id]
    );
  }

  return { body: { counts: result.rows } };
};

const getAdminProfileApplications = async (req) => {
  const { profileId } = req.params;

  await assertAdminCanViewProfile({
    profileId,
    adminUser: req.user,
  });

  const result = await pool.query(
    `
      SELECT
        id,
        company_name,
        role_name,
        created_at
      FROM applications
      WHERE profile_id = $1
      ORDER BY created_at DESC
    `,
    [profileId]
  );

  return { body: { applications: result.rows } };
};

const getAdminSummary = async (req) => {
  let result;

  if (isOwnerEmail(req.user.email)) {
    result = await pool.query(
      `
        ${adminSummaryQuery}
        GROUP BY
          applications.normalized_company_name,
          applications.normalized_role_name
        ORDER BY application_count DESC, company_name ASC
      `
    );
  } else {
    result = await pool.query(
      `
        ${adminSummaryQuery}
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

  return { body: { applications: result.rows } };
};

const deleteProfileApplications = async (req) => {
  const { profileId } = req.params;
  const { deleteType, date, month, year } = req.body || {};

  await canAdminManageProfileApplications({
    profileId,
    adminUser: req.user,
  });

  let range;

  try {
    range = getDateRange({ deleteType, date, month, year });
  } catch (rangeError) {
    throw new HttpError(400, rangeError.message);
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

  return {
    body: {
      message: `${deleted.rowCount} application record(s) deleted.`,
      deletedCount: deleted.rowCount,
    },
  };
};

const getProfileCounts = async (req) => {
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

  return { body: { counts: result.rows } };
};

const getProfileApplications = async (req) => {
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
    throw new HttpError(404, "Profile not found.");
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

  return { body: { applications: result.rows } };
};

const createApplication = async (req) => {
  const { companyName, roleName, profileId } = req.body;

  if (!companyName || !roleName || !profileId) {
    throw new HttpError(
      400,
      "Company name, role name, and selected profile are required."
    );
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
    throw new HttpError(404, "Selected profile was not found.");
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
    throw new HttpError(
      409,
      "This profile already applied to this company and role."
    );
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

  return {
    status: 201,
    body: {
      message: "Application saved.",
      application: result.rows[0],
    },
  };
};

module.exports = {
  getAdminSummary,
  getAdminProfileCounts,
  getAdminProfileApplications,
  deleteProfileApplications,
  getProfileCounts,
  getProfileApplications,
  createApplication,
};
