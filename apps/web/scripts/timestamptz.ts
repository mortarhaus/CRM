export function toTimestamptz(source: string): string {
  return source.replace(/timestamp\("([a-z_]+)"\)/g, 'timestamp("$1", { withTimezone: true })');
}
