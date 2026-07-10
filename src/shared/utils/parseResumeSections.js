const SECTION_DEFINITIONS = [
  {
    type: "summary",
    patterns: [
      /^professional summary$/i,
      /^executive summary$/i,
      /^career summary$/i,
      /^profile summary$/i,
      /^summary of qualifications$/i,
      /^qualifications summary$/i,
      /^summary$/i,
    ],
  },
  {
    type: "skills",
    patterns: [
      /^technical skills?$/i,
      /^core skills?$/i,
      /^professional skills?$/i,
      /^key skills?$/i,
      /^relevant skills?$/i,
      /^hard skills?$/i,
      /^soft skills?$/i,
      /^programming skills?$/i,
      /^technology skills?$/i,
      /^tech skills?$/i,
      /^skills? and tools$/i,
      /^skills? & tools$/i,
      /^tools and skills?$/i,
      /^tools & skills?$/i,
      /^skill\s*sets?$/i,
      /^skills?\s*sets?$/i,
      /^technical skill\s*sets?$/i,
      /^core skill\s*sets?$/i,
      /^skills? summary$/i,
      /^skills? overview$/i,
      /^areas of expertise$/i,
      /^technical competencies$/i,
      /^core competencies$/i,
      /^competencies$/i,
      /^expertise$/i,
      /^technologies$/i,
      /^technical expertise$/i,
      /^skills?$/i,
    ],
  },
  {
    type: "experience",
    patterns: [
      /^technical experience$/i,
      /^professional experience$/i,
      /^work experience$/i,
      /^relevant experience$/i,
      /^employment history$/i,
      /^career history$/i,
      /^work history$/i,
      /^experience$/i,
    ],
  },
  {
    type: "certifications",
    patterns: [
      /^licenses and certifications$/i,
      /^licenses & certifications$/i,
      /^certifications and licenses$/i,
      /^certifications & licenses$/i,
      /^professional certifications$/i,
      /^certifications$/i,
      /^certification$/i,
      /^credentials$/i,
      /^licenses$/i,
    ],
  },
  {
    type: "ignore",
    patterns: [
      /^education$/i,
      /^academic background$/i,
      /^educational background$/i,
      /^academic credentials$/i,
      /^projects?$/i,
      /^selected projects$/i,
      /^key projects$/i,
      /^awards?$/i,
      /^honors?( and awards?)?$/i,
      /^publications?$/i,
      /^references?$/i,
      /^languages?$/i,
      /^volunteer( experience)?$/i,
      /^interests?$/i,
      /^additional information$/i,
      /^contact information$/i,
      /^objective$/i,
    ],
  },
];

const TIMELINE_PATTERN =
  /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?,?\s+\d{4}\s*[-–—]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?,?\s+\d{4}|Present|Current))|(?:\d{4}\s*[-–—]\s*(?:\d{4}|Present|Current))/i;

const normalizeTimelineInput = (text = "") => {
  return stripMarkdownInline(text)
    .replace(
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*,\s*(\d{4})\b/gi,
      "$1 $2"
    )
    .replace(/\s+/g, " ")
    .trim();
};

const JOB_TITLE_HINT =
  /\b(engineer|scientist|developer|architect|manager|analyst|consultant|director|lead|specialist|programmer|designer)\b/i;

const escapeRegExp = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const stripMarkdownInline = (text = "") => {
  return String(text)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
};

export const normalizeHeaderLine = (line = "") => {
  return stripMarkdownInline(String(line).trim())
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/^[>•]+\s*/, "")
    .replace(/[:：]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
};

export const detectSectionType = (line = "") => {
  const normalized = normalizeHeaderLine(line);

  if (!normalized || normalized.length > 100) {
    return null;
  }

  for (const definition of SECTION_DEFINITIONS) {
    for (const pattern of definition.patterns) {
      if (pattern.test(normalized)) {
        return definition.type;
      }
    }
  }

  return null;
};

export const isBulletLine = (line = "") => {
  const trimmed = String(line).trim();

  return (
    /^[-•*●○◦+]\s+/.test(trimmed) ||
    /^\d+[.)]\s+/.test(trimmed) ||
    /^>\s+/.test(trimmed)
  );
};

export const stripBulletPrefix = (line = "") => {
  return String(line)
    .trim()
    .replace(/^[-•*●○◦+]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/^>\s+/, "")
    .trim();
};


const linesToText = (lines = []) => lines.filter(Boolean).join("\n");

const normalizeBulletSectionContent = (text = "") => {
  const cleaned = stripMarkdownInline(text);
  const rawLines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (rawLines.length === 0) {
    return "";
  }

  if (rawLines.some((line) => isBulletLine(line))) {
    return linesToText(rawLines.map(stripBulletPrefix));
  }

  // Plain sentences only: each non-empty line becomes one PDF bullet.
  // Blank lines are ignored — works whether users paste with or without gaps.
  return linesToText(rawLines);
};

export const normalizeSkillsContent = (text = "") => {
  return normalizeBulletSectionContent(text);
};

export const normalizeCertificationsContent = (text = "") => {
  return normalizeBulletSectionContent(text);
};

export const normalizeExperienceBodyToLines = (text = "") => {
  return normalizeBulletSectionContent(text);
};

const parseInlineSectionHeader = (line = "") => {
  const trimmed = stripMarkdownInline(line);
  const match = trimmed.match(/^(.{2,60}?):\s+(.+)$/);

  if (!match) {
    return null;
  }

  const sectionType = detectSectionType(match[1]);

  if (!sectionType || sectionType === "ignore") {
    return null;
  }

  return {
    type: sectionType,
    remainder: match[2].trim(),
  };
};

const isDividerLine = (line = "") => {
  const trimmed = String(line).trim();

  return (
    trimmed.length > 0 &&
    /^[-_*=~─—]{3,}$/.test(trimmed.replace(/\s+/g, ""))
  );
};

export const isTimelineText = (text = "") =>
  TIMELINE_PATTERN.test(normalizeTimelineInput(text));

const isEducationHeader = (line = "") => {
  const normalized = normalizeHeaderLine(line);

  return (
    /^education$/i.test(normalized) ||
    /^academic background$/i.test(normalized) ||
    /^educational background$/i.test(normalized) ||
    /^academic credentials$/i.test(normalized)
  );
};

export const normalizeCompareText = (value = "") => {
  return stripMarkdownInline(value)
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s\-|/,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const normalizeTimelineText = (value = "") => {
  return normalizeCompareText(normalizeTimelineInput(value))
    .replace(/\bcurrent\b/g, "present")
    .replace(/,\s*/g, " ")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
};

export const compareTextsExactly = (left = "", right = "") => {
  return normalizeCompareText(left) === normalizeCompareText(right);
};

export const normalizeDegreeText = (value = "") => {
  let text = normalizeCompareText(value);

  const parts = text.split(/\s*\|\s*/).map((part) => part.trim()).filter(Boolean);

  if (parts.length > 1 && isTimelineText(parts[parts.length - 1])) {
    text = parts.slice(0, -1).join(" ");
  }

  return text
    .replace(
      /\b(bachelor|master|doctor|associate)([^,]*)\s*,\s*/g,
      "$1$2 in "
    )
    .replace(/\s+in\s+in\s+/g, " in ")
    .replace(/\s+/g, " ")
    .trim();
};

export const compareDegreesExactly = (left = "", right = "") => {
  if (compareTextsExactly(left, right)) {
    return true;
  }

  return normalizeDegreeText(left) === normalizeDegreeText(right);
};

export const compareTimelinesExactly = (left = "", right = "") => {
  const normalizedLeft = normalizeTimelineText(left).replace(/\s/g, "");
  const normalizedRight = normalizeTimelineText(right).replace(/\s/g, "");

  return (
    normalizeTimelineText(left) === normalizeTimelineText(right) ||
    normalizedLeft === normalizedRight
  );
};

export const parseCompanyTimelineLine = (line = "") => {
  const trimmed = stripMarkdownInline(line);
  const tripleMatch = trimmed.match(/^(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)$/);

  if (tripleMatch) {
    const left = tripleMatch[1].trim();
    const middle = tripleMatch[2].trim();
    const right = tripleMatch[3].trim();

    if (isTimelineText(right) && !isTimelineText(left) && !isTimelineText(middle)) {
      return { company: left, title: middle, timeline: right };
    }

    if (isTimelineText(middle) && !isTimelineText(left) && !isTimelineText(right)) {
      return { company: left, timeline: middle, title: right };
    }
  }

  const match = trimmed.match(/^(.+?)\s*\|\s*(.+)$/);

  if (!match) {
    return null;
  }

  const left = match[1].trim();
  const right = match[2].trim();

  if (!left || !right) {
    return null;
  }

  if (isTimelineText(right)) {
    return { company: left, timeline: right };
  }

  if (isTimelineText(left)) {
    return { company: right, timeline: left };
  }

  return null;
};

export const parseCompanyTitleLine = (line = "") => {
  const trimmed = stripMarkdownInline(line);

  if (!trimmed || isBulletLine(trimmed) || isExperienceBodyLine(trimmed)) {
    return null;
  }

  const match = trimmed.match(/^(.+?)\s*\|\s*(.+)$/);

  if (!match) {
    return parseTitleAtCompanyLine(trimmed);
  }

  const left = match[1].trim();
  const right = match[2].trim();

  if (!left || !right || isTimelineText(left) || isTimelineText(right)) {
    return null;
  }

  const leftIsTitle = looksLikeJobTitleLine(left);
  const rightIsTitle = looksLikeJobTitleLine(right);

  if (rightIsTitle && !leftIsTitle) {
    return { company: left, title: right };
  }

  if (leftIsTitle && !rightIsTitle) {
    return { company: right, title: left };
  }

  if (rightIsTitle) {
    return { company: left, title: right };
  }

  if (leftIsTitle) {
    return { company: right, title: left };
  }

  if (left.split(/\s+/).length <= right.split(/\s+/).length) {
    return { company: left, title: right };
  }

  return { company: right, title: left };
};

const parseTitleAtCompanyLine = (line = "") => {
  const trimmed = stripMarkdownInline(line);

  if (!trimmed || isBulletLine(trimmed) || isExperienceBodyLine(trimmed)) {
    return null;
  }

  const match = trimmed.match(/^(.+?)\s+at\s+(.+)$/i);

  if (!match) {
    return null;
  }

  const left = match[1].trim();
  const right = match[2].trim();

  if (!left || !right || isTimelineText(left) || isTimelineText(right)) {
    return null;
  }

  if (looksLikeJobTitleLine(left) && looksLikeCompanyName(right)) {
    return { title: left, company: right };
  }

  if (looksLikeJobTitleLine(right) && looksLikeCompanyName(left)) {
    return { title: right, company: left };
  }

  return null;
};

export const parseSchoolDegreeLine = (line = "") => {
  const trimmed = stripMarkdownInline(line);
  const schoolDegreeTimeline = parseSchoolDegreeTimelineLine(trimmed);

  if (schoolDegreeTimeline) {
    return {
      school: schoolDegreeTimeline.school,
      degree: schoolDegreeTimeline.degree,
    };
  }

  if ((trimmed.match(/\|/g) || []).length >= 2) {
    return null;
  }

  const match = trimmed.match(/^(.+?)\s*\|\s*(.+)$/);

  if (!match) {
    return null;
  }

  const left = match[1].trim();
  const right = match[2].trim();

  if (!left || !right || isTimelineText(left) || isTimelineText(right)) {
    return null;
  }

  const leftIsDegree = DEGREE_HINT.test(left);
  const rightIsDegree = DEGREE_HINT.test(right);
  const leftIsSchool = SCHOOL_HINT.test(left);
  const rightIsSchool = SCHOOL_HINT.test(right);

  if (rightIsDegree && (leftIsSchool || !rightIsSchool)) {
    return { school: left, degree: right };
  }

  if (leftIsDegree && (rightIsSchool || !leftIsSchool)) {
    return { school: right, degree: left };
  }

  if (rightIsDegree) {
    return { school: left, degree: right };
  }

  if (leftIsDegree) {
    return { school: right, degree: left };
  }

  if (leftIsSchool) {
    return { school: left, degree: right };
  }

  if (rightIsSchool) {
    return { school: right, degree: left };
  }

  return { school: left, degree: right };
};

export const parseDegreeTimelineLine = (line = "") => {
  const trimmed = stripMarkdownInline(line);
  const match = trimmed.match(/^(.+?)\s*\|\s*(.+)$/);

  if (!match) {
    return null;
  }

  const left = match[1].trim();
  const right = match[2].trim();

  if (!left || !right || isTimelineText(left) || !isTimelineText(right)) {
    return null;
  }

  return {
    degree: left,
    timeline: right,
  };
};

export const parseSchoolDegreeTimelineLine = (line = "") => {
  const trimmed = stripMarkdownInline(line);
  const match = trimmed.match(/^(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)$/);

  if (!match) {
    return null;
  }

  const left = match[1].trim();
  const middle = match[2].trim();
  const right = match[3].trim();

  if (!left || !middle || !right || !isTimelineText(right)) {
    return null;
  }

  if (isTimelineText(left) || isTimelineText(middle)) {
    return null;
  }

  const leftIsSchool = SCHOOL_HINT.test(left);
  const middleIsSchool = SCHOOL_HINT.test(middle);
  const leftIsDegree = DEGREE_HINT.test(left);
  const middleIsDegree = DEGREE_HINT.test(middle);

  if (leftIsSchool && middleIsDegree) {
    return { school: left, degree: middle, timeline: right };
  }

  if (leftIsDegree && middleIsSchool) {
    return { school: middle, degree: left, timeline: right };
  }

  if (leftIsSchool) {
    return { school: left, degree: middle, timeline: right };
  }

  if (middleIsSchool) {
    return { school: middle, degree: left, timeline: right };
  }

  if (leftIsDegree) {
    return { school: middle, degree: left, timeline: right };
  }

  if (middleIsDegree) {
    return { school: left, degree: middle, timeline: right };
  }

  return { school: left, degree: middle, timeline: right };
};

const isStandaloneEducationTimelineLine = (line = "") => {
  const trimmed = stripMarkdownInline(line).trim();

  if (!trimmed || !isTimelineText(trimmed)) {
    return false;
  }

  if (parseDegreeTimelineLine(trimmed) || parseSchoolDegreeTimelineLine(trimmed)) {
    return false;
  }

  return !DEGREE_HINT.test(trimmed);
};

const isEducationHeaderLine = (line = "") => {
  const trimmed = stripMarkdownInline(line).trim();

  if (!trimmed) {
    return false;
  }

  return (
    Boolean(parseSchoolDegreeTimelineLine(trimmed)) ||
    Boolean(parseSchoolDegreeLine(trimmed)) ||
    Boolean(parseDegreeTimelineLine(trimmed)) ||
    isStandaloneEducationTimelineLine(trimmed) ||
    (SCHOOL_HINT.test(trimmed) && !looksLikeJobTitleLine(trimmed)) ||
    (DEGREE_HINT.test(trimmed) && !isExperienceBodyLine(trimmed))
  );
};

const parseTitleTimelineLine = (line = "") => {
  const trimmed = stripMarkdownInline(line);
  const match = trimmed.match(/^(.+?)\s*\|\s*(.+)$/);

  if (!match) {
    return null;
  }

  const left = match[1].trim();
  const right = match[2].trim();

  if (!isTimelineText(right)) {
    return null;
  }

  return {
    title: left,
    timeline: right,
  };
};

const DEGREE_HINT =
  /\b(bachelor|master|ph\.?d|b\.?s\.?|b\.?a\.?|m\.?s\.?|m\.?a\.?|mba|associate|diploma|degree)\b/i;

const SCHOOL_HINT =
  /\b(university|college|institute|school|academy|polytechnic)\b/i;

const looksLikeJobTitleLine = (line = "") => {
  const trimmed = stripMarkdownInline(line);

  if (!trimmed || isBulletLine(trimmed) || parseCompanyTimelineLine(trimmed)) {
    return false;
  }

  if (trimmed.length > 160) {
    return false;
  }

  if (JOB_TITLE_HINT.test(trimmed)) {
    return true;
  }

  if (trimmed.length > 90 || /[.!?]$/.test(trimmed)) {
    return false;
  }

  return (
    /[()/]/.test(trimmed) ||
    /\b(senior|staff|principal|lead|jr|sr|i{1,3}|ii|iii|iv)\b/i.test(trimmed)
  );
};

const looksLikeCompanyName = (value = "") => {
  const trimmed = stripMarkdownInline(value).trim();

  if (!trimmed || trimmed.length < 2 || isTimelineText(trimmed)) {
    return false;
  }

  if (!/[a-z]/i.test(trimmed)) {
    return false;
  }

  if (/^\d/.test(trimmed)) {
    return false;
  }

  if (
    /^\d+(\.\d+)?\s*(fps|ms|hz|cm|mm|m|meter|meters|percent|%)\b/i.test(trimmed) ||
    /^(fps|ms|hz|kb|mb|gb|tb)\b/i.test(trimmed)
  ) {
    return false;
  }

  if (trimmed.length > 120) {
    return false;
  }

  return true;
};

const isExperienceBodyLine = (line = "") => {
  const trimmed = stripMarkdownInline(line);

  if (!trimmed || isBulletLine(trimmed)) {
    return Boolean(trimmed && isBulletLine(trimmed));
  }

  if (trimmed.length > 180) {
    return true;
  }

  if (
    /\bat\s+\d/.test(trimmed) ||
    /\bat\s+\d+(\.\d+)?\s*(fps|hz|ms|cm|mm|meter|meters|percent|%)\b/i.test(
      trimmed
    )
  ) {
    return true;
  }

  return /[.!?]$/.test(trimmed) && trimmed.split(/\s+/).length >= 8;
};

const looksLikeExperienceDetailLine = (line = "") => {
  return isExperienceBodyLine(line);
};

const isExperienceHeaderLine = (line = "") => {
  const trimmed = stripMarkdownInline(line).trim();

  if (!trimmed) {
    return false;
  }

  return (
    isTimelineText(trimmed) ||
    Boolean(parseCompanyTimelineLine(trimmed)) ||
    Boolean(parseTitleTimelineLine(trimmed)) ||
    Boolean(parseCompanyTitleLine(trimmed)) ||
    looksLikeJobTitleLine(trimmed)
  );
};

const splitExperienceHeaderAndBody = (blockLines = []) => {
  const headerLines = [];
  const bodyLines = [];

  blockLines.forEach((line) => {
    const trimmed = stripMarkdownInline(line).trim();

    if (!trimmed) {
      return;
    }

    if (headerLines.length === 0 && !isExperienceBodyLine(trimmed)) {
      headerLines.push(trimmed);
      return;
    }

    if (headerLines.length > 0 && !isExperienceBodyLine(trimmed)) {
      if (headerLines.length < 4 && isExperienceHeaderLine(trimmed)) {
        headerLines.push(trimmed);
        return;
      }
    }

    bodyLines.push(line);
  });

  return { headerLines, bodyLines };
};

export const parseExperienceHeaderLines = (headerLines = [], profileHint = null) => {
  const lines = headerLines
    .map((line) => stripMarkdownInline(line).trim())
    .filter(Boolean);

  const fields = {
    company: "",
    title: "",
    timeline: "",
  };
  const consumedLines = new Set();

  const assignField = (key, value) => {
    if (!value || fields[key]) {
      return;
    }

    fields[key] = value;
  };

  const consumeStructuredLine = (index, values = {}) => {
    Object.entries(values).forEach(([key, value]) => {
      assignField(key, value);
    });
    consumedLines.add(index);
  };

  const markHeuristicLine = (index, key, value) => {
    if (!value || consumedLines.has(index)) {
      return;
    }

    assignField(key, value);
    consumedLines.add(index);
  };

  lines.forEach((line, index) => {
    const companyTimeline = parseCompanyTimelineLine(line);

    if (companyTimeline) {
      consumeStructuredLine(index, {
        company: companyTimeline.company,
        title: companyTimeline.title || "",
        timeline: companyTimeline.timeline || "",
      });
      return;
    }

    const companyTitle = parseCompanyTitleLine(line);

    if (companyTitle) {
      consumeStructuredLine(index, {
        company: companyTitle.company,
        title: companyTitle.title,
      });
      return;
    }

    const titleTimeline = parseTitleTimelineLine(line);

    if (titleTimeline && looksLikeJobTitleLine(titleTimeline.title)) {
      consumeStructuredLine(index, {
        title: titleTimeline.title,
        timeline: titleTimeline.timeline,
      });
    }
  });

  lines.forEach((line, index) => {
    if (consumedLines.has(index)) {
      return;
    }

    if (isTimelineText(line)) {
      markHeuristicLine(index, "timeline", line);
    }
  });

  if (profileHint) {
    lines.forEach((line, index) => {
      if (consumedLines.has(index)) {
        return;
      }

      if (
        profileHint.companyName &&
        compareTextsExactly(line, profileHint.companyName)
      ) {
        markHeuristicLine(index, "company", line);
        return;
      }

      if (profileHint.title && compareTextsExactly(line, profileHint.title)) {
        markHeuristicLine(index, "title", line);
      }
    });
  }

  lines.forEach((line, index) => {
    if (consumedLines.has(index)) {
      return;
    }

    if (looksLikeJobTitleLine(line)) {
      markHeuristicLine(index, "title", line);
      return;
    }

    if (!fields.company && line.length <= 100) {
      markHeuristicLine(index, "company", line);
    }
  });

  lines.forEach((line, index) => {
    if (consumedLines.has(index)) {
      return;
    }

    if (!fields.title) {
      markHeuristicLine(index, "title", line);
      return;
    }

    if (!fields.company) {
      markHeuristicLine(index, "company", line);
    }
  });

  return fields;
};

export const parseEducationBlockLines = (lines = [], profileHint = null) => {
  const cleanLines = lines
    .map((line) => stripMarkdownInline(line).trim())
    .filter(Boolean);

  const fields = {
    school: "",
    degree: "",
    timeline: "",
  };
  const consumedLines = new Set();

  const assignField = (key, value) => {
    if (!value || fields[key]) {
      return;
    }

    fields[key] = value;
  };

  const consumeStructuredLine = (index, values = {}) => {
    Object.entries(values).forEach(([key, value]) => {
      assignField(key, value);
    });
    consumedLines.add(index);
  };

  const markHeuristicLine = (index, key, value) => {
    if (!value || consumedLines.has(index)) {
      return;
    }

    assignField(key, value);
    consumedLines.add(index);
  };

  cleanLines.forEach((line, index) => {
    const schoolDegreeTimeline = parseSchoolDegreeTimelineLine(line);

    if (schoolDegreeTimeline) {
      consumeStructuredLine(index, schoolDegreeTimeline);
      return;
    }

    const schoolDegree = parseSchoolDegreeLine(line);

    if (schoolDegree) {
      consumeStructuredLine(index, schoolDegree);
      return;
    }

    const degreeTimeline = parseDegreeTimelineLine(line);

    if (degreeTimeline) {
      consumeStructuredLine(index, degreeTimeline);
      return;
    }

    if (isStandaloneEducationTimelineLine(line)) {
      markHeuristicLine(index, "timeline", line);
    }
  });

  if (profileHint) {
    cleanLines.forEach((line, index) => {
      if (consumedLines.has(index)) {
        return;
      }

      if (profileHint.school && compareTextsExactly(line, profileHint.school)) {
        markHeuristicLine(index, "school", line);
        return;
      }

      if (profileHint.degree && compareDegreesExactly(line, profileHint.degree)) {
        markHeuristicLine(index, "degree", line);
      }
    });
  }

  cleanLines.forEach((line, index) => {
    if (consumedLines.has(index)) {
      return;
    }

    if (DEGREE_HINT.test(line)) {
      markHeuristicLine(index, "degree", line);
    }
  });

  cleanLines.forEach((line, index) => {
    if (consumedLines.has(index)) {
      return;
    }

    if (SCHOOL_HINT.test(line)) {
      markHeuristicLine(index, "school", line);
    }
  });

  const remaining = cleanLines.filter((_, index) => !consumedLines.has(index));

  remaining.forEach((line) => {
    if (!fields.degree && DEGREE_HINT.test(line)) {
      fields.degree = line;
      return;
    }

    if (!fields.school && SCHOOL_HINT.test(line)) {
      fields.school = line;
      return;
    }

    if (!fields.school) {
      fields.school = line;
      return;
    }

    if (!fields.degree) {
      fields.degree = line;
    }
  });

  return fields;
};

const findEducationBlockMarkers = (lines = []) => {
  const markers = [];

  lines.forEach((line, lineIndex) => {
    const trimmed = stripMarkdownInline(line).trim();

    if (!trimmed || looksLikeJobTitleLine(trimmed)) {
      return;
    }

    const schoolDegreeTimeline = parseSchoolDegreeTimelineLine(trimmed);

    if (schoolDegreeTimeline) {
      markers.push({
        lineIndex,
        anchor: "complete",
        ...schoolDegreeTimeline,
      });
      return;
    }

    const degreeTimeline = parseDegreeTimelineLine(trimmed);

    if (degreeTimeline) {
      markers.push({
        lineIndex,
        anchor: "degreeTimeline",
        school: "",
        ...degreeTimeline,
      });
      return;
    }

    if (isStandaloneEducationTimelineLine(trimmed)) {
      markers.push({
        lineIndex,
        anchor: "timeline",
        school: "",
        degree: "",
        timeline: trimmed,
      });
    }
  });

  return markers;
};

const collectEducationHeaderLinesAroundMarker = (lines = [], markerLineIndex = 0) => {
  const headerLines = [];
  const start = Math.max(0, markerLineIndex - 4);

  for (let lineIndex = start; lineIndex <= markerLineIndex; lineIndex += 1) {
    const trimmed = stripMarkdownInline(lines[lineIndex] || "").trim();

    if (!trimmed || isExperienceBodyLine(trimmed)) {
      continue;
    }

    headerLines.push(trimmed);
  }

  for (
    let lineIndex = markerLineIndex + 1;
    lineIndex < Math.min(lines.length, markerLineIndex + 4);
    lineIndex += 1
  ) {
    const trimmed = stripMarkdownInline(lines[lineIndex] || "").trim();

    if (!trimmed) {
      continue;
    }

    if (isExperienceBodyLine(trimmed)) {
      break;
    }

    if (isEducationHeaderLine(trimmed)) {
      headerLines.push(trimmed);
      continue;
    }

    break;
  }

  return [...new Set(headerLines)];
};

const getEducationMarkerStartLine = (lines = [], markerLineIndex = 0) => {
  let startLine = markerLineIndex;

  for (
    let lineIndex = markerLineIndex - 1;
    lineIndex >= Math.max(0, markerLineIndex - 4);
    lineIndex -= 1
  ) {
    const trimmed = stripMarkdownInline(lines[lineIndex] || "").trim();

    if (!trimmed || isExperienceBodyLine(trimmed)) {
      break;
    }

    if (
      parseDegreeTimelineLine(trimmed) ||
      parseSchoolDegreeTimelineLine(trimmed) ||
      isStandaloneEducationTimelineLine(trimmed)
    ) {
      break;
    }

    if (isEducationHeaderLine(trimmed)) {
      startLine = lineIndex;
      continue;
    }

    break;
  }

  return startLine;
};

const findSchoolOnlyStartIndexes = (lines = []) => {
  const indexes = [];

  lines.forEach((line, lineIndex) => {
    const trimmed = stripMarkdownInline(line).trim();

    if (!trimmed) {
      return;
    }

    if (
      SCHOOL_HINT.test(trimmed) &&
      !parseSchoolDegreeLine(trimmed) &&
      !parseSchoolDegreeTimelineLine(trimmed) &&
      !parseDegreeTimelineLine(trimmed) &&
      !isStandaloneEducationTimelineLine(trimmed) &&
      !looksLikeJobTitleLine(trimmed)
    ) {
      indexes.push(lineIndex);
    }
  });

  return indexes;
};

const parseEducationBlocksFromIndexes = (
  lines = [],
  startIndexes = [],
  profileEducation = []
) => {
  return startIndexes
    .map((startLine, index) => {
      const endLine = startIndexes[index + 1] ?? lines.length;
      const blockLines = lines
        .slice(startLine, endLine)
        .map((line) => stripMarkdownInline(line).trim())
        .filter(Boolean);

      return parseEducationBlockLines(
        blockLines,
        profileEducation[index] || null
      );
    })
    .filter((entry) => entry && (entry.school || entry.degree || entry.timeline));
};

export const parseEducationEntries = (
  educationText = "",
  profileEducation = []
) => {
  const text = stripMarkdownInline(educationText).trim();

  if (!text) {
    return [];
  }

  const lines = text.split("\n");
  const markers = findEducationBlockMarkers(lines);

  if (markers.length > 0) {
    const uniqueMarkers = [];
    const seenStartLines = new Set();

    markers.forEach((marker) => {
      const startLine = getEducationMarkerStartLine(lines, marker.lineIndex);

      if (seenStartLines.has(startLine)) {
        return;
      }

      seenStartLines.add(startLine);
      uniqueMarkers.push({
        ...marker,
        startLine,
      });
    });

    return uniqueMarkers
      .map((marker, index) => {
        const headerLines = collectEducationHeaderLinesAroundMarker(
          lines,
          marker.lineIndex
        );

        return parseEducationBlockLines(
          headerLines,
          profileEducation[index] || null
        );
      })
      .filter((entry) => entry && (entry.school || entry.degree || entry.timeline));
  }

  const schoolStarts = findSchoolOnlyStartIndexes(lines);

  if (schoolStarts.length > 1) {
    return parseEducationBlocksFromIndexes(lines, schoolStarts, profileEducation);
  }

  const blankLineBlocks = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blankLineBlocks.length > 1) {
    return blankLineBlocks
      .map((block, index) => {
        const blockLines = block
          .split("\n")
          .map((line) => stripMarkdownInline(line).trim())
          .filter(Boolean);

        return parseEducationBlockLines(
          blockLines,
          profileEducation[index] || null
        );
      })
      .filter((entry) => entry && (entry.school || entry.degree || entry.timeline));
  }

  const blockLines = lines
    .map((line) => stripMarkdownInline(line).trim())
    .filter(Boolean);

  const singleEntry = parseEducationBlockLines(
    blockLines,
    profileEducation[0] || null
  );

  if (singleEntry.school || singleEntry.degree || singleEntry.timeline) {
    return [singleEntry];
  }

  return [];
};

