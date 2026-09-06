import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { submissionMetrics, submissions } from "@/db/schema";
import { processAllIsolated } from "@/lib/isolated";
import { maybeCompleteCampaign, sumApprovedSpend } from "@/server/budget";
import { campaigns } from "@/db/schema";

export type IngestResult = {
  processed: number;
  skipped: number;
  failed: { submissionId: number; error: string }[];
};

function defaultBump(previousViews: number): number {
  const increment = 1 + Math.floor(Math.random() * 4000);
  return previousViews + increment;
}

export async function runIngest(opts?: {
  capturedAt?: string;
  nextViews?: (previousViews: number) => number;
}): Promise<IngestResult> {
  const capturedAt = opts?.capturedAt ?? new Date().toISOString().slice(0, 10);
  const nextViews = opts?.nextViews ?? defaultBump;

  const approved = await db
    .select({
      id: submissions.id,
      campaignId: submissions.campaignId,
    })
    .from(submissions)
    .where(eq(submissions.status, "approved"));

  let processed = 0;
  let skipped = 0;

  const { failed } = await processAllIsolated(approved, async (submission) => {
    const outcome = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: submissionMetrics.id })
        .from(submissionMetrics)
        .where(
          and(
            eq(submissionMetrics.submissionId, submission.id),
            eq(submissionMetrics.capturedAt, capturedAt),
          ),
        )
        .limit(1);

      if (existing) {
        return "skipped" as const;
      }

      const [previous] = await tx
        .select({
          views: submissionMetrics.views,
          likes: submissionMetrics.likes,
          comments: submissionMetrics.comments,
        })
        .from(submissionMetrics)
        .where(eq(submissionMetrics.submissionId, submission.id))
        .orderBy(desc(submissionMetrics.capturedAt))
        .limit(1);

      const previousViews = previous?.views ?? 0;
      const views = nextViews(previousViews);
      if (views < previousViews) {
        throw new Error("views must never go down");
      }

      await tx.insert(submissionMetrics).values({
        submissionId: submission.id,
        capturedAt,
        views,
        likes: previous?.likes ?? 0,
        comments: previous?.comments ?? 0,
      });

      return "inserted" as const;
    });

    if (outcome === "skipped") {
      skipped += 1;
    } else {
      processed += 1;
    }
  });

  const campaignIds = [...new Set(approved.map((row) => row.campaignId))];
  for (const campaignId of campaignIds) {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);
    if (!campaign || campaign.status === "completed") {
      continue;
    }
    const { spent } = await sumApprovedSpend(db, campaign.id, campaign.payoutPer1kViews);
    await maybeCompleteCampaign(db, campaign.id, campaign.totalBudget, spent);
  }

  return {
    processed,
    skipped,
    failed: failed.map((entry) => ({
      submissionId: entry.item.id,
      error: entry.error,
    })),
  };
}
