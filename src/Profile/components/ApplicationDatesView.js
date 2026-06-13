import IconButton from "../../UI/IconButton";

function ApplicationDatesView({
  applicationDateGroups,
  onBack,
  onOpenDate,
}) {
  return (
    <main className="profile-dashboard single-profile-dashboard">
      <section className="card profile-card wide-profile-card">
        <div className="profile-card-header">
          <div>
            <h2>Select Date</h2>
            <p>Click one date row to view application details.</p>
          </div>

          <IconButton
            icon="arrowLeft"
            label="Back to profiles"
            variant="ghost"
            onClick={onBack}
          />
        </div>

        <div className="admin-table-wrap modern">
          <table className="admin-table modern">
            <thead>
              <tr>
                <th>No.</th>
                <th>Date</th>
                <th>Applications</th>
              </tr>
            </thead>

            <tbody>
              {applicationDateGroups.map((group, index) => (
                <tr
                  key={group.date}
                  className="clickable-user-row"
                  onClick={() => onOpenDate(group.date)}
                >
                  <td>
                    <span className="status-badge approved">{index + 1}</span>
                  </td>

                  <td>{group.date}</td>

                  <td>
                    <span className="status-badge approved">
                      {group.rows.length}
                    </span>
                  </td>
                </tr>
              ))}

              {applicationDateGroups.length === 0 && (
                <tr>
                  <td colSpan="3">No applications found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default ApplicationDatesView;
