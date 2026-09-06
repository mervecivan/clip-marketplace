function toUtcDateString(value: Date | string): string {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

export function eachUtcDateInclusive(start: Date | string, end: Date | string): string[] {
  const startStr = toUtcDateString(start);
  const endStr = toUtcDateString(end);
  const dates: string[] = [];
  const cursor = new Date(`${startStr}T00:00:00.000Z`);
  const last = new Date(`${endStr}T00:00:00.000Z`);

  while (cursor.getTime() <= last.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}