const findExperienceBlockMarkers = (lines = []) => {
  const markers = [];

  lines.forEach((line, lineIndex) => {
    const trimmed = stripMarkdownInline(line).trim();

    if (!trimmed || looksLikeExperienceDetailLine(trimmed)) {
      return;
    }

    const companyTimeline = parseCompanyTimelineLine(trimmed);

    if (companyTimeline) {
      markers.push({
        lineIndex,
        company: companyTimeline.company,
        timeline: companyTimeline.timeline || "",
        title: companyTimeline.title || "",
      });
      return;
    }

    if (trimmed.includes("|")) {
      const companyTitle = parseCompanyTitleLine(trimmed);

      if (companyTitle) {
        markers.push({
          lineIndex,
          company: companyTitle.company,
          title: companyTitle.title,
          timeline: "",
        });
        return;
      }

      const titleTimeline = parseTitleTimelineLine(trimmed);

      if (titleTimeline && looksLikeJobTitleLine(titleTimeline.title)) {
        markers.push({
          lineIndex,
          company: "",
          timeline: titleTimeline.timeline,
          title: titleTimeline.title,
        });
        return;
      }
    }

    if (
      isTimelineText(trimmed) &&
      !looksLikeJobTitleLine(trimmed) &&
      trimmed.length <= 60
    ) {
      markers.push({
        lineIndex,
        company: "",
        timeline: trimmed,
        title: "",
      });
    }
  });

  return markers;
};

