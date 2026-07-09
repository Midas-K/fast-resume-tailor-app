export const APPLICATION_ACTION_TYPES = {
  PROMPT_COPIED: "prompt_copied",
  RESUME_SAVED: "resume_saved",
};

export const createApplicationActionEntry = ({
  type,
  companyName = "",
  roleName = "",
  detail = "",
} = {}) => {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    companyName: String(companyName || "").trim() || "Unknown Company",
    roleName: String(roleName || "").trim() || "Unknown Role",
    detail: String(detail || "").trim(),
    at: Date.now(),
  };
};

export const prependApplicationAction = (items = [], entry, limit = 8) => {
  if (!entry) {
    return items;
  }

  return [entry, ...items].slice(0, limit);
};
