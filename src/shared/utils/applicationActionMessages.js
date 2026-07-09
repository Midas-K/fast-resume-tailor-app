export const formatApplicationDetails = ({
  companyName = "",
  roleName = "",
} = {}) => {
  const company = String(companyName || "").trim() || "Unknown Company";
  const role = String(roleName || "").trim() || "Unknown Role";

  return `Company: ${company}\nRole: ${role}`;
};

export const buildPromptCopiedMessage = ({
  companyName = "",
  roleName = "",
} = {}) => {
  return `Prompt copied!\n\n${formatApplicationDetails({ companyName, roleName })}`;
};

export const buildRecentPromptBannerLabel = ({
  companyName = "",
  roleName = "",
} = {}) => {
  const company = String(companyName || "").trim() || "Unknown Company";
  const role = String(roleName || "").trim() || "Unknown Role";

  return `Recent copied Prompt: ${company} - ${role}`;
};

export const buildRecentResumeBannerLabel = ({
  companyName = "",
  roleName = "",
} = {}) => {
  const company = String(companyName || "").trim() || "Unknown Company";
  const role = String(roleName || "").trim() || "Unknown Role";

  return `Recent generated Resume: ${company} - ${role}`;
};

export const buildResumeSavedMessage = (
  saveResult,
  { companyName = "", roleName = "" } = {}
) => {
  const applicationDetails = formatApplicationDetails({ companyName, roleName });
  const savedPath =
    saveResult?.savedPath ||
    `${saveResult?.dateFolder}/${saveResult?.companyRoleFolder}/${saveResult?.fileName}`;

  if (saveResult?.saveMode === "zip") {
    return `${applicationDetails}\n\nResume saved to Downloads as a zip with the same folder layout as desktop.\n${savedPath}\nUnzip ${saveResult.zipFileName || "the download"} to open it.`;
  }

  return `${applicationDetails}\n\nResume saved to your device!\n${savedPath}`;
};
