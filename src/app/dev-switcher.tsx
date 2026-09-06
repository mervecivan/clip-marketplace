"use client";

import { trpc } from "@/lib/trpc";
import { switchUser } from "@/app/actions/auth";

export function DevSwitcher() {
  const { data: users, isLoading, error } = trpc.devListUsers.useQuery();
  const me = trpc.me.useQuery();

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading users…</p>;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!users || users.length === 0) {
    return <p className="text-sm text-muted-foreground">No users yet. Run pnpm db:seed.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
      <span className="font-medium">Dev user switcher</span>
      {me.data && (
        <span className="text-muted-foreground">
          Current: {me.data.email} ({me.data.role})
        </span>
      )}
      {users.map((u) => (
        <form action={switchUser.bind(null, u.id)} key={u.id}>
          <button
            type="submit"
            className="rounded-md border bg-background px-2 py-1 hover:bg-muted"
          >
            {u.email} ({u.role})
          </button>
        </form>
      ))}
    </div>
  );
}
