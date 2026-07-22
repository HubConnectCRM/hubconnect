export const CALENDAR_COLORS = [
  "#fb923c", // orange
  "#22d3ee", // cyan
  "#f472b6", // pink
  "#a78bfa", // purple
  "#34d399", // mint
  "#facc15", // yellow
  "#818cf8", // indigo
  "#f87171", // red
  "#2dd4bf", // teal
];

export function calendarColor(userId, isMe = false) {
  if (isMe) return "#d7ff77";
  const value = String(userId || "unknown");
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return CALENDAR_COLORS[Math.abs(hash >>> 0) % CALENDAR_COLORS.length];
}
