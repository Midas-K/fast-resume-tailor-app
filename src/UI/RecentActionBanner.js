import Icon from "./Icon";

const VARIANT_CONFIG = {
  prompt: {
    icon: "copy",
    label: "Recent copied Prompt",
  },
  resume: {
    icon: "fileDown",
    label: "Recent generated Resume",
  },
};

function RecentActionBanner({ variant = "prompt", companyName = "", roleName = "" }) {
  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.prompt;
  const company = String(companyName || "").trim();
  const role = String(roleName || "").trim();
  const isActive = Boolean(company && role);
  const detail = isActive ? `${company} - ${role}` : "—";

  return (
    <div
      className={`recent-action-box recent-action-box--${variant}${
        isActive ? " is-active" : ""
      }`}
      role="status"
      aria-live="polite"
      aria-label={`${config.label}: ${detail}`}
    >
      <div className="recent-action-box__icon" aria-hidden="true">
        <Icon name={config.icon} size={18} />
      </div>

      <p className="recent-action-box__text">
        <span className="recent-action-box__label">{config.label}:</span>{" "}
        <strong className="recent-action-box__value">{detail}</strong>
      </p>
    </div>
  );
}

export default RecentActionBanner;
