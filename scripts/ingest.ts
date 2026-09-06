import "dotenv/config";
import { client } from "@/db";
import { runIngest } from "@/lib/ingest";

async function main() {
  const result = await runIngest();
  console.log(JSON.stringify(result, null, 2));

  if (result.failed.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
