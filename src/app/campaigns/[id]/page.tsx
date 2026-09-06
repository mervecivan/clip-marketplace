"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submissionFormSchema, type SubmissionFormValues } from "@/shared/submission-schema";

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = Number(params.id);
  const me = trpc.me.useQuery();

  if (!Number.isInteger(campaignId) || campaignId <= 0) {
    return <p>Invalid campaign.</p>;
  }
  if (me.isLoading) return <p>Loading…</p>;
  if (!me.data) return <p>Switch to a user above to continue.</p>;
  if (me.data.role === "admin") return <AdminCampaignDetail campaignId={campaignId} />;
  return <CreatorSubmit campaignId={campaignId} />;
}

function AdminCampaignDetail({ campaignId }: { campaignId: number }) {
  const utils = trpc.useUtils();
  const overview = trpc.campaign.overview.useQuery({ id: campaignId });
  const pending = trpc.submission.pendingByCampaign.useQuery({ campaignId });
  const activate = trpc.campaign.activate.useMutation({
    onSuccess: () => {
      utils.campaign.overview.invalidate({ id: campaignId });
      utils.campaign.list.invalidate();
    },
  });

  if (overview.isLoading) return <p>Loading…</p>;
  if (overview.error) return <p className="text-destructive">{overview.error.message}</p>;
  if (!overview.data) return <p>Not found.</p>;

  const { campaign, totalApprovedViews, budgetSpent, budgetLeft, dailyViews } = overview.data;
  const maxViews = Math.max(1, ...dailyViews.map((d) => d.views));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium">{campaign.title}</h1>
          <p className="text-sm text-muted-foreground">
            {campaign.status} · {campaign.platforms.join(", ")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href={`/campaigns/${campaignId}/edit`} />}>
            Edit
          </Button>
          {campaign.status === "draft" || campaign.status === "paused" ? (
            <Button
              type="button"
              onClick={() => activate.mutate({ id: campaignId })}
              disabled={activate.isPending}
            >
              Activate
            </Button>
          ) : null}
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Overview</h2>
        <ul className="grid gap-2 text-sm sm:grid-cols-3">
          <li className="rounded-md border p-3">
            Total approved views
            <div className="text-lg">{totalApprovedViews}</div>
          </li>
          <li className="rounded-md border p-3">
            Budget spent (cents)
            <div className="text-lg">{budgetSpent}</div>
          </li>
          <li className="rounded-md border p-3">
            Budget left (cents)
            <div className="text-lg">{budgetLeft}</div>
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Daily views</h2>
        {dailyViews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No days in campaign period.</p>
        ) : (
          <div
            className="flex h-40 items-end gap-px overflow-x-auto"
            role="img"
            aria-label="Daily views across the campaign period"
          >
            {dailyViews.map((day) => (
              <div
                key={day.date}
                className="min-w-2 flex-1 bg-primary"
                style={{ height: `${Math.max(2, (day.views / maxViews) * 100)}%` }}
                title={`${day.date}: ${day.views} views`}
              >
                <span className="sr-only">
                  {day.date}: {day.views} views
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Review queue</h2>
        {pending.isLoading && <p>Loading submissions…</p>}
        {pending.error && <p className="text-destructive">{pending.error.message}</p>}
        {pending.data && pending.data.length === 0 && <p>No pending submissions.</p>}
        {pending.data?.map((submission) => (
          <ReviewItem key={submission.id} campaignId={campaignId} submission={submission} />
        ))}
      </section>
    </div>
  );
}

function ReviewItem({
  campaignId,
  submission,
}: {
  campaignId: number;
  submission: {
    id: number;
    postUrl: string;
    platform: string;
    creatorId: number;
  };
}) {
  const utils = trpc.useUtils();
  const [reason, setReason] = useState("");
  const [budgetError, setBudgetError] = useState(false);

  const approve = trpc.submission.approve.useMutation({
    onSuccess: () => {
      setBudgetError(false);
      utils.submission.pendingByCampaign.invalidate({ campaignId });
      utils.campaign.overview.invalidate({ id: campaignId });
    },
    onError: (error) => {
      setBudgetError(error.message === "BUDGET_EXCEEDED");
    },
  });

  const reject = trpc.submission.reject.useMutation({
    onSuccess: () => {
      utils.submission.pendingByCampaign.invalidate({ campaignId });
    },
  });

  return (
    <article className="flex flex-col gap-3 rounded-md border p-4">
      <p className="text-sm">
        <a href={submission.postUrl} className="underline underline-offset-4" target="_blank" rel="noreferrer">
          {submission.postUrl}
        </a>
        <span className="text-muted-foreground"> · {submission.platform} · creator #{submission.creatorId}</span>
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Button
          type="button"
          onClick={() => approve.mutate({ submissionId: submission.id })}
          disabled={approve.isPending}
        >
          Approve
        </Button>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`reason-${submission.id}`}>Rejection reason</Label>
          <Input
            id={`reason-${submission.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="destructive"
          disabled={reject.isPending}
          onClick={() => reject.mutate({ submissionId: submission.id, reason })}
        >
          Reject
        </Button>
      </div>
      {budgetError && (
        <p className="text-sm text-destructive">
          Approving this clip would exceed the campaign budget. It was left pending.
        </p>
      )}
      {approve.error && !budgetError && (
        <p className="text-sm text-destructive">{approve.error.message}</p>
      )}
      {reject.error && <p className="text-sm text-destructive">{reject.error.message}</p>}
    </article>
  );
}

function CreatorSubmit({ campaignId }: { campaignId: number }) {
  const utils = trpc.useUtils();
  const campaigns = trpc.submission.activeCampaigns.useQuery();
  const campaign = campaigns.data?.find((c) => c.id === campaignId);

  const form = useForm<SubmissionFormValues>({
    resolver: zodResolver(submissionFormSchema),
    defaultValues: {
      campaignId,
      postUrl: "",
      platform: "tiktok",
    },
  });

  const create = trpc.submission.create.useMutation({
    onSuccess: () => {
      utils.submission.mySubmissions.invalidate();
      form.reset({ campaignId, postUrl: "", platform: form.getValues("platform") });
    },
  });

  if (campaigns.isLoading) return <p>Loading…</p>;
  if (!campaign) return <p>This campaign is not active or does not exist.</p>;

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <h1 className="text-xl font-medium">{campaign.title}</h1>
      <p className="text-sm text-muted-foreground">
        Platforms: {campaign.platforms.join(", ")} · {campaign.payoutPer1kViews} cents / 1k views
      </p>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => create.mutate(values))}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="platform">Platform</Label>
          <select
            id="platform"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            {...form.register("platform")}
          >
            {campaign.platforms.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="postUrl">Post URL</Label>
          <Input id="postUrl" type="url" {...form.register("postUrl")} />
          {form.formState.errors.postUrl && (
            <p className="text-sm text-destructive">{form.formState.errors.postUrl.message}</p>
          )}
        </div>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Submitting…" : "Submit clip"}
        </Button>
        {create.error && <p className="text-sm text-destructive">{create.error.message}</p>}
        {create.isSuccess && <p className="text-sm">Submitted. It is pending review.</p>}
      </form>
    </div>
  );
}
