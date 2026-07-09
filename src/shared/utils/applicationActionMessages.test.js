import {
  buildPromptCopiedMessage,
  buildRecentPromptBannerLabel,
  buildRecentResumeBannerLabel,
  buildResumeSavedMessage,
  formatApplicationDetails,
} from "./applicationActionMessages";

describe("applicationActionMessages", () => {
  test("formats company and role details", () => {
    expect(
      formatApplicationDetails({
        companyName: "Meta",
        roleName: "AI Engineer",
      })
    ).toBe("Company: Meta\nRole: AI Engineer");
  });

  test("builds prompt copied message with application context", () => {
    expect(
      buildPromptCopiedMessage({
        companyName: "FICO",
        roleName: "Senior Engineer, AI",
      })
    ).toBe("Prompt copied!\n\nCompany: FICO\nRole: Senior Engineer, AI");
  });

  test("builds resume saved message with application context", () => {
    expect(
      buildResumeSavedMessage(
        {
          savedPath: "6.8/1. Meta - AI Engineer/Neel_Patel.pdf",
          saveMode: "folder",
        },
        {
          companyName: "Meta",
          roleName: "AI Engineer",
        }
      )
    ).toBe(
      "Company: Meta\nRole: AI Engineer\n\nResume saved to your device!\n6.8/1. Meta - AI Engineer/Neel_Patel.pdf"
    );
  });

  test("builds recent banner labels", () => {
    expect(
      buildRecentPromptBannerLabel({
        companyName: "Meta",
        roleName: "AI Engineer",
      })
    ).toBe("Recent copied Prompt: Meta - AI Engineer");

    expect(
      buildRecentResumeBannerLabel({
        companyName: "FICO",
        roleName: "Senior Engineer, AI",
      })
    ).toBe("Recent generated Resume: FICO - Senior Engineer, AI");
  });
});
