export const WORK_LOCATION_TYPES = {
  REMOTE: "remote",
  ONSITE: "onsite",
  HYBRID: "hybrid",
  UNMENTIONED: "unmentioned",
};

const REMOTE_PATTERNS = [
  /\b100\s*%\s*remote\b/i,
  /\bfully\s+remote\b/i,
  /\bremote[-\s]first\b/i,
  /\bremote[-\s]only\b/i,
  /\bwork\s+from\s+home\b/i,
  /\bwfh\b/i,
  /\btelecommute\b/i,
  /\btelecommuting\b/i,
  /\bremote\s+position\b/i,
  /\bremote\s+role\b/i,
  /\bremote\s+job\b/i,
  /\bremote\s+work\b/i,
  /\bremote\b/i,
];

const HYBRID_PATTERNS = [
  /\bhybrid\b/i,
  /\bon[-\s]site\s+and\s+remote\b/i,
  /\bremote\s+and\s+on[-\s]site\b/i,
  /\bpartially\s+remote\b/i,
  /\b\d+\s+days?\s+(?:in[-\s]office|on[-\s]site)\b/i,
];

const ONSITE_PATTERNS = [
  /\bon[-\s]?site\b/i,
  /\bin[-\s]office\b/i,
  /\bin[-\s]person\b/i,
  /\bon\s+premises\b/i,
  /\bon\s+location\b/i,
];

const matchesAny = (text, patterns) => patterns.some((pattern) => pattern.test(text));

export const detectJobDescriptionWorkMode = (jobDescription = "") => {
  const text = String(jobDescription || "").trim();

  if (!text) {
    return {
      type: WORK_LOCATION_TYPES.UNMENTIONED,
      label: "didn't mention",
    };
  }

  const hasRemote = matchesAny(text, REMOTE_PATTERNS);
  const hasHybrid = matchesAny(text, HYBRID_PATTERNS);
  const hasOnsite = matchesAny(text, ONSITE_PATTERNS);

  if (hasHybrid || (hasRemote && hasOnsite)) {
    return {
      type: WORK_LOCATION_TYPES.HYBRID,
      label: "Hybrid",
    };
  }

  if (hasOnsite) {
    return {
      type: WORK_LOCATION_TYPES.ONSITE,
      label: "On-site",
    };
  }

  if (hasRemote) {
    return {
      type: WORK_LOCATION_TYPES.REMOTE,
      label: "Remote",
    };
  }

  return {
    type: WORK_LOCATION_TYPES.UNMENTIONED,
    label: "didn't mention",
  };
};

export const shouldConfirmNonRemoteCopy = (workMode) =>
  workMode?.type !== WORK_LOCATION_TYPES.REMOTE;

export const buildNonRemoteConfirmMessage = (workMode) => {
  const messageByType = {
    [WORK_LOCATION_TYPES.ONSITE]:
      "This is not a Remote role. This is an On-site role. Still wanna continue?",
    [WORK_LOCATION_TYPES.HYBRID]:
      "This is not a Remote role. This is a Hybrid role. Still wanna continue?",
    [WORK_LOCATION_TYPES.UNMENTIONED]:
      "This is not a Remote role. The JD does not mention Remote, On-site, or Hybrid. Still wanna continue?",
  };

  return (
    messageByType[workMode?.type] ||
    "This is not a Remote role. Still wanna continue?"
  );
};
