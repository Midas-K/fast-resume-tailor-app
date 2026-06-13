const {
  isOwnerEmail,
  isSpecialAdminEmail,
  canManageAdminAccounts,
  canInspectAdminUsers,
} = require("../../utils/email");

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

  if (requesterIsSpecialAdmin) return false;

  if (requesterIsOwner) {
    return targetIsAdmin || targetIsUser;
  }

  if (targetIsAdmin) return false;

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

module.exports = {
  canDeleteTargetAccount,
  attachPermissionFlags,
};
