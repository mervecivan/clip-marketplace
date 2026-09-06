import { z } from "zod";
import { router, creatorProcedure, adminProcedure } from "../trpc";
import { db } from "@/db";
import { submissions, campaigns, submissionMetrics } from "@/db/schema";
import { submissionFormSchema } from "@/shared/submission-schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { computeEarnings, wouldExceedBudget } from "@/lib/payout";
import { APP_ERROR, AppError } from "@/shared/errors";
import { maybeCompleteCampaign, sumApprovedSpend } from "@/server/budget";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

export const submissionRouter = router({
  activeCampaigns: creatorProcedure.query(async () => {
    return db.select().from(campaigns).where(eq(campaigns.status, "active"));
  }),

  create: creatorProcedure
    .input(submissionFormSchema)
    .mutation(async ({ input, ctx }) => {
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.campaignId))
        .limit(1);

      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }
      if (campaign.status !== "active") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can only submit to active campaigns",
        });
      }
      if (!campaign.platforms.includes(input.platform)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This campaign does not accept that platform",
        });
      }

      try {
        const [created] = await db
          .insert(submissions)
          .values({
            campaignId: input.campaignId,
            creatorId: ctx.user.id,
            postUrl: input.postUrl,
            platform: input.platform,
            status: "pending",
          })
          .returning();

        return created;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This URL has already been submitted to this campaign",
          });
        }
        throw error;
      }
    }),

  mySubmissions: creatorProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        submission: submissions,
        campaign: campaigns,
      })
      .from(submissions)
      .innerJoin(campaigns, eq(submissions.campaignId, campaigns.id))
      .where(eq(submissions.creatorId, ctx.user.id))
      .orderBy(desc(submissions.createdAt));

    const ids = rows.map((row) => row.submission.id);
    const latestViews = new Map<number, number>();
    const metricRows =
      ids.length === 0
        ? []
        : await db
            .select({
              submissionId: submissionMetrics.submissionId,
              capturedAt: submissionMetrics.capturedAt,
              views: submissionMetrics.views,
            })
            .from(submissionMetrics)
            .where(inArray(submissionMetrics.submissionId, ids))
            .orderBy(desc(submissionMetrics.capturedAt));

    for (const row of metricRows) {
      if (!ids.includes(row.submissionId)) continue;
      if (!latestViews.has(row.submissionId)) {
        latestViews.set(row.submissionId, row.views);
      }
    }

    return rows.map((row) => {
      const views = latestViews.get(row.submission.id) ?? 0;
      const estimatedEarnings = computeEarnings(views, row.campaign.payoutPer1kViews);
      return {
        ...row.submission,
        campaignTitle: row.campaign.title,
        views,
        estimatedEarnings,
      };
    });
  }),

  pendingByCampaign: adminProcedure
    .input(z.object({ campaignId: z.number().int().positive() }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(submissions)
        .where(
          and(eq(submissions.campaignId, input.campaignId), eq(submissions.status, "pending")),
        )
        .orderBy(desc(submissions.createdAt));
    }),

  reject: adminProcedure
    .input(
      z.object({
        submissionId: z.number().int().positive(),
        reason: z.string().min(1, "A rejection reason is required"),
      }),
    )
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(submissions)
        .set({
          status: "rejected",
          rejectionReason: input.reason,
          updatedAt: new Date(),
        })
        .where(and(eq(submissions.id, input.submissionId), eq(submissions.status, "pending")))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pending submission not found",
        });
      }
      return updated;
    }),

  approve: adminProcedure
    .input(z.object({ submissionId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      return await db.transaction(async (tx) => {
        const [submission] = await tx
          .select()
          .from(submissions)
          .where(eq(submissions.id, input.submissionId))
          .limit(1);

        if (!submission) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
        }

        const [campaign] = await tx
          .select()
          .from(campaigns)
          .where(eq(campaigns.id, submission.campaignId))
          .for("update")
          .limit(1);

        if (!campaign) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
        }

        const [lockedSubmission] = await tx
          .select()
          .from(submissions)
          .where(eq(submissions.id, submission.id))
          .for("update")
          .limit(1);

        if (!lockedSubmission || lockedSubmission.status !== "pending") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This submission is not pending",
          });
        }

        const [latestMetric] = await tx
          .select()
          .from(submissionMetrics)
          .where(eq(submissionMetrics.submissionId, lockedSubmission.id))
          .orderBy(desc(submissionMetrics.capturedAt))
          .limit(1);

        const views = latestMetric?.views ?? 0;
        const earnings = computeEarnings(views, campaign.payoutPer1kViews);
        const { spent: alreadySpent } = await sumApprovedSpend(
          tx,
          campaign.id,
          campaign.payoutPer1kViews,
        );

        if (wouldExceedBudget(alreadySpent, earnings, campaign.totalBudget)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: APP_ERROR.BUDGET_EXCEEDED,
            cause: new AppError(
              APP_ERROR.BUDGET_EXCEEDED,
              "Approving this submission would exceed the campaign budget",
            ),
          });
        }

        const [updatedSubmission] = await tx
          .update(submissions)
          .set({ status: "approved", updatedAt: new Date() })
          .where(eq(submissions.id, lockedSubmission.id))
          .returning();

        const newTotal = alreadySpent + earnings;
        await maybeCompleteCampaign(tx, campaign.id, campaign.totalBudget, newTotal);

        return {
          submission: updatedSubmission,
          earnings,
          remainingBudget: campaign.totalBudget - newTotal,
        };
      });
    }),
});
