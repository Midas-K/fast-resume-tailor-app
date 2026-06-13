const pool = require("../../db");
const { isOwnerEmail } = require("../../utils/email");
const { HttpError } = require("../../utils/httpError");

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
    throw new HttpError(404, "Profile not found.");
  }

  const profile = profileCheck.rows[0];

  if (
    !isOwnerEmail(adminUser.email) &&
    String(profile.approved_by_admin_id) !== String(adminUser.id)
  ) {
    throw new HttpError(
      403,
      "You can only update profiles for users approved by you."
    );
  }

  return profile;
};

module.exports = { canAdminManageProfile };
