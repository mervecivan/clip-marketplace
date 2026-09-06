import { afterEach, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { campaigns, submissionMetrics, submissions, users } from "@/db/schema";
import { runIngest } from "@/lib/ingest";
import { appRouter } from "./routers/_app";

const createdUserIds: number[] = [];
const createdCampaignIds: number[] = [];

afterEach(async () => {
  if (createdCampaignIds.length > 0) {
    const submissionRows = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(inArray(submissions.campaignId, createdCampaignIds));
    const submissionIds = submissionRows.map((row) => row.id);
    if (submissionIds.length > 0) {
      await db.delete(submissionMetrics).where(inArray(submissionMetrics.submissionId, submissionIds));
    }
    await db.delete(submissions).where(inArray(submissions.campaignId, createdCampaignIds));
    await db.delete(campaigns).where(inArray(campaigns.id, createdCampaignIds));
  }
  if (createdUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  createdCampaignIds.length = 0;
  createdUserIds.length = 0;
});

async function createFixture() {
  const [admin, creatorOne, creatorTwo] = await db
    .insert(users)
    .values([
      { email: `admin-${crypto.randomUUID()}@example.com`, role: "admin" },
      { email: `creator-one-${crypto.randomUUID()}@example.com`, role: "creator" },
      { email: `creator-two-${crypto.randomUUID()}@example.com`, role: "creator" },
    ])
    .returning();
  createdUserIds.push(admin.id, creatorOne.id, creatorTwo.id);

  const [campaign] = await db
    .insert(campaigns)
    .values({
      title: `Test ${crypto.randomUUID()}`,
      platforms: ["tiktok"],
      payoutPer1kViews: 100,
      totalBudget: 100,
      status: "active",
      startsAt: new Date("2030-01-01T00:00:00.000Z"),
      endsAt: new Date("2030-01-31T00:00:00.000Z"),
    })
    .returning();
  createdCampaignIds.push(campaign.id);

  return { admin, creatorOne, creatorTwo, campaign };
}

describe("database-backed workflow guarantees", () => {
  it("serializes concurrent approvals so only the first approval consumes a one-payout budget", async () => {
    const { admin, creatorOne, creatorTwo, campaign } = await createFixture();
    const [first, second] = await db
      .insert(submissions)
      .values([
        {
          campaignId: campaign.id,
          creatorId: creatorOne.id,
          postUrl: `https://www.tiktok.com/@one/video/${Date.now()}1`,
          platform: "tiktok",
        },
        {
          campaignId: campaign.id,
          creatorId: creatorTwo.id,
          postUrl: `https://www.tiktok.com/@two/video/${Date.now()}2`,
          platform: "tiktok",
        },
      ])
      .returning();

    await db.insert(submissionMetrics).values([
      { submissionId: first.id, capturedAt: "2030-01-01", views: 1_000, likes: 0, comments: 0 },
      { submissionId: second.id, capturedAt: "2030-01-01", views: 1_000, likes: 0, comments: 0 },
    ]);

    const caller = appRouter.createCaller({ user: admin });
    const results = await Promise.allSettled([
      caller.submission.approve({ submissionId: first.id }),
      caller.submission.approve({ submissionId: second.id }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "PRECONDITION_FAILED" },
    });
  });

  it("does not add a second metric row when ingest runs twice for the same day", async () => {
    const { creatorOne, campaign } = await createFixture();
    const [submission] = await db
      .insert(submissions)
      .values({
        campaignId: campaign.id,
        creatorId: creatorOne.id,
        postUrl: `https://www.tiktok.com/@creator/video/${Date.now()}3`,
        platform: "tiktok",
        status: "approved",
      })
      .returning();

    const first = await runIngest({ capturedAt: "2030-01-02", nextViews: (views) => views + 100 });
    const second = await runIngest({ capturedAt: "2030-01-02", nextViews: (views) => views + 100 });
    const rows = await db
      .select()
      .from(submissionMetrics)
      .where(
        and(
          eq(submissionMetrics.submissionId, submission.id),
          eq(submissionMetrics.capturedAt, "2030-01-02"),
        ),
      );

    expect(first).toMatchObject({ processed: 1, skipped: 0, failed: [] });
    expect(second).toMatchObject({ processed: 0, skipped: 1, failed: [] });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.views).toBe(100);
  });
});
