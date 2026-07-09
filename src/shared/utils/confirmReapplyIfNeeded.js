import { fetchExistingApplicationMatch } from "../api/applicationsApi";
import { formatEstDateLabel } from "./estDateTime";

export const buildReapplyConfirmMessage = (appliedDateLabel) => {
  return `You applied this position at ${appliedDateLabel}. Will You going to apply for this position again?`;
};

export const confirmReapplyIfNeeded = async ({
  profileId,
  companyName,
  roleName,
  showConfirm,
}) => {
  if (!profileId || !companyName?.trim() || !roleName?.trim() || !showConfirm) {
    return {
      proceed: true,
      allowReapply: false,
    };
  }

  const match = await fetchExistingApplicationMatch({
    profileId,
    companyName,
    roleName,
  });

  if (!match?.exists) {
    return {
      proceed: true,
      allowReapply: false,
    };
  }

  const appliedDateLabel = formatEstDateLabel(match.appliedAt);
  const confirmed = await showConfirm(buildReapplyConfirmMessage(appliedDateLabel), {
    title: "Apply again?",
    confirmLabel: "Yes",
    cancelLabel: "No",
  });

  return {
    proceed: confirmed,
    allowReapply: confirmed,
  };
};
