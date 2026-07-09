import { fetchExistingApplicationMatch } from "../api/applicationsApi";
import { formatEstDateLabel } from "./estDateTime";

const NEGATIVE_CACHE_TTL_MS = 60_000;
const negativeMatchCache = new Map();

const buildNegativeCacheKey = (profileId, companyName, roleName) => {
  return `${profileId}:${String(companyName || "")
    .trim()
    .toLowerCase()}:${String(roleName || "").trim().toLowerCase()}`;
};

export const invalidateReapplyNegativeCache = (profileId) => {
  if (!profileId) {
    negativeMatchCache.clear();
    return;
  }

  const prefix = `${profileId}:`;

  for (const key of negativeMatchCache.keys()) {
    if (key.startsWith(prefix)) {
      negativeMatchCache.delete(key);
    }
  }
};

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

  const cacheKey = buildNegativeCacheKey(profileId, companyName, roleName);
  const cachedNegative = negativeMatchCache.get(cacheKey);

  if (cachedNegative && Date.now() < cachedNegative.expiresAt) {
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
    negativeMatchCache.set(cacheKey, {
      expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS,
    });

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
