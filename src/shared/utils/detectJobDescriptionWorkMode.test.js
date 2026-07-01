import {
  WORK_LOCATION_TYPES,
  buildNonRemoteConfirmMessage,
  detectJobDescriptionWorkMode,
  shouldConfirmNonRemoteCopy,
} from "./detectJobDescriptionWorkMode";

describe("detectJobDescriptionWorkMode", () => {
  test("detects remote roles", () => {
    expect(detectJobDescriptionWorkMode("This is a fully remote position.").type).toBe(
      WORK_LOCATION_TYPES.REMOTE
    );
    expect(detectJobDescriptionWorkMode("Work from home anywhere in the US.").type).toBe(
      WORK_LOCATION_TYPES.REMOTE
    );
  });

  test("detects hybrid roles", () => {
    expect(detectJobDescriptionWorkMode("Hybrid role, 3 days in-office.").type).toBe(
      WORK_LOCATION_TYPES.HYBRID
    );
    expect(
      detectJobDescriptionWorkMode("Remote and on-site collaboration required.").type
    ).toBe(WORK_LOCATION_TYPES.HYBRID);
  });

  test("detects on-site roles", () => {
    expect(detectJobDescriptionWorkMode("This is an on-site role in San Francisco.").type).toBe(
      WORK_LOCATION_TYPES.ONSITE
    );
    expect(detectJobDescriptionWorkMode("Must work in-office 5 days a week.").type).toBe(
      WORK_LOCATION_TYPES.ONSITE
    );
  });

  test("marks empty or missing location as unmentioned", () => {
    expect(detectJobDescriptionWorkMode("").type).toBe(WORK_LOCATION_TYPES.UNMENTIONED);
    expect(
      detectJobDescriptionWorkMode("We are looking for a senior engineer with Python skills.").type
    ).toBe(WORK_LOCATION_TYPES.UNMENTIONED);
  });

  test("builds confirm message for non-remote roles", () => {
    const workMode = detectJobDescriptionWorkMode("Hybrid role in NYC.");

    expect(shouldConfirmNonRemoteCopy(workMode)).toBe(true);
    expect(buildNonRemoteConfirmMessage(workMode)).toBe(
      "This is not Remote role. This is Hybrid role. Still wanna continue?"
    );
  });

  test("does not require confirm for remote roles", () => {
    const workMode = detectJobDescriptionWorkMode("100% remote across the US.");

    expect(shouldConfirmNonRemoteCopy(workMode)).toBe(false);
  });
});