const collectHeaderLinesAroundMarker = (lines = [], markerLineIndex = 0) => {
  const headerLines = [];
  const start = Math.max(0, markerLineIndex - 3);

  for (let index = start; index <= markerLineIndex; index += 1) {
    const trimmed = lines[index]?.trim();

    if (!trimmed || isExperienceBodyLine(trimmed)) {
      continue;
    }

    headerLines.push(stripMarkdownInline(trimmed));
  }

  for (
    let index = markerLineIndex + 1;
    index < Math.min(lines.length, markerLineIndex + 3);
    index += 1
  ) {
    const trimmed = lines[index]?.trim();

    if (!trimmed || isExperienceBodyLine(trimmed)) {
      break;
    }

    if (isExperienceHeaderLine(trimmed)) {
      headerLines.push(stripMarkdownInline(trimmed));
      continue;
    }

    break;
  }

  return [...new Set(headerLines)];
};

const getMarkerStartLine = (lines = [], markerLineIndex = 0) => {
  let startLine = markerLineIndex;

  for (let index = markerLineIndex - 1; index >= Math.max(0, markerLineIndex - 3); index -= 1) {
    const trimmed = lines[index]?.trim();

    if (!trimmed || isExperienceBodyLine(trimmed)) {
      break;
    }

    startLine = index;
  }

  return startLine;
};

