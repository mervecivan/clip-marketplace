import { db } from "@/db";
import { submissionMetrics, submissions } from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { computeEarnings } from "@/lib/payout";

type DbLike = typeof db;

export async function approvedSpendCents(
  tx: DbLike,
  campaignId: number,
  payoutPer1kViews: number,
): Promise<number> {
  const latestMetrics = tx
    .selectDistinctOn([submissionMetrics.submissionId], {
      submissionId: submissionMetrics.submissionId,
      views: submissionMetrics.views,
    })
    .from(submissionMetrics)
    .orderBy(submissionMetrics.submissionId, desc(submissionMetrics.capturedAt))
    .as("latest_metrics");

  const [row] = await tx
    .select({
      total: sql<number>`coalesce(sum(floor(${latestMetrics.views} / 1000.0) * ${payoutPer1kViews}), 0)`,
    })
    .from(submissions)
    .innerJoin(latestMetrics, eq(latestMetrics.submissionId, submissions.id))
    .where(
      and(
        eq(submissions.campaignId, campaignId),
        inArray(submissions.status, ["approved", "paid"]),
      ),
    );

  return Number(row?.total ?? 0);
}

export async function latestViewsForSubmission(
  tx: DbLike,
  submissionId: number,
): Promise<number> {
  const [latestMetric] = await tx
    .select()
    .from(submissionMetrics)
    .where(eq(submissionMetrics.submissionId, submissionId))
    .orderBy(desc(submissionMetrics.capturedAt))
    .limit(1);

  return latestMetric?.views ?? 0;
}

export function spendForViews(views: number, payoutPer1kViews: number): number {
  return computeEarnings(views, payoutPer1kViews);
}
