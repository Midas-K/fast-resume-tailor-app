export const EST_TIME_ZONE = "America/New_York";

const getZonedParts = (date, timeZone = EST_TIME_ZONE) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = {};

  for (const part of formatter.formatToParts(date)) {
    if (part.type === "literal") {
      continue;
    }

    parts[part.type] = Number(part.value);
  }

  if (parts.hour === 24) {
    parts.hour = 0;
  }

  return parts;
};

export const zonedTimeToUtc = (
  { year, month, day, hour = 0, minute = 0, second = 0 },
  timeZone = EST_TIME_ZONE
) => {
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const formatted = getZonedParts(new Date(guess), timeZone);
    const formattedAsUtc = Date.UTC(
      formatted.year,
      formatted.month - 1,
      formatted.day,
      formatted.hour,
      formatted.minute,
      formatted.second
    );
    const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    const diff = desiredAsUtc - formattedAsUtc;

    if (diff === 0) {
      break;
    }

    guess += diff;
  }

  return new Date(guess);
};

const addCalendarDays = (year, month, day, days) => {
  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
};

export const getEstDateParts = (date = new Date()) => {
  const { year, month, day } = getZonedParts(date, EST_TIME_ZONE);

  return { year, month, day };
};

export const getEstDayBounds = (date = new Date()) => {
  const { year, month, day } = getEstDateParts(date);
  const nextDay = addCalendarDays(year, month, day, 1);
  const dayStart = zonedTimeToUtc({ year, month, day, hour: 0, minute: 0, second: 0 });
  const dayEnd = zonedTimeToUtc({
    year: nextDay.year,
    month: nextDay.month,
    day: nextDay.day,
    hour: 0,
    minute: 0,
    second: 0,
  });

  return {
    dayStart: dayStart.toISOString(),
    dayEnd: dayEnd.toISOString(),
    year,
    month,
    day,
  };
};

export const formatEstFolderDate = (date = new Date()) => {
  const { month, day } = getEstDateParts(date);

  return `${month}.${day}`;
};

export const formatEstDateLabel = (date = new Date()) => {
  const { month, day, year } = getEstDateParts(date);
  const monthLabel = String(month).padStart(2, "0");
  const dayLabel = String(day).padStart(2, "0");
  const yearLabel = String(year).slice(-2);

  return `${monthLabel}/${dayLabel}/${yearLabel}`;
};
