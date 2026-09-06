export async function processAllIsolated<T>(
  items: T[],
  work: (item: T) => Promise<void>,
): Promise<{ failed: { item: T; error: string }[] }> {
  const failed: { item: T; error: string }[] = [];

  for (const item of items) {
    try {
      await work(item);
    } catch (error) {
      failed.push({
        item,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { failed };
}
