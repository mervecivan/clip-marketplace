import { and, desc, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { campaigns, submissionMetrics, submissions } from "@/db/schema";
import { computeEarnings } from "@/lib/payout";

type DbLike = PostgresJsDatabase | Parameters<Parameters<PostgresJsDatabase["transaction"]>[0]>[0];

export async function latestViewsBySubmissionIds(
  tx: DbLike,
  submissionIds: number[],
): Promise<Map<number, number>> {
  const viewsBySubmission = new Map<number, number>();
  if (submissionIds.length === 0) {
    return viewsBySubmission;
  }

  const rows = await tx
    .select({
      submissionId: submissionMetrics.submissionId,
      capturedAt: submissionMetrics.capturedAt,
      views: submissionMetrics.views,
    })
    .from(submissionMetrics)
    .where(inArray(submissionMetrics.submissionId, submissionIds))
    .orderBy(desc(submissionMetrics.capturedAt));

  for (const row of rows) {
    if (!viewsBySubmission.has(row.submissionId)) {
      viewsBySubmission.set(row.submissionId, row.views);
    }
  }

  return viewsBySubmission;
}

export async function sumApprovedSpend(
  tx: DbLike,
  campaignId: number,
  payoutPer1kViews: number,
): Promise<{ spent: number; approvedViews: number }> {
  const approved = await tx
    .select({ id: submissions.id })
    .from(submissions)
    .where(
      and(
        eq(submissions.campaignId, campaignId),
        inArray(submissions.status, ["approved", "paid"]),
      ),
    );

  const viewsBySubmission = await latestViewsBySubmissionIds(
    tx,
    approved.map((row) => row.id),
  );

  let spent = 0;
  let approvedViews = 0;
  for (const row of approved) {
    const views = viewsBySubmission.get(row.id) ?? 0;
    approvedViews += views;
    spent += computeEarnings(views, payoutPer1kViews);
  }

  return { spent, approvedViews };
}

export async function maybeCompleteCampaign(
  tx: DbLike,
  campaignId: number,
  totalBudget: number,
  spent: number,
): Promise<boolean> {
  if (spent < totalBudget) {
    return false;
  }

  await tx
    .update(campaigns)
    .set({ status: "completed" })
    .where(eq(campaigns.id, campaignId));

  return true;
}
