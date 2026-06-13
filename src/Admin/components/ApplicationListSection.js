import IconButton from "../../UI/IconButton";
import { formatDateTime } from "../../shared/utils/format";

function ApplicationListSection({
  profileApplications,
  selectedApplicationDate,
  selectedDateApplications,
  onDeleteApplications,
  onBackToDates,
  getIsoDateFromFormattedDate,
  getMonthFromDate,
  getYearFromDate,
}) {
  const { profile } = profileApplications;

  return (
    <section className="admin-content-card">
      <div className="admin-section-header">
        <div>
          <h2>Applications for {profile.profile_name}</h2>
          <p>{selectedApplicationDate} application list.</p>
        </div>

        <div className="profile-admin-actions compact-actions">
          <IconButton
            icon="trash"
            label="Delete this day"
            variant="danger"
            size="sm"
            onClick={() => {
              const selectedIsoDate =
                getIsoDateFromFormattedDate(selectedApplicationDate);

              onDeleteApplications({
                profile,
                deleteType: "day",
                date: selectedIsoDate,
              });
            }}
          />

          <IconButton
            icon="trash"
            label="Delete this month"
            variant="danger"
            size="sm"
            onClick={() => {
              const selectedIsoDate =
                getIsoDateFromFormattedDate(selectedApplicationDate);

              onDeleteApplications({
                profile,
                deleteType: "month",
                month: getMonthFromDate(selectedIsoDate),
              });
            }}
          />

          <IconButton
            icon="trash"
            label="Delete this year"
            variant="danger"
            size="sm"
            onClick={() => {
              const selectedIsoDate =
                getIsoDateFromFormattedDate(selectedApplicationDate);

              onDeleteApplications({
                profile,
                deleteType: "year",
                year: getYearFromDate(selectedIsoDate),
              });
            }}
          />

          <IconButton
            icon="trash"
            label="Delete all applications"
            variant="danger"
            size="sm"
            onClick={() =>
              onDeleteApplications({ profile, deleteType: "all" })
            }
          />

          <IconButton
            icon="arrowLeft"
            label="Back to dates"
            variant="ghost"
            size="sm"
            onClick={onBackToDates}
          />
        </div>
      </div>

      {selectedDateApplications.length === 0 ? (
        <div className="empty-user-profiles">
          No applications found for this date.
        </div>
      ) : (
        <div className="admin-table-wrap modern">
          <table className="admin-table modern">
            <thead>
              <tr>
                <th>No.</th>
                <th>Company Name</th>
                <th>Role Name</th>
                <th>Date - Time</th>
                <th>Applied Info</th>
              </tr>
            </thead>

            <tbody>
              {selectedDateApplications.map((row, index) => (
                <tr
                  key={`${row.companyName}-${row.roleName}-${row.appliedAt}-${index}`}
                >
                  <td>
                    <span className="status-badge approved">{index + 1}</span>
                  </td>

                  <td>{row.companyName}</td>
                  <td>{row.roleName}</td>
                  <td>{formatDateTime(row.appliedAt)}</td>
                  <td>
                    {row.profileName} - {row.profileEmail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default ApplicationListSection;
