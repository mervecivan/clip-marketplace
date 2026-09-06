import { pgTable, pgEnum, serial, text, integer, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "creator"]);
export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "active", "paused", "completed"]);
export const submissionStatusEnum = pgEnum("submission_status", ["pending", "approved", "rejected", "paid"]);
export const platformEnum = pgEnum("platform", ["tiktok", "instagram", "youtube"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").notNull().default("creator"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  platforms: platformEnum("platforms").array().notNull(),
  // Para tutarlarını kuruş olarak saklıyorum; böylece hesaplamalarda kesir hatası oluşmuyor.
  payoutPer1kViews: integer("payout_per_1k_views").notNull(),
  totalBudget: integer("total_budget").notNull(),
  status: campaignStatusEnum("status").notNull().default("draft"),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id),
  creatorId: integer("creator_id").notNull().references(() => users.id),
  postUrl: text("post_url").notNull(),
  platform: platformEnum("platform").notNull(),
  status: submissionStatusEnum("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Aynı linkin aynı kampanyaya ikinci kez eklenmesini veritabanı düzeyinde engelliyorum.
  uniqueUrlPerCampaign: uniqueIndex("unique_url_per_campaign").on(table.campaignId, table.postUrl),
}));

export const submissionMetrics = pgTable("submission_metrics", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => submissions.id),
  capturedAt: date("captured_at").notNull(),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
}, (table) => ({
  // Ingest tekrar çalışsa da aynı gün için ikinci bir metrik satırı oluşmamalı.
  oneRowPerSubmissionPerDay: uniqueIndex("one_row_per_submission_per_day").on(table.submissionId, table.capturedAt),
}));
