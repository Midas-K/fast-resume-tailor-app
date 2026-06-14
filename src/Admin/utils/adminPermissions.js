import { getBooleanFlag } from "../../shared/utils/flags";

export function getAdminPermissions(user) {
  const currentUserCanManageAdmins = getBooleanFlag(
    user?.can_manage_admin_accounts,
    user?.canManageAdminAccounts,
    user?.permissions?.can_manage_admin_accounts,
    user?.permissions?.canManageAdminAccounts
  );

  const currentUserCanInspectAdminUsers = getBooleanFlag(
    user?.can_inspect_admin_users,
    user?.canInspectAdminUsers,
    user?.permissions?.can_inspect_admin_users,
    user?.permissions?.canInspectAdminUsers
  );

  const canManageAdmins =
    currentUserCanManageAdmins || currentUserCanInspectAdminUsers;

  return {
    currentUserCanManageAdmins,
    currentUserCanInspectAdminUsers,
    canManageAdmins,
  };
}

export function isProtectedAdmin(adminItem) {
  return getBooleanFlag(
    adminItem?.is_protected_admin,
    adminItem?.isProtectedAdmin,
    adminItem?.is_owner_account,
    adminItem?.isOwnerAccount,
    adminItem?.is_special_admin,
    adminItem?.isSpecialAdmin
  );
}

export function canManageThisAdmin(adminItem, currentUserCanManageAdmins) {
  if (!currentUserCanManageAdmins) return false;
  if (isProtectedAdmin(adminItem)) return false;
  return true;
}

export function canDeleteAccount(accountItem) {
  return getBooleanFlag(
    accountItem?.can_delete_account,
    accountItem?.canDeleteAccount
  );
}

export function filterUsersControlledByAdmin(users, selectedAdmin) {
  if (!selectedAdmin) return [];

  return users.filter((item) => {
    if (item.account_type !== "user") return false;

    const approvedByIdMatches =
      item.approved_by_admin_id &&
      String(item.approved_by_admin_id) === String(selectedAdmin.id);

    const approvedByEmailMatches =
      item.approved_by_admin_email &&
      selectedAdmin.email &&
      String(item.approved_by_admin_email).trim().toLowerCase() ===
        String(selectedAdmin.email).trim().toLowerCase();

    return approvedByIdMatches || approvedByEmailMatches;
  });
}

export function filterProfilesForUser(allProfiles, selectedUser) {
  if (!selectedUser) return [];

  return allProfiles.filter(
    (profile) => String(profile.user_id) === String(selectedUser.id)
  );
}

export function sortByCreatedAtAsc(items = []) {
  return [...items].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );
}
