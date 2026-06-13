import IconButton from "../../UI/IconButton";

function UserTable({
  users,
  selectedUserId,
  onSelectUser,
  onUpdateApproval,
  onUpdateJobBidStyle,
  onDeleteAccount,
  canDeleteAccount,
  emptyMessage = "No users found.",
}) {
  return (
    <div className="admin-table-wrap modern">
      <table className="admin-table modern">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Type</th>
            <th>Status</th>
            <th>Approved By</th>
            <th>Job-Bid Style</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {users.map((item) => (
            <tr
              key={item.id}
              className={
                selectedUserId === item.id
                  ? "clickable-user-row selected"
                  : "clickable-user-row"
              }
              onClick={() => onSelectUser(item)}
            >
              <td>{item.name}</td>
              <td>{item.email}</td>
              <td>{item.account_type}</td>

              <td>
                <span
                  className={
                    item.is_approved
                      ? "status-badge approved"
                      : "status-badge pending"
                  }
                >
                  {item.is_approved ? "Approved" : "Pending"}
                </span>
              </td>

              <td>
                {item.approved_by_admin_name
                  ? `${item.approved_by_admin_name} (${item.approved_by_admin_email})`
                  : "-"}
              </td>

              <td>
                <select
                  className="admin-select"
                  value={item.job_bid_style || "copy_generate"}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onUpdateJobBidStyle(item.id, e.target.value)}
                  disabled={!item.is_approved}
                >
                  <option value="copy_generate">
                    Copy Prompt & Generate Resume
                  </option>
                  <option value="build_resume">Build Resume</option>
                </select>
              </td>

              <td>{new Date(item.created_at).toLocaleString()}</td>

              <td>
                <div className="profile-admin-actions compact-actions">
                  {item.is_approved ? (
                    <IconButton
                      icon="ban"
                      label="Block user"
                      variant="danger"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateApproval(item.id, false);
                      }}
                    />
                  ) : (
                    <IconButton
                      icon="userCheck"
                      label="Approve user"
                      variant="success"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateApproval(item.id, true);
                      }}
                    />
                  )}

                  {canDeleteAccount(item) && (
                    <IconButton
                      icon="trash"
                      label="Delete forever"
                      variant="danger"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteAccount(item);
                      }}
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}

          {users.length === 0 && (
            <tr>
              <td colSpan="8">{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default UserTable;
