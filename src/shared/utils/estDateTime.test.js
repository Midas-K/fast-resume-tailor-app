import {
  EST_TIME_ZONE,
  formatEstFolderDate,
  getEstDateParts,
  getEstDayBounds,
} from "./estDateTime";

describe("estDateTime", () => {
  test("uses America/New_York for folder dates", () => {
    expect(EST_TIME_ZONE).toBe("America/New_York");
  });

  test("formats folder date from EST calendar day", () => {
    const lateNightEst = new Date("2026-06-13T03:30:00.000Z");

    expect(getEstDateParts(lateNightEst)).toEqual({
      year: 2026,
      month: 6,
      day: 12,
    });
    expect(formatEstFolderDate(lateNightEst)).toBe("6.12");

    const afterMidnightEst = new Date("2026-06-13T04:30:00.000Z");

    expect(formatEstFolderDate(afterMidnightEst)).toBe("6.13");
  });

  test("builds EST midnight day bounds as UTC instants", () => {
    const reference = new Date("2026-06-13T15:00:00.000Z");
    const { dayStart, dayEnd } = getEstDayBounds(reference);

    expect(dayStart).toBe("2026-06-13T04:00:00.000Z");
    expect(dayEnd).toBe("2026-06-14T04:00:00.000Z");
  });

  test("keeps the same EST day bounds late at night in US timezones", () => {
    const lateNightEst = new Date("2026-06-13T03:30:00.000Z");
    const bounds = getEstDayBounds(lateNightEst);

    expect(bounds.dayStart).toBe("2026-06-12T04:00:00.000Z");
    expect(bounds.dayEnd).toBe("2026-06-13T04:00:00.000Z");
    expect(formatEstFolderDate(lateNightEst)).toBe("6.12");
  });
});
