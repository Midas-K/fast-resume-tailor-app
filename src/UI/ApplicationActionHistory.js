import Icon from "./Icon";

const ACTION_LABELS = {
  prompt_copied: "Prompt copied",
  resume_saved: "PDF saved",
};

function formatActionTime(timestamp) {
  if (!timestamp) {
    return "";
  }

  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function ApplicationActionHistory({ items = [] }) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="application-action-history" aria-label="Recent application actions">
      <div className="application-action-history__header">
        <Icon name="clipboardList" size={14} />
        <strong>Recent actions</strong>
      </div>

      <ul className="application-action-history__list">
        {items.map((item) => (
          <li key={item.id} className={`application-action-history__item application-action-history__item--${item.type}`}>
            <div className="application-action-history__icon">
              <Icon
                name={item.type === "prompt_copied" ? "copy" : "fileDown"}
                size={14}
              />
            </div>

            <div className="application-action-history__copy">
              <span className="application-action-history__label">
                {ACTION_LABELS[item.type] || "Action"}
              </span>
              <p>
                <span>{item.companyName}</span>
                <span className="application-action-history__separator">·</span>
                <span>{item.roleName}</span>
              </p>
              {item.detail ? (
                <small>{item.detail}</small>
              ) : null}
            </div>

            <time className="application-action-history__time" dateTime={new Date(item.at).toISOString()}>
              {formatActionTime(item.at)}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default ApplicationActionHistory;
