import Icon from "./Icon";

const VARIANT_CONFIG = {
  prompt: {
    icon: "copy",
    title: "Prompt copied",
  },
  resume: {
    icon: "fileDown",
    title: "Resume saved",
  },
};

function RecentActivityStrip({ variant = "prompt", companyName = "", roleName = "" }) {
  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.prompt;
  const company = String(companyName || "").trim();
  const role = String(roleName || "").trim();

  if (!company || !role) {
    return null;
  }

  return (
    <div
      className={`activity-strip activity-strip--${variant}`}
      role="status"
      aria-live="polite"
      aria-label={`${config.title}: ${company}, ${role}`}
    >
      <div className="activity-strip__badge">
        <Icon name={config.icon} size={14} />
        <span>{config.title}</span>
      </div>

      <div className="activity-strip__detail">
        <strong>{company}</strong>
        <span className="activity-strip__separator" aria-hidden="true">
          ·
        </span>
        <span>{role}</span>
      </div>
    </div>
  );
}

export default RecentActivityStrip;
