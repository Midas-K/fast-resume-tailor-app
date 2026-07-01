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

const STRONG_REMOTE_ROLE_PATTERNS = [
  /\b100\s*%\s*remote\b/i,
  /\bfully\s+remote\s+(?:crew|team|company|positions?|role|jobs?|work)\b/i,
  /\b(?:full[-\s]?time|part[-\s]?time)\s*\/\s*remote\b/i,
  /\bremote\s*\/\s*(?:full[-\s]?time|part[-\s]?time)\b/i,
  /\bengineering\s*\/\s*full[-\s]?time\s*\/\s*remote\b/i,
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

const INTERVIEW_SECTION_STARTERS = [
  /\bwhat to expect in the interview process\b/i,
  /\bour interview process\b/i,
  /\binterview process\b/i,
  /\badditional information\b/i,
  /\bstep 1:\s/i,
];

const INTERVIEW_ONLY_ONSITE_PATTERNS = [
  /\b(?:may invite|invite) candidates[\s\S]{0,140}?(?:in[-\s]person|on[-\s]?site)[\s\S]{0,120}?\./gi,
  /\b(?:in[-\s]person|on[-\s]?site)[\s\S]{0,50}?(?:conversation|interview|visit|screening)\b/gi,
  /\binterviews? are conducted virtually[\s\S]{0,220}?\./gi,
  /\b(?:virtual|phone|video)\s+interview\b/gi,
];

const matchesAny = (text, patterns) => patterns.some((pattern) => pattern.test(text));

const stripInterviewSections = (text = "") => {
  let cutoff = text.length;

  for (const pattern of INTERVIEW_SECTION_STARTERS) {
    const match = pattern.exec(text);

    if (match && match.index < cutoff) {
      cutoff = match.index;
    }
  }

  return text.slice(0, cutoff).trim();
};

const removeInterviewOnlyOnsiteMentions = (text = "") => {
  let cleaned = text;

  for (const pattern of INTERVIEW_ONLY_ONSITE_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }

  return cleaned;
};

export const getRoleLocationText = (jobDescription = "") => {
  const text = String(jobDescription || "").trim();

  return removeInterviewOnlyOnsiteMentions(stripInterviewSections(text));
};

const hasStrongRemoteRoleDesignation = (text = "") =>
  matchesAny(text, STRONG_REMOTE_ROLE_PATTERNS);

export const detectJobDescriptionWorkMode = (jobDescription = "") => {
  const text = String(jobDescription || "").trim();

  if (!text) {
    return {
      type: WORK_LOCATION_TYPES.UNMENTIONED,
      label: "didn't mention",
    };
  }

  const roleLocationText = getRoleLocationText(text);
  const hasRemote = matchesAny(text, REMOTE_PATTERNS);
  const hasHybrid = matchesAny(roleLocationText, HYBRID_PATTERNS);
  const hasOnsite = matchesAny(roleLocationText, ONSITE_PATTERNS);
  const hasStrongRemote = hasStrongRemoteRoleDesignation(text);

  if (hasStrongRemote && !hasHybrid && !hasOnsite) {
    return {
      type: WORK_LOCATION_TYPES.REMOTE,
      label: "Remote",
    };
  }

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
