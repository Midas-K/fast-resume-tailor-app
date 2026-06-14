const bcrypt = require("bcryptjs");
const pool = require("../../db");
const {
  normalizeEmail,
  isOwnerEmail,
  isSpecialAdminEmail,
  isSpecialPasscodeEmail,
  getPasscodeHashForEmail,
} = require("../../utils/email");
const { HttpError } = require("../../utils/httpError");
const { createToken } = require("./token");
const {
  canDeleteTargetAccount,
  attachPermissionFlags,
} = require("./permissions");

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

const signup = async (req) => {
  const { name, email, password, accountType, account_type } = req.body;

  const cleanName = String(name || "").trim();
  const cleanEmail = normalizeEmail(email);
  const requestedAccountType = accountType || account_type;

  let cleanAccountType = requestedAccountType === "admin" ? "admin" : "user";

  if (isOwnerEmail(cleanEmail) || isSpecialAdminEmail(cleanEmail)) {
    cleanAccountType = "admin";
  }

  if (!cleanName || !cleanEmail || !password) {
    throw new HttpError(400, "Name, email, and password are required.");
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
    throw new HttpError(409, "This email is already registered.");
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

  return {
    status: 201,
    body: {
      message: requiresPasscode
        ? "Signup successful. Please complete secure verification."
        : "Signup successful. Please wait for admin approval.",
      requiresPasscode,
      email: requiresPasscode ? cleanEmail : undefined,
      user: attachPermissionFlags(createdUser.rows[0]),
    },
  };
};

const verifyPasscode = async (req) => {
  const { email, passcode } = req.body;

  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail || !passcode) {
    throw new HttpError(400, "Email and passcode are required.");
  }

  if (!isSpecialPasscodeEmail(cleanEmail)) {
    throw new HttpError(
      403,
      "Secure verification is not available for this account."
    );
  }

  const passcodeHash = getPasscodeHashForEmail(cleanEmail);

  if (!passcodeHash) {
    throw new HttpError(500, "Secure verification is not configured.");
  }

  const passcodeOk = await bcrypt.compare(String(passcode), passcodeHash);

  if (!passcodeOk) {
    throw new HttpError(403, "Incorrect passcode.");
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
    throw new HttpError(404, "Account not found. Please sign up first.");
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

  return {
    body: {
      message: "Secure verification successful.",
      token,
      user: attachPermissionFlags(updatedUser),
    },
  };
};

const login = async (req) => {
  const { email, password } = req.body;

  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail || !password) {
    throw new HttpError(400, "Email and password are required.");
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
    throw new HttpError(401, "Invalid email or password.");
  }

  const user = userResult.rows[0];
  const passwordOk = await bcrypt.compare(password, user.password_hash);

  if (!passwordOk) {
    throw new HttpError(401, "Invalid email or password.");
  }

  if (!user.is_approved) {
    if (isSpecialPasscodeEmail(user.email)) {
      throw new HttpError(403, "Secure verification is required.", {
        requiresPasscode: true,
        email: user.email,
      });
    }

    throw new HttpError(403, "Your account is waiting for admin approval.");
  }

  const token = createToken(user);

  await saveAuthHistory({
    email: user.email,
    accountType: user.account_type,
    eventType: "login",
  });

  return {
    body: {
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
    },
  };
};

const getCurrentUser = async (req) => {
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
    throw new HttpError(404, "User not found.");
  }

  return {
    body: {
      user: attachPermissionFlags(userResult.rows[0]),
    },
  };
};

