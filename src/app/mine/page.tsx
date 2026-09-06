"use client";

import { trpc } from "@/lib/trpc";

export default function MySubmissionsPage() {
  const me = trpc.me.useQuery();
  const list = trpc.submission.mySubmissions.useQuery(undefined, {
    enabled: me.data?.role === "creator",
  });

  if (me.isLoading) return <p>Loading…</p>;
  if (!me.data) return <p>Switch to a user above to continue.</p>;
  if (me.data.role !== "creator") return <p>Switch to a creator to see submissions.</p>;
  if (list.isLoading) return <p>Loading submissions…</p>;
  if (list.error) return <p className="text-destructive">{list.error.message}</p>;
  if (!list.data || list.data.length === 0) return <p>No submissions yet.</p>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-medium">My submissions</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-3">Campaign</th>
              <th className="py-2 pr-3">URL</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Views</th>
              <th className="py-2 pr-3">Estimated earnings (cents)</th>
            </tr>
          </thead>
          <tbody>
            {list.data.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="py-2 pr-3">{row.campaignTitle}</td>
                <td className="py-2 pr-3">
                  <a href={row.postUrl} className="underline underline-offset-4" target="_blank" rel="noreferrer">
                    {row.postUrl}
                  </a>
                </td>
                <td className="py-2 pr-3">
                  {row.status}
                  {row.status === "rejected" && row.rejectionReason
                    ? ` — ${row.rejectionReason}`
                    : null}
                </td>
                <td className="py-2 pr-3">{row.views}</td>
                <td className="py-2 pr-3">{row.estimatedEarnings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