export const splitExperienceIntoJobBlocks = (
  experienceText = "",
  profileCompanies = []
) => {
  const lines = String(experienceText || "").split("\n");
  const markers = findExperienceBlockMarkers(lines);

  const uniqueMarkers = [];
  const seenStartLines = new Set();

  markers.forEach((marker) => {
    const startLine = getMarkerStartLine(lines, marker.lineIndex);

    if (seenStartLines.has(startLine)) {
      return;
    }

    seenStartLines.add(startLine);
    uniqueMarkers.push({
      ...marker,
      startLine,
      headerEndLine: marker.lineIndex + 1,
    });
  });

  if (uniqueMarkers.length === 0) {
    const { headerLines, bodyLines } = splitExperienceHeaderAndBody(
      lines.map((line) => line.trim()).filter(Boolean)
    );

    if (headerLines.length === 0) {
      return [];
    }

    const headerFields = parseExperienceHeaderLines(
      headerLines,
      profileCompanies[0] || null
    );

    return [
      {
        ...headerFields,
        body: normalizeExperienceBodyToLines(bodyLines.join("\n")),
      },
    ];
  }

  return uniqueMarkers.map((marker, index) => {
    const nextMarker = uniqueMarkers[index + 1];
    const bodyEndLine = nextMarker ? nextMarker.startLine : lines.length;
    const headerLines = collectHeaderLinesAroundMarker(lines, marker.lineIndex);

    for (
      let lineIndex = marker.lineIndex + 1;
      lineIndex < bodyEndLine;
      lineIndex += 1
    ) {
      const trimmed = lines[lineIndex]?.trim();

      if (!trimmed) {
        continue;
      }

      if (isExperienceBodyLine(trimmed)) {
        break;
      }

      if (isExperienceHeaderLine(trimmed)) {
        headerLines.push(stripMarkdownInline(trimmed));
        continue;
      }

      break;
    }

    const mergedHeaderLines = [...new Set(headerLines)];
    const headerFields = parseExperienceHeaderLines(
      mergedHeaderLines,
      profileCompanies[index] || null
    );

    let bodyStartLine = marker.lineIndex + 1;

    while (bodyStartLine < bodyEndLine) {
      const trimmed = lines[bodyStartLine]?.trim();

      if (!trimmed) {
        bodyStartLine += 1;
        continue;
      }

      if (isExperienceBodyLine(trimmed)) {
        break;
      }

      if (mergedHeaderLines.includes(stripMarkdownInline(trimmed))) {
        bodyStartLine += 1;
        continue;
      }

      if (isExperienceHeaderLine(trimmed)) {
        bodyStartLine += 1;
        continue;
      }

      break;
    }

    const body = lines.slice(bodyStartLine, bodyEndLine).join("\n").trim();

    return {
      company: headerFields.company || marker.company,
      title: headerFields.title || marker.title,
      timeline: headerFields.timeline || marker.timeline,
      body: normalizeExperienceBodyToLines(body),
    };
  });
};

