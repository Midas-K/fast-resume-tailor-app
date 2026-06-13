export const formatDateOnly = (value) => {
  if (!value) return "Unknown Date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Unknown Date";

  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
};

export const formatDateTime = (value) => {
  if (!value) return "Unknown Time";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Unknown Time";

  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

export const parseJsonField = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

export const getIsoDateFromFormattedDate = (formattedDate) => {
  if (!formattedDate) return "";

  const parsed = new Date(formattedDate);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
};

export const getMonthFromDate = (dateValue) => {
  if (!dateValue) return "";
  return String(dateValue).slice(0, 7);
};

export const getYearFromDate = (dateValue) => {
  if (!dateValue) return "";
  return String(dateValue).slice(0, 4);
};
