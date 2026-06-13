import IconButton from "../../UI/IconButton";

function ApplicationDatesSection({
  profileApplications,
  onBack,
  onOpenDate,
  onDeleteDay,
  getIsoDateFromFormattedDate,
}) {
  const { profile, dateGroups } = profileApplications;

  return (
    <section className="admin-content-card">
      <div className="admin-section-header">
        <div>
          <h2>Applications for {profile.profile_name}</h2>
          <p>Click a date row to view applications submitted by this profile.</p>
        </div>

        <IconButton
          icon="arrowLeft"
          label="Back to profiles"
          variant="ghost"
          onClick={onBack}
        />
      </div>

      {dateGroups.length === 0 ? (
        <div className="empty-user-profiles">
          This profile has no applications yet.
        </div>
      ) : (
        <div className="admin-table-wrap modern">
          <table className="admin-table modern">
            <thead>
              <tr>
                <th>No.</th>
                <th>Date</th>
                <th>Applications</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {dateGroups.map((group, index) => (
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

                  <td>
                    <IconButton
                      icon="trash"
                      label="Delete this day"
                      variant="danger"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteDay({
                          profile,
                          deleteType: "day",
                          date: getIsoDateFromFormattedDate(group.date),
                        });
                      }}
                    />
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

export default ApplicationDatesSection;