export const isCompanyHeaderLine = (line = "", companyName = "") => {
  const trimmed = String(line).trim();
  const cleanCompany = String(companyName || "").trim();

  if (!trimmed || !cleanCompany) {
    return false;
  }

  if (parseCompanyTimelineLine(trimmed)) {
    const parsed = parseCompanyTimelineLine(trimmed);
    const companyRegex = new RegExp(`\\b${escapeRegExp(cleanCompany)}\\b`, "i");

    return companyRegex.test(parsed.company);
  }

  const companyTitle = parseCompanyTitleLine(trimmed);

  if (companyTitle) {
    const companyRegex = new RegExp(`\\b${escapeRegExp(cleanCompany)}\\b`, "i");
    return companyRegex.test(companyTitle.company);
  }

  if (isBulletLine(trimmed) || trimmed.length > 200) {
    return false;
  }

  const companyRegex = new RegExp(`\\b${escapeRegExp(cleanCompany)}\\b`, "i");

  if (!companyRegex.test(trimmed)) {
    return false;
  }

  const companyPos = trimmed.toLowerCase().indexOf(cleanCompany.toLowerCase());

  return companyPos >= 0 && companyPos <= 80;
};

const stripCompanyHeaderFromChunk = (chunk = "", companyName = "") => {
  const lines = String(chunk).split("\n");

  if (lines.length === 0) {
    return normalizeExperienceBodyToLines(chunk);
  }

  let startIndex = 0;

  if (isCompanyHeaderLine(lines[0], companyName)) {
    startIndex = 1;
  }

  if (lines[startIndex] && parseCompanyTitleLine(lines[startIndex])) {
    startIndex += 1;
  }

  if (lines[startIndex] && looksLikeJobTitleLine(lines[startIndex])) {
    startIndex += 1;
  }

  if (lines[startIndex] && parseCompanyTimelineLine(lines[startIndex])) {
    startIndex += 1;
  }

  return normalizeExperienceBodyToLines(lines.slice(startIndex).join("\n"));
};

const getProfileCompanyName = (company) => {
  if (typeof company === "string") {
    return company.trim();
  }

  return String(company?.companyName || "").trim();
};

export const fuzzyCompanyMatch = (left = "", right = "") => {
  const a = String(left).trim().toLowerCase();
  const b = String(right).trim().toLowerCase();

  if (!a || !b) {
    return false;
  }

  if (a === b || a.includes(b) || b.includes(a)) {
    return true;
  }

  const aWord = a.split(/\s+/)[0];
  const bWord = b.split(/\s+/)[0];

  return aWord.length > 2 && aWord === bWord;
};

const alignJobBlocksToProfile = (jobBlocks = [], profileExperience = []) => {
  if (!profileExperience.length || jobBlocks.length <= profileExperience.length) {
    return jobBlocks;
  }

  const matched = [];
  const usedBlockIndexes = new Set();

  profileExperience.forEach((profileEntry) => {
    const profileName = getProfileCompanyName(profileEntry);

    if (!profileName) {
      return;
    }

    const matchedIndex = jobBlocks.findIndex(
      (block, blockIndex) =>
        !usedBlockIndexes.has(blockIndex) &&
        fuzzyCompanyMatch(block.company, profileName)
    );

    if (matchedIndex === -1) {
      return;
    }

    usedBlockIndexes.add(matchedIndex);
    matched.push(jobBlocks[matchedIndex]);
  });

  if (matched.length === profileExperience.length) {
    return matched;
  }

  const strongBlocks = jobBlocks.filter((block) => block.company && block.timeline);

  if (strongBlocks.length === profileExperience.length) {
    return strongBlocks;
  }

  return jobBlocks;
};

const mapJobBlocksToProfileCompanies = (jobBlocks = [], profileCompanyNames = []) => {
  const result = {};
  const usedBlockIndexes = new Set();

  profileCompanyNames.forEach((profileName, profileIndex) => {
    let matchedIndex = jobBlocks.findIndex(
      (block, blockIndex) =>
        !usedBlockIndexes.has(blockIndex) &&
        fuzzyCompanyMatch(block.company, profileName)
    );

    if (matchedIndex === -1 && profileIndex < jobBlocks.length) {
      matchedIndex = profileIndex;
    }

    if (matchedIndex === -1 || usedBlockIndexes.has(matchedIndex)) {
      return;
    }

    usedBlockIndexes.add(matchedIndex);
    result[profileName] = jobBlocks[matchedIndex].body;
  });

  return result;
};

export const splitExperienceByCompanies = (experienceText = "", companies = []) => {
  const companyNames = companies.map(getProfileCompanyName).filter(Boolean);
  const text = String(experienceText || "").trim();

  if (!text || companyNames.length === 0) {
    return {};
  }

  const jobBlocks = splitExperienceIntoJobBlocks(text, companyNames);

  if (jobBlocks.length > 0) {
    const mapped = mapJobBlocksToProfileCompanies(jobBlocks, companyNames);

    if (Object.keys(mapped).length > 0) {
      return mapped;
    }
  }

  if (companyNames.length === 1) {
    return {
      [companyNames[0]]: stripCompanyHeaderFromChunk(text, companyNames[0]),
    };
  }

  const lines = text.split("\n");
  const markers = [];

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return;
    }

    companyNames.forEach((companyName, companyIndex) => {
      if (isCompanyHeaderLine(trimmed, companyName)) {
        markers.push({ lineIndex, companyName, companyIndex });
      }
    });
  });

  markers.sort((left, right) => {
    if (left.lineIndex !== right.lineIndex) {
      return left.lineIndex - right.lineIndex;
    }

    return left.companyIndex - right.companyIndex;
  });

  const uniqueMarkers = [];
  const seenCompanyIndexes = new Set();

  markers.forEach((marker) => {
    if (seenCompanyIndexes.has(marker.companyIndex)) {
      return;
    }

    seenCompanyIndexes.add(marker.companyIndex);
    uniqueMarkers.push(marker);
  });

  if (uniqueMarkers.length === 0) {
    if (jobBlocks.length > 0) {
      return mapJobBlocksToProfileCompanies(jobBlocks, companyNames);
    }

    return {
      [companyNames[0]]: normalizeExperienceBodyToLines(text),
    };
  }

  const result = {};

  uniqueMarkers.forEach((marker, index) => {
    const nextMarker = uniqueMarkers[index + 1];
    const endLine = nextMarker ? nextMarker.lineIndex : lines.length;
    const chunk = lines.slice(marker.lineIndex, endLine).join("\n");

    result[marker.companyName] = stripCompanyHeaderFromChunk(
      chunk,
      marker.companyName
    );
  });

  return result;
};

export const matchCompanyDetails = (experienceByCompany = {}, profileCompanyName = "") => {
  const cleanName = String(profileCompanyName || "").trim();

  if (!cleanName) {
    return "";
  }

  if (experienceByCompany[cleanName]) {
    return experienceByCompany[cleanName];
  }

  const lowerName = cleanName.toLowerCase();

  for (const [companyName, details] of Object.entries(experienceByCompany)) {
    const lowerKey = companyName.toLowerCase();

    if (lowerKey.includes(lowerName) || lowerName.includes(lowerKey)) {
      return details;
    }
  }

  return "";
};

