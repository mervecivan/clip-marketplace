"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { DevSwitcher } from "@/app/dev-switcher";

export function AppShell({ children }: { children: React.ReactNode }) {
  const me = trpc.me.useQuery();
  const role = me.data?.role;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="font-medium">
              Clip marketplace
            </Link>
            <nav className="flex flex-wrap gap-3 text-sm">
              {role === "admin" && (
                <>
                  <Link href="/" className="underline-offset-4 hover:underline">
                    Campaigns
                  </Link>
                  <Link href="/campaigns/new" className="underline-offset-4 hover:underline">
                    New campaign
                  </Link>
                </>
              )}
              {role === "creator" && (
                <>
                  <Link href="/" className="underline-offset-4 hover:underline">
                    Active campaigns
                  </Link>
                  <Link href="/mine" className="underline-offset-4 hover:underline">
                    My submissions
                  </Link>
                </>
              )}
            </nav>
          </div>
          <DevSwitcher />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
