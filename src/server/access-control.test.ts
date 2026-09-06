import { describe, expect, it } from "vitest";
import { appRouter } from "./routers/_app";

const admin = { id: 1, email: "admin@example.com", role: "admin" as const, createdAt: new Date() };
const creator = { id: 2, email: "creator@example.com", role: "creator" as const, createdAt: new Date() };

describe("role access control", () => {
  it("does not let a creator invoke an admin campaign procedure", async () => {
    const caller = appRouter.createCaller({ user: creator });
    await expect(caller.campaign.list({ page: 1, pageSize: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("does not let an admin invoke a creator submission procedure", async () => {
    const caller = appRouter.createCaller({ user: admin });
    await expect(caller.submission.mySubmissions()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
