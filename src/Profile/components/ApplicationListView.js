import IconButton from "../../UI/IconButton";
import { formatDateTime } from "../../shared/utils/format";

function ApplicationListView({
  selectedApplicationDate,
  selectedDateRows,
  selectedCountMode,
  onBack,
}) {
  return (
    <main className="profile-dashboard single-profile-dashboard">
      <section className="card profile-card wide-profile-card">
        <div className="profile-card-header">
          <div>
            <h2>{selectedApplicationDate}</h2>
            <p>Company and role applications for this date.</p>
          </div>

          <IconButton
            icon="arrowLeft"
            label={
              selectedCountMode === "recent"
                ? "Back to profiles"
                : "Back to dates"
            }
            variant="ghost"
            onClick={onBack}
          />
        </div>

        <div className="admin-table-wrap modern">
          <table className="admin-table modern">
            <thead>
              <tr>
                <th>No.</th>
                <th>Company Name</th>
                <th>Role Name</th>
                <th>Date - Time</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {selectedDateRows.map((row, index) => (
                <tr key={row.id}>
                  <td>
                    <span className="status-badge approved">{index + 1}</span>
                  </td>

                  <td>{row.company_name}</td>
                  <td>{row.role_name}</td>
                  <td>{formatDateTime(row.created_at)}</td>
                  <td>
                    <span className="status-badge approved">Applied</span>
                  </td>
                </tr>
              ))}

              {selectedDateRows.length === 0 && (
                <tr>
                  <td colSpan="5">No applications found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default ApplicationListView;
