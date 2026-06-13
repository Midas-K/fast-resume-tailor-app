import IconButton from "../../UI/IconButton";

function AdminsTable({
  adminUsers,
  selectedAdminId,
  canInspectAdminUsers,
  canManageThisAdmin,
  isProtectedAdmin,
  canDeleteAccount,
  onSelectAdmin,
  onUpdateApproval,
  onDeleteAccount,
}) {
  return (
    <div className="admin-table-wrap modern">
      <table className="admin-table modern">
        <thead>
          <tr>
            <th>Admin Name</th>
            <th>Email</th>
            <th>Status</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {adminUsers.map((adminItem) => {
            const protectedAdmin = isProtectedAdmin(adminItem);

            return (
              <tr
                key={adminItem.id}
                className={
                  selectedAdminId === adminItem.id
                    ? "clickable-user-row selected"
                    : "clickable-user-row"
                }
                onClick={() => {
                  if (!canInspectAdminUsers) return;
                  onSelectAdmin(adminItem);
                }}
              >
                <td>
                  {adminItem.name}
                  {protectedAdmin ? " (Protected)" : ""}
                </td>

                <td>{adminItem.email}</td>

                <td>
                  <span
                    className={
                      adminItem.is_approved
                        ? "status-badge approved"
                        : "status-badge pending"
                    }
                  >
                    {adminItem.is_approved ? "Approved" : "Pending"}
                  </span>
                </td>

                <td>{new Date(adminItem.created_at).toLocaleString()}</td>

                <td>
                  <div className="profile-admin-actions compact-actions">
                    {protectedAdmin ? (
                      <span className="admin-note">Protected</span>
                    ) : !canManageThisAdmin(adminItem) ? (
                      <span className="admin-note">No Access</span>
                    ) : adminItem.is_approved ? (
                      <IconButton
                        icon="ban"
                        label="Block admin"
                        variant="danger"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateApproval(adminItem.id, false);
                        }}
                      />
                    ) : (
                      <IconButton
                        icon="userCheck"
                        label="Approve admin"
                        variant="success"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateApproval(adminItem.id, true);
                        }}
                      />
                    )}

                    {!protectedAdmin && canDeleteAccount(adminItem) && (
                      <IconButton
                        icon="trash"
                        label="Delete forever"
                        variant="danger"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAccount(adminItem);
                        }}
                      />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}

          {adminUsers.length === 0 && (
            <tr>
              <td colSpan="5">No admins found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default AdminsTable;