const listUsers = async (req) => {
  const requesterIsOwner = isOwnerEmail(req.user.email);
  const requesterIsSpecialAdmin = isSpecialAdminEmail(req.user.email);

  let usersResult;

  if (requesterIsOwner) {
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
        ORDER BY u.created_at ASC
      `
    );
  } else if (requesterIsSpecialAdmin) {
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
        ORDER BY u.created_at ASC
      `,
      [req.user.id]
    );
  } else {
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
        ORDER BY u.created_at ASC
      `,
      [req.user.id]
    );
  }

  return {
    body: {
      users: usersResult.rows.map((row) =>
        attachPermissionFlags(row, {
          id: req.user.id,
          email: req.user.email,
        })
      ),
    },
  };
};

const updateUserApproval = async (req) => {
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
    throw new HttpError(404, "User not found.");
  }

  const targetUser = targetUserResult.rows[0];

  const targetIsOwner = isOwnerEmail(targetUser.email);
  const targetIsSpecialAdmin = isSpecialAdminEmail(targetUser.email);
  const targetIsAdmin = targetUser.account_type === "admin";
  const targetIsUser = targetUser.account_type === "user";

  if (targetIsOwner && !requesterIsOwner) {
    throw new HttpError(403, "Only owner can update owner account.");
  }

  if (targetIsSpecialAdmin && !requesterIsOwner) {
    throw new HttpError(403, "Only owner can update special admin account.");
  }

  if (targetIsAdmin && !requesterIsOwner && !requesterIsSpecialAdmin) {
    throw new HttpError(
      403,
      "Only owner or special admin can approve or block admins."
    );
  }

  if (!targetIsAdmin && !targetIsUser) {
    throw new HttpError(400, "Invalid target account type.");
  }

  if (targetIsUser && !requesterIsOwner) {
    const alreadyApprovedBySomeone =
      targetUser.is_approved && targetUser.approved_by_admin_id;

    const approvedByAnotherAdmin =
      alreadyApprovedBySomeone &&
      String(targetUser.approved_by_admin_id) !== String(req.user.id);

    if (approvedByAnotherAdmin) {
      throw new HttpError(
        403,
        "You can only manage pending users or users approved by you."
      );
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

  return {
    body: {
      message: Boolean(isApproved)
        ? "Account approved successfully."
        : "Account blocked successfully.",
      user: attachPermissionFlags(updatedUser.rows[0], {
        id: req.user.id,
        email: req.user.email,
      }),
    },
  };
};

const deleteUserForever = async (req) => {
  const client = await pool.connect();
  const { userId } = req.params;

  try {
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
      throw new HttpError(404, "User not found.");
    }

    const targetUser = targetUserResult.rows[0];

    const allowedToDelete = canDeleteTargetAccount({
      requesterEmail: req.user.email,
      requesterId: req.user.id,
      targetUser,
    });

    if (!allowedToDelete) {
      throw new HttpError(
        403,
        "You do not have permission to permanently delete this account."
      );
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

    return {
      body: {
        message: "Account permanently deleted.",
        user: deletedUser.rows[0],
      },
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(500, "Could not permanently delete account.");
  } finally {
    client.release();
  }
};

const updateJobBidStyle = async (req) => {
  const { userId } = req.params;
  const { jobBidStyle } = req.body;

  const allowedStyles = ["copy_generate", "build_resume"];

  if (!allowedStyles.includes(jobBidStyle)) {
    throw new HttpError(400, "Invalid job-bid style.");
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
    throw new HttpError(404, "User not found.");
  }

  const targetUser = targetUserResult.rows[0];

  const requesterIsOwner = isOwnerEmail(req.user.email);
  const requesterIsSpecialAdmin = isSpecialAdminEmail(req.user.email);
  const targetIsUser = targetUser.account_type === "user";
  const targetIsAdmin = targetUser.account_type === "admin";

  if (!targetUser.is_approved) {
    throw new HttpError(403, "You can only update approved accounts.");
  }

  if (targetIsAdmin && !requesterIsOwner && !requesterIsSpecialAdmin) {
    throw new HttpError(403, "Only owner or special admin can update admins.");
  }

  if (targetIsUser && !requesterIsOwner) {
    const approvedByThisAdmin =
      String(targetUser.approved_by_admin_id || "") === String(req.user.id);

    if (!approvedByThisAdmin) {
      throw new HttpError(403, "You can only update users approved by you.");
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

  return {
    body: {
      message: "Job-bid style updated.",
      user: attachPermissionFlags(updatedUser.rows[0], {
        id: req.user.id,
        email: req.user.email,
      }),
    },
  };
};

module.exports = {
  signup,
  verifyPasscode,
  login,
  getCurrentUser,
  listUsers,
  updateUserApproval,
  deleteUserForever,
  updateJobBidStyle,
};
