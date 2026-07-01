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
    const hybridMode = detectJobDescriptionWorkMode("Hybrid role in NYC.");

    expect(shouldConfirmNonRemoteCopy(hybridMode)).toBe(true);
    expect(buildNonRemoteConfirmMessage(hybridMode)).toBe(
      "This is not a Remote role. This is a Hybrid role. Still wanna continue?"
    );

    const unmentionedMode = detectJobDescriptionWorkMode(
      "Senior Engineer on our Applied AI team with LLM and RAG experience."
    );

    expect(shouldConfirmNonRemoteCopy(unmentionedMode)).toBe(true);
    expect(buildNonRemoteConfirmMessage(unmentionedMode)).toBe(
      "This is not a Remote role. The JD does not mention Remote, On-site, or Hybrid. Still wanna continue?"
    );
  });

  test("does not require confirm for remote roles", () => {
    const workMode = detectJobDescriptionWorkMode("100% remote across the US.");

    expect(shouldConfirmNonRemoteCopy(workMode)).toBe(false);
  });

  test("treats fully remote roles as remote when interview mentions onsite visits", () => {
    const patchMyPcStyleJd = `
Software Engineer, AI
United StatesEngineering /Full-Time /Remote
Our fully remote crew of 150 GIF-loving humans supports over 10,000 customers.
Candidates for fully remote positions must reside in one of the following U.S. states.
What to Expect in the Interview Process
Most interviews are conducted virtually. In some cases we may invite candidates to participate in an in person conversation or onsite visit.
`;

    const workMode = detectJobDescriptionWorkMode(patchMyPcStyleJd);

    expect(workMode.type).toBe(WORK_LOCATION_TYPES.REMOTE);
    expect(shouldConfirmNonRemoteCopy(workMode)).toBe(false);
  });

  test("still detects hybrid when work arrangement requires on-site presence", () => {
    expect(
      detectJobDescriptionWorkMode(
        "Hybrid role with 3 days in-office. Remote and on-site collaboration required."
      ).type
    ).toBe(WORK_LOCATION_TYPES.HYBRID);
  });
});
