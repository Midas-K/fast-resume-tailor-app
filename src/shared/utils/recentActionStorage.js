const promptKey = (profileId) => `rta_recent_prompt_${profileId}`;
const resumeKey = (profileId) => `rta_recent_resume_${profileId}`;

const readEntry = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const companyName = String(parsed?.companyName || "").trim();
    const roleName = String(parsed?.roleName || "").trim();

    if (!companyName || !roleName) {
      return null;
    }

    return { companyName, roleName };
  } catch {
    return null;
  }
};

const writeEntry = (key, entry) => {
  if (!entry?.companyName?.trim() || !entry?.roleName?.trim()) {
    localStorage.removeItem(key);
    return;
  }

  localStorage.setItem(
    key,
    JSON.stringify({
      companyName: entry.companyName.trim(),
      roleName: entry.roleName.trim(),
    })
  );
};

export const loadRecentPromptCopy = (profileId) =>
  profileId ? readEntry(promptKey(profileId)) : null;

export const saveRecentPromptCopy = (profileId, entry) => {
  if (!profileId) {
    return;
  }

  writeEntry(promptKey(profileId), entry);
};

export const loadRecentResumeSave = (profileId) =>
  profileId ? readEntry(resumeKey(profileId)) : null;

export const saveRecentResumeSave = (profileId, entry) => {
  if (!profileId) {
    return;
  }

  writeEntry(resumeKey(profileId), entry);
};
