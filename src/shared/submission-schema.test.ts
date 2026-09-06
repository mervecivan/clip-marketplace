import { describe, expect, it } from "vitest";
import { submissionFormSchema } from "./submission-schema";

describe("submission URL validation", () => {
  it("accepts a post URL for the selected platform", () => {
    expect(
      submissionFormSchema.safeParse({
        campaignId: 1,
        platform: "tiktok",
        postUrl: "https://www.tiktok.com/@creator/video/123456789",
      }).success,
    ).toBe(true);
  });

  it("rejects a URL from a different platform", () => {
    expect(
      submissionFormSchema.safeParse({
        campaignId: 1,
        platform: "instagram",
        postUrl: "https://www.tiktok.com/@creator/video/123456789",
      }).success,
    ).toBe(false);
  });
});
