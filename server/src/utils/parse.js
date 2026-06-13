const parseJsonField = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  try {
    return JSON.parse(value);
  } catch (error) {
    return [];
  }
};

module.exports = { parseJsonField };
