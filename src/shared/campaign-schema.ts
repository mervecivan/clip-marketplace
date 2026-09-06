import { z } from "zod";

export const platformEnum = z.enum(["tiktok", "instagram", "youtube"]);

export const campaignStatusEnum = z.enum(["draft", "active", "paused", "completed"]);

export const campaignFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  platforms: z.array(platformEnum).min(1, "Select at least one platform"),
  payoutPer1kViews: z.coerce.number().int().positive("Must be a positive integer (cents)"),
  totalBudget: z.coerce.number().int().positive("Must be a positive integer (cents)"),
  status: campaignStatusEnum.default("draft"),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
}).refine((data) => data.endsAt > data.startsAt, {
  message: "End date must be after start date",
  path: ["endsAt"],
});

export const campaignUpdateSchema = campaignFormSchema.and(
  z.object({ id: z.number().int().positive() }),
);

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;