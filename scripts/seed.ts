import "dotenv/config";
import { client, db } from "@/db";
import { users } from "@/db/schema";

async function main() {
  await db
    .insert(users)
    .values([
      { email: "admin@example.com", role: "admin" },
      { email: "creator@example.com", role: "creator" },
    ])
    .onConflictDoNothing();

  console.log("Seeded development users.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
