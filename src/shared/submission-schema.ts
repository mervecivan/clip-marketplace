import { z } from "zod";
import { platformEnum } from "./campaign-schema";

const platformUrlPatterns: Record<string, RegExp> = {
  tiktok: /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
  instagram: /^https?:\/\/(www\.)?instagram\.com\/(reel|p)\/[\w-]+/,
  youtube: /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]+/,
};

export const submissionFormSchema = z.object({
  campaignId: z.number().int().positive(),
  postUrl: z.string().url("Enter a valid URL"),
  platform: platformEnum,
}).refine(
  (data) => platformUrlPatterns[data.platform]?.test(data.postUrl),
  {
    message: "URL does not look like a real post URL for this platform",
    path: ["postUrl"],
  }
);

export type SubmissionFormValues = z.infer<typeof submissionFormSchema>;