const getDateRange = ({ deleteType, date, month, year }) => {
  if (deleteType === "all") {
    return {
      start: null,
      end: null,
    };
  }

  if (deleteType === "day") {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("Valid date is required. Use YYYY-MM-DD.");
    }

    return {
      start: `${date}T00:00:00.000Z`,
      end: `${date}T23:59:59.999Z`,
    };
  }

  if (deleteType === "month") {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new Error("Valid month is required. Use YYYY-MM.");
    }

    const [yearValue, monthValue] = month.split("-").map(Number);
    const start = new Date(Date.UTC(yearValue, monthValue - 1, 1));
    const end = new Date(Date.UTC(yearValue, monthValue, 1));

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  if (deleteType === "year") {
    if (!year || !/^\d{4}$/.test(String(year))) {
      throw new Error("Valid year is required. Use YYYY.");
    }

    const yearValue = Number(year);

    return {
      start: new Date(Date.UTC(yearValue, 0, 1)).toISOString(),
      end: new Date(Date.UTC(yearValue + 1, 0, 1)).toISOString(),
    };
  }

  throw new Error("Invalid delete type. Use all, day, month, or year.");
};

module.exports = { getDateRange };
