import { submissionRouter } from "./submission";
import { router, publicProcedure } from "../trpc";
import { db } from "@/db";
import { users } from "@/db/schema";
import { campaignRouter } from "./campaign";

export const appRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user),
  devListUsers: publicProcedure.query(async () => {
    return db.select().from(users);
  }),
  campaign: campaignRouter,
  submission: submissionRouter,
});

export type AppRouter = typeof appRouter;
