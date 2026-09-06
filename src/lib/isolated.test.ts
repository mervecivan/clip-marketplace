import { describe, expect, it } from "vitest";
import { processAllIsolated } from "./isolated";

describe("processAllIsolated", () => {
  it("continues after an item fails and reports that item", async () => {
    const processed: number[] = [];
    const result = await processAllIsolated([1, 2, 3], async (value) => {
      if (value === 2) throw new Error("sync failed");
      processed.push(value);
    });

    expect(processed).toEqual([1, 3]);
    expect(result.failed).toEqual([{ item: 2, error: "sync failed" }]);
  });
});
