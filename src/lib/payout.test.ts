import { describe, expect, it } from "vitest";
import { computeEarnings, wouldExceedBudget } from "./payout";

describe("payout calculation", () => {
  it("only pays complete 1,000-view blocks", () => {
    expect(computeEarnings(999, 125)).toBe(0);
    expect(computeEarnings(1_999, 125)).toBe(125);
    expect(computeEarnings(2_000, 125)).toBe(250);
  });

  it("permits an approval that exactly exhausts the budget", () => {
    expect(wouldExceedBudget(750, 250, 1_000)).toBe(false);
  });

  it("rejects an approval that would exceed the budget", () => {
    expect(wouldExceedBudget(750, 375, 1_000)).toBe(true);
  });
});
