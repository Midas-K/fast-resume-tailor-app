import { buildReapplyConfirmMessage } from "./confirmReapplyIfNeeded";
import { formatEstDateLabel } from "./estDateTime";

describe("confirmReapplyIfNeeded", () => {
  test("builds reapply confirm message with date", () => {
    expect(buildReapplyConfirmMessage("07/08/26")).toBe(
      "You applied this position at 07/08/26. Will You going to apply for this position again?"
    );
  });

  test("formats EST date labels as MM/DD/YY", () => {
    expect(formatEstDateLabel(new Date("2026-07-08T15:00:00.000Z"))).toBe(
      "07/08/26"
    );
  });
});
