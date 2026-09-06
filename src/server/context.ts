import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyUserId } from "@/lib/auth";
import type { NextRequest } from "next/server";

export async function createContext(opts: { req: NextRequest }) {
  const token = opts.req.cookies.get("authToken")?.value;

  let user = null;
  if (token) {
    const userId = await verifyUserId(token);
    if (userId !== null) {
      const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      user = result[0] ?? null;
    }
  }

  return { user };
}

export type Context = Awaited<ReturnType<typeof createContext>>;