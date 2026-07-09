import {
  APPLICATION_ACTION_TYPES,
  createApplicationActionEntry,
  prependApplicationAction,
} from "./applicationActionHistory";

describe("applicationActionHistory", () => {
  test("creates action entries with company and role", () => {
    const entry = createApplicationActionEntry({
      type: APPLICATION_ACTION_TYPES.PROMPT_COPIED,
      companyName: "Meta",
      roleName: "AI Engineer",
    });

    expect(entry.type).toBe("prompt_copied");
    expect(entry.companyName).toBe("Meta");
    expect(entry.roleName).toBe("AI Engineer");
    expect(entry.id).toBeTruthy();
    expect(entry.at).toBeTruthy();
  });

  test("prepends newest actions and keeps recent history", () => {
    const first = createApplicationActionEntry({
      type: APPLICATION_ACTION_TYPES.PROMPT_COPIED,
      companyName: "Meta",
      roleName: "AI Engineer",
    });
    const second = createApplicationActionEntry({
      type: APPLICATION_ACTION_TYPES.RESUME_SAVED,
      companyName: "FICO",
      roleName: "Senior Engineer",
      detail: "6.8/1. FICO - Senior Engineer/Neel_Patel.pdf",
    });

    const history = prependApplicationAction([first], second, 8);

    expect(history).toHaveLength(2);
    expect(history[0].companyName).toBe("FICO");
    expect(history[1].companyName).toBe("Meta");
  });
});
