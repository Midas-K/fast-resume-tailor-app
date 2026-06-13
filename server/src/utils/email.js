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
  return isOwnerEmail(email);
};

module.exports = {
  normalizeEmail,
  isOwnerEmail,
  isSpecialAdminEmail,
  isSpecialPasscodeEmail,
  getPasscodeHashForEmail,
  canManageAdminAccounts,
  canInspectAdminUsers,
};
