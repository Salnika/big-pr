export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

export function formatRefreshTime(timestamp: number) {
  if (!timestamp) {
    return null;
  }

  const date = new Date(timestamp);

  // Saved data can be days old, so only drop the date for today's syncs.
  return date.toDateString() === new Date().toDateString()
    ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date)
    : formatDateTime(date.toISOString());
}
