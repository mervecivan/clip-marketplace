"use client";

import Link from "next/link";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATUSES = ["draft", "active", "paused", "completed"] as const;

export default function Home() {
  const me = trpc.me.useQuery();

  if (me.isLoading) return <p>Loading…</p>;
  if (!me.data) {
    return <p>Switch to a user above to continue.</p>;
  }
  if (me.data.role === "admin") return <AdminCampaignList />;
  return <CreatorCampaignList />;
}

function AdminCampaignList() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | (typeof STATUSES)[number]>("");

  const campaigns = trpc.campaign.list.useQuery({
    page,
    pageSize: 10,
    search: search || undefined,
    status: status || undefined,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-medium">Campaigns</h1>
        <Link href="/campaigns/new" className="text-sm underline underline-offset-4">
          New campaign
        </Link>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="search">Search title</Label>
          <Input
            id="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as typeof status);
            }}
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">Apply</Button>
      </form>

      {campaigns.isLoading && <p>Loading campaigns…</p>}
      {campaigns.error && <p className="text-destructive">{campaigns.error.message}</p>}
      {campaigns.data && campaigns.data.items.length === 0 && <p>No campaigns.</p>}
      {campaigns.data && campaigns.data.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Budget (cents)</th>
                <th className="py-2 pr-3">Payout / 1k</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.data.items.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="py-2 pr-3">
                    <Link href={`/campaigns/${c.id}`} className="underline underline-offset-4">
                      {c.title}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">{c.status}</td>
                  <td className="py-2 pr-3">{c.totalBudget}</td>
                  <td className="py-2 pr-3">{c.payoutPer1kViews}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {campaigns.data && campaigns.data.totalPages > 1 && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {campaigns.data.page} of {campaigns.data.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={page >= campaigns.data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function CreatorCampaignList() {
  const campaigns = trpc.submission.activeCampaigns.useQuery();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-medium">Active campaigns</h1>
      {campaigns.isLoading && <p>Loading campaigns…</p>}
      {campaigns.error && <p className="text-destructive">{campaigns.error.message}</p>}
      {campaigns.data && campaigns.data.length === 0 && <p>No active campaigns.</p>}
      {campaigns.data && campaigns.data.length > 0 && (
        <ul className="flex flex-col gap-3">
          {campaigns.data.map((c) => (
            <li key={c.id} className="rounded-md border p-4">
              <h2 className="font-medium">{c.title}</h2>
              <p className="text-sm text-muted-foreground">
                {c.platforms.join(", ")} · {c.payoutPer1kViews} cents / 1k views
              </p>
              <Link
                href={`/campaigns/${c.id}`}
                className="mt-2 inline-block text-sm underline underline-offset-4"
              >
                Submit a clip
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
