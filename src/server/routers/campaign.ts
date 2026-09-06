import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure, creatorProcedure } from "../trpc";
import { db } from "@/db";
import { campaigns, submissionMetrics, submissions } from "@/db/schema";
import { campaignFormSchema, campaignUpdateSchema } from "@/shared/campaign-schema";
import { eq, ilike, and, count, desc, inArray } from "drizzle-orm";
import { eachUtcDateInclusive } from "@/lib/dates";
import { sumApprovedSpend } from "@/server/budget";

export const campaignRouter = router({
  list: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(10),
        search: z.string().optional(),
        status: z.enum(["draft", "active", "paused", "completed"]).optional(),
      }),
    )
    .query(async ({ input }) => {
      const { page, pageSize, search, status } = input;

      const filters = [];
      if (search) {
        filters.push(ilike(campaigns.title, `%${search}%`));
      }
      if (status) {
        filters.push(eq(campaigns.status, status));
      }
      const whereClause = filters.length > 0 ? and(...filters) : undefined;

      const [items, totalResult] = await Promise.all([
        db
          .select()
          .from(campaigns)
          .where(whereClause)
          .orderBy(desc(campaigns.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ count: count() }).from(campaigns).where(whereClause),
      ]);

      const total = totalResult[0]?.count ?? 0;

      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  listActive: creatorProcedure.query(async () => {
    return db
      .select()
      .from(campaigns)
      .where(eq(campaigns.status, "active"))
      .orderBy(desc(campaigns.createdAt));
  }),

  get: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.id))
        .limit(1);

      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      return campaign;
    }),

  getActive: creatorProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.id, input.id), eq(campaigns.status, "active")))
        .limit(1);

      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Active campaign not found" });
      }

      return campaign;
    }),

  create: adminProcedure.input(campaignFormSchema).mutation(async ({ input }) => {
    const [created] = await db
      .insert(campaigns)
      .values({
        title: input.title,
        platforms: input.platforms,
        payoutPer1kViews: input.payoutPer1kViews,
        totalBudget: input.totalBudget,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status: input.status,
      })
      .returning();

    return created;
  }),

  update: adminProcedure.input(campaignUpdateSchema).mutation(async ({ input }) => {
    const [updated] = await db
      .update(campaigns)
      .set({
        title: input.title,
        platforms: input.platforms,
        payoutPer1kViews: input.payoutPer1kViews,
        totalBudget: input.totalBudget,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status: input.status,
      })
      .where(eq(campaigns.id, input.id))
      .returning();

    if (!updated) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
    }

    return updated;
  }),

  activate: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(campaigns)
        .set({ status: "active" })
        .where(and(eq(campaigns.id, input.id), inArray(campaigns.status, ["draft", "paused"])))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft or paused campaigns can be activated",
        });
      }

      return updated;
    }),

  overview: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.id))
        .limit(1);

      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      const { spent, approvedViews } = await sumApprovedSpend(
        db,
        campaign.id,
        campaign.payoutPer1kViews,
      );

      const campaignSubmissions = await db
        .select({ id: submissions.id })
        .from(submissions)
        .where(
          and(
            eq(submissions.campaignId, campaign.id),
            inArray(submissions.status, ["approved", "paid"]),
          ),
        );

      const submissionIds = campaignSubmissions.map((row) => row.id);
      const metricRows =
        submissionIds.length === 0
          ? []
          : await db
              .select({
                capturedAt: submissionMetrics.capturedAt,
                views: submissionMetrics.views,
              })
              .from(submissionMetrics)
              .where(inArray(submissionMetrics.submissionId, submissionIds));

      const viewsByDay = new Map<string, number>();
      for (const row of metricRows) {
        const day = String(row.capturedAt).slice(0, 10);
        viewsByDay.set(day, (viewsByDay.get(day) ?? 0) + row.views);
      }

      const dailyViews = eachUtcDateInclusive(campaign.startsAt, campaign.endsAt).map((date) => ({
        date,
        views: viewsByDay.get(date) ?? 0,
      }));

      return {
        campaign,
        totalApprovedViews: approvedViews,
        budgetSpent: spent,
        budgetLeft: Math.max(campaign.totalBudget - spent, 0),
        dailyViews,
      };
    }),
});
