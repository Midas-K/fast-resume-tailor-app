import {
  buildRecentPromptBannerLabel,
  buildRecentResumeBannerLabel,
} from "../shared/utils/applicationActionMessages";

function RecentActionBanner({ variant = "prompt", companyName = "", roleName = "" }) {
  const company = String(companyName || "").trim();
  const role = String(roleName || "").trim();

  if (!company && !role) {
    return null;
  }

  const label =
    variant === "resume"
      ? buildRecentResumeBannerLabel({ companyName: company, roleName: role })
      : buildRecentPromptBannerLabel({ companyName: company, roleName: role });

  return (
    <div
      className={`recent-action-banner recent-action-banner--${variant}`}
      role="status"
      aria-live="polite"
    >
      {label}
    </div>
  );
}

export default RecentActionBanner;