export const parseResumeSections = (
  rawText = "",
  profileCompanies = [],
  profileEducation = []
) => {
  const text = String(rawText || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  const warnings = [];
  const foundSections = [];

  if (!text) {
    return {
      summary: "",
      skills: "",
      experience: "",
      certifications: "",
      experienceByCompany: {},
      foundSections,
      warnings: ["Paste your full resume content with section headings."],
      isParsed: false,
    };
  }

  const lines = text.split("\n");
  const sections = [];
  let currentType = null;
  let currentContent = [];
  let capturedEducation = "";

  const pushCurrentSection = () => {
    const content = currentContent.join("\n").trim();

    if (!currentType || !content) {
      return;
    }

    if (currentType === "education") {
      capturedEducation = content;

      if (content.trim()) {
        foundSections.push("education");
      }

      return;
    }

    if (currentType === "ignore") {
      return;
    }

    sections.push({
      type: currentType,
      content,
    });
    foundSections.push(currentType);
  };

  lines.forEach((line) => {
    if (isDividerLine(line)) {
      return;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      if (currentType) {
        currentContent.push("");
      }
      return;
    }

    const sectionType = detectSectionType(trimmed);
    const inlineSection = sectionType ? null : parseInlineSectionHeader(trimmed);

    if (sectionType || inlineSection) {
      if (sectionType && sectionType === currentType) {
        return;
      }

      pushCurrentSection();

      if (inlineSection) {
        currentType = inlineSection.type;
        currentContent = inlineSection.remainder ? [inlineSection.remainder] : [];
        return;
      }

      if (sectionType === "ignore" && isEducationHeader(trimmed)) {
        currentType = "education";
        currentContent = [];
        return;
      }

      currentType = sectionType;

      if (sectionType === "ignore") {
        currentContent = [];
        return;
      }

      currentContent = [];
      return;
    }

    if (currentType && currentType !== "ignore") {
      currentContent.push(line);
    }
  });

  pushCurrentSection();

  const result = {
    summary: "",
    skills: "",
    experience: "",
    certifications: "",
    education: "",
    educationEntries: [],
    experienceByCompany: {},
    foundSections: [],
    warnings,
    isParsed: false,
  };

  sections.forEach((section) => {
    if (!result[section.type]) {
      result[section.type] = section.content;
      result.foundSections.push(section.type);
      return;
    }

    result[section.type] = `${result[section.type]}\n\n${section.content}`;

    if (!result.foundSections.includes(section.type)) {
      result.foundSections.push(section.type);
    }
  });

  result.summary = stripMarkdownInline(result.summary);
  result.skills = normalizeSkillsContent(result.skills);
  result.certifications = normalizeCertificationsContent(result.certifications);
  result.experience = stripMarkdownInline(result.experience);
  result.education = capturedEducation;
  result.educationEntries = parseEducationEntries(
    capturedEducation,
    profileEducation
  );

  const requiredSections = ["summary", "skills", "experience"];

  requiredSections.forEach((sectionName) => {
    if (!result.foundSections.includes(sectionName)) {
      warnings.push(
        `Could not find a ${sectionName} section. Add a heading like "${sectionName}".`
      );
    }
  });

  if (
    result.foundSections.includes("certifications") &&
    !String(result.certifications || "").trim()
  ) {
    warnings.push("Certifications section was found but has no content.");
  }

  if (result.experience) {
    result.experienceByCompany = splitExperienceByCompanies(
      result.experience,
      profileCompanies
    );
  }

  result.isParsed = result.foundSections.length > 0;
  result.warnings = [...new Set(warnings)];

  return result;
};

export const applyParsedResumeToForm = ({
  parsed,
  profileCompanies = [],
  currentExperienceInputs = [],
}) => {
  const experienceByCompany = parsed.experienceByCompany || {};
  const companyList =
    profileCompanies.length > 0
      ? profileCompanies
      : currentExperienceInputs.map((item) => ({
          companyName: item.companyName,
        }));

  const nextExperienceInputs = currentExperienceInputs.map((item) => ({
    ...item,
    details: matchCompanyDetails(experienceByCompany, item.companyName),
  }));

  if (
    companyList.length === 1 &&
    parsed.experience &&
    !nextExperienceInputs[0]?.details
  ) {
    const onlyCompanyName = getProfileCompanyName(companyList[0]);
    const jobBlocks = splitExperienceIntoJobBlocks(parsed.experience);

    nextExperienceInputs[0] = {
      ...nextExperienceInputs[0],
      details:
        experienceByCompany[onlyCompanyName] ||
        (jobBlocks[0]?.body
          ? jobBlocks[0].body
          : normalizeExperienceBodyToLines(parsed.experience)),
    };
  }

  return {
    summary: parsed.summary || "",
    skills: parsed.skills || "",
    certification: parsed.certifications || "",
    experienceInputs: nextExperienceInputs,
    parseMeta: {
      foundSections: parsed.foundSections || [],
      warnings: parsed.warnings || [],
      isParsed: parsed.isParsed,
    },
  };
};

const getProfileExperienceEntries = (profile = {}) => {
  if (!profile) {
    return [];
  }

  if (Array.isArray(profile.experience)) {
    return profile.experience;
  }

  try {
    const parsed = JSON.parse(profile.experience || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getProfileEducationEntries = (profile = {}) => {
  if (!profile) {
    return [];
  }

  if (Array.isArray(profile.education)) {
    return profile.education;
  }

  try {
    const parsed = JSON.parse(profile.education || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const addMismatch = (mismatches, message) => {
  if (!mismatches.includes(message)) {
    mismatches.push(message);
  }
};

export const hasPastedEducationSection = (parsed = {}) =>
  Boolean(String(parsed?.education || "").trim());

export const hasPastedCertificationsSection = (parsed = {}) =>
  (parsed?.foundSections || []).includes("certifications") ||
  Boolean(String(parsed?.certifications || "").trim());

export const profileTemplateHasCertifications = (profile = null) => {
  if (!profile) {
    return true;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      profile,
      "resume_template_has_certifications"
    )
  ) {
    return Boolean(profile.resume_template_has_certifications);
  }

  return true;
};

export const validateParsedResumeAgainstProfile = ({
  parsed = null,
  profile = null,
  profileExperience = [],
  profileEducation = [],
  templateHasCertifications = profileTemplateHasCertifications(profile),
} = {}) => {
  const mismatches = [];
  const pastedJobBlocks = alignJobBlocksToProfile(
    splitExperienceIntoJobBlocks(parsed?.experience || "", profileExperience),
    profileExperience
  );

  if (profileExperience.length === 0) {
    addMismatch(
      mismatches,
      "Selected profile has no experience entries to verify against."
    );
  }

  if (profileExperience.length !== pastedJobBlocks.length) {
    addMismatch(
      mismatches,
      `Experience count must match profile exactly (${profileExperience.length} in profile, ${pastedJobBlocks.length} in pasted resume).`
    );
  }

  const experienceCount = Math.max(
    profileExperience.length,
    pastedJobBlocks.length
  );

  for (let index = 0; index < experienceCount; index += 1) {
    const profileEntry = profileExperience[index];
    const pastedEntry = pastedJobBlocks[index];
    const label = `Experience ${index + 1}`;

    if (!profileEntry && pastedEntry) {
      addMismatch(
        mismatches,
        `${label}: pasted resume has an extra role titled "${pastedEntry.title || "Unknown"}".`
      );
      continue;
    }

    if (profileEntry && !pastedEntry) {
      addMismatch(
        mismatches,
        `${label}: missing pasted role for profile title "${profileEntry.title}".`
      );
      continue;
    }

    if (!profileEntry || !pastedEntry) {
      continue;
    }

    if (!compareTextsExactly(profileEntry.title, pastedEntry.title)) {
      addMismatch(
        mismatches,
        `${label} title must match profile exactly ("${profileEntry.title}" vs "${pastedEntry.title}").`
      );
    }
  }

  if (templateHasCertifications) {
    if (!hasPastedCertificationsSection(parsed)) {
      addMismatch(
        mismatches,
        "Certifications section is required because the selected resume template includes Certifications."
      );
    } else if (!String(parsed?.certifications || "").trim()) {
      addMismatch(
        mismatches,
        "Certifications section was found but has no content."
      );
    }
  }

  return {
    isValid: mismatches.length === 0,
    mismatches,
    pastedJobBlocks,
    pastedEducation: parsed?.educationEntries || [],
    templateHasCertifications: Boolean(templateHasCertifications),
  };
};

export const validatePastedResumeAgainstProfile = ({
  rawText = "",
  profile = null,
  templateHasCertifications = profileTemplateHasCertifications(profile),
} = {}) => {
  if (!profile) {
    return {
      isValid: false,
      mismatches: ["Select a job-bid profile before saving the resume."],
    };
  }

  if (!String(rawText || "").trim()) {
    return {
      isValid: false,
      mismatches: ["Paste the full resume content before saving."],
    };
  }

  const profileExperience = getProfileExperienceEntries(profile);
  const profileEducation = getProfileEducationEntries(profile);
  const parsed = parseResumeSections(
    rawText,
    profileExperience,
    profileEducation
  );

  return validateParsedResumeAgainstProfile({
    parsed,
    profile,
    profileExperience,
    profileEducation,
    templateHasCertifications,
  });
};

export const parseAndValidateResumePaste = ({
  rawText = "",
  profile = null,
  templateHasCertifications = profileTemplateHasCertifications(profile),
} = {}) => {
  if (!profile) {
    return {
      summary: "",
      skills: "",
      certification: "",
      experienceInputs: [],
      parseMeta: {
        foundSections: [],
        warnings: [],
        isParsed: false,
      },
      profileMatch: {
        isValid: false,
        mismatches: ["Select a job-bid profile before saving the resume."],
      },
    };
  }

  const profileExperience = getProfileExperienceEntries(profile);
  const profileEducation = getProfileEducationEntries(profile);
  const parsed = parseResumeSections(
    rawText,
    profileExperience,
    profileEducation
  );
  const baseExperienceInputs = profileExperience.map((item, index) => ({
    id: index,
    companyName: item.companyName || "",
    title: item.title || "",
    timeline: item.timeline || "",
    location: item.location || profile.location || "",
    details: "",
  }));
  const applied = applyParsedResumeToForm({
    parsed,
    profileCompanies: profileExperience,
    currentExperienceInputs: baseExperienceInputs,
  });
  const profileMatch = String(rawText || "").trim()
    ? validateParsedResumeAgainstProfile({
        parsed,
        profile,
        profileExperience,
        profileEducation,
        templateHasCertifications,
      })
    : {
        isValid: false,
        mismatches: [],
      };

  return {
    ...applied,
    profileMatch,
  };
};
