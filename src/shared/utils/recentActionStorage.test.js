import {
  loadRecentPromptCopy,
  loadRecentResumeSave,
  saveRecentPromptCopy,
  saveRecentResumeSave,
} from "./recentActionStorage";

describe("recentActionStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("saves and loads recent prompt copy for a profile", () => {
    saveRecentPromptCopy(7, {
      companyName: "Meta",
      roleName: "AI Engineer",
    });

    expect(loadRecentPromptCopy(7)).toEqual({
      companyName: "Meta",
      roleName: "AI Engineer",
    });
  });

  test("saves and loads recent resume save for a profile", () => {
    saveRecentResumeSave(9, {
      companyName: "FICO",
      roleName: "Senior Engineer, AI",
    });

    expect(loadRecentResumeSave(9)).toEqual({
      companyName: "FICO",
      roleName: "Senior Engineer, AI",
    });
  });

  test("ignores incomplete entries", () => {
    saveRecentPromptCopy(3, { companyName: "Meta", roleName: "" });
    expect(loadRecentPromptCopy(3)).toBeNull();
  });
});
