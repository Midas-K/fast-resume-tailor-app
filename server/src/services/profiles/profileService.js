const pool = require("../../db");
const { isOwnerEmail } = require("../../utils/email");
const { HttpError } = require("../../utils/httpError");
const { canAdminManageProfile } = require("./profileAccess");

const saveProfileHistory = async ({
  userId,
  profileId,
  userEmail,
  profileName,
  eventType,
}) => {
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
      [userId, profileId, userEmail, profileName, eventType]
    );
  } catch (historyError) {
    console.error("Profile history save error:", historyError.message);
  }
};

const listProfiles = async (req) => {
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

  return { body: { profiles: result.rows } };
};

const getProfileById = async (req) => {
  const { id } = req.params;

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
      WHERE profiles.id = $1 AND profiles.user_id = $2
    `,
    [id, req.user.id]
  );

  if (result.rows.length === 0) {
    throw new HttpError(404, "Profile not found.");
  }

  return { body: { profile: result.rows[0] } };
};

const createProfile = async (req) => {
  const { name, location, phone, email, education, experience } = req.body;

  if (!name || !email) {
    throw new HttpError(400, "Profile name and email are required.");
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

  await saveProfileHistory({
    userId: req.user.id,
    profileId: profile.id,
    userEmail: req.user.email,
    profileName: profile.name,
    eventType: "profile_created",
  });

  return {
    status: 201,
    body: {
      message: "Profile created!",
      profile,
    },
  };
};

const updateProfile = async (req) => {
  const { id } = req.params;
  const { name, location, phone, email, education, experience } = req.body;

  if (!name || !email) {
    throw new HttpError(400, "Profile name and email are required.");
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
    throw new HttpError(404, "Profile not found.");
  }

  return {
    body: {
      message: "Profile updated!",
      profile: result.rows[0],
    },
  };
};

const updateAdminPrompt = async (req) => {
  const { id } = req.params;
  const { adminPrompt } = req.body;

  await canAdminManageProfile({ profileId: id, adminUser: req.user });

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

  return {
    body: {
      message: adminPrompt
        ? "Profile prompt updated."
        : "Profile prompt removed.",
      profile: result.rows[0],
    },
  };
};

const updateResumeTemplate = async (req) => {
  const { id } = req.params;
  const { resumeTemplateId } = req.body;

  await canAdminManageProfile({ profileId: id, adminUser: req.user });

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
      throw new HttpError(404, "Resume template not found.");
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

  return {
    body: {
      message: "Profile resume template updated.",
      profile: result.rows[0],
    },
  };
};

const deleteProfile = async (req) => {
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
    throw new HttpError(404, "Profile not found.");
  }

  const profile = profileResult.rows[0];

  await pool.query(
    `
      DELETE FROM profiles
      WHERE id = $1 AND user_id = $2
    `,
    [id, req.user.id]
  );

  await saveProfileHistory({
    userId: req.user.id,
    profileId: profile.id,
    userEmail: req.user.email,
    profileName: profile.name,
    eventType: "profile_removed",
  });

  return { body: { message: "Profile removed." } };
};

const listProfileHistory = async (req) => {
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

  return { body: { history: result.rows } };
};

const listAllProfilesForAdmin = async (req) => {
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

  return { body: { profiles: result.rows } };
};

module.exports = {
  listProfiles,
  getProfileById,
  createProfile,
  updateProfile,
  updateAdminPrompt,
  updateResumeTemplate,
  deleteProfile,
  listProfileHistory,
  listAllProfilesForAdmin,
};
