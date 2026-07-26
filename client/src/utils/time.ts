// Formatting for the times shown on messages.

// The time of day a message was sent, e.g. "14:32".
export function toClockTime(isoDate: string) {
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// A heading for a day's worth of messages: "Today", "Yesterday", or a date.
export function toDayLabel(isoDate: string) {
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) {
    return "";
  }

  // Compare the calendar day, ignoring the time of day
  const startOfThatDay = new Date(date);
  startOfThatDay.setHours(0, 0, 0, 0);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const daysApart = Math.round(
    (startOfToday.getTime() - startOfThatDay.getTime()) / millisecondsPerDay
  );

  if (daysApart === 0) {
    return "Today";
  }
  if (daysApart === 1) {
    return "Yesterday";
  }

  // Within the last week, the weekday alone is easiest to read
  if (daysApart < 7) {
    return date.toLocaleDateString(undefined, { weekday: "long" });
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Do these two messages belong under the same day heading?
// Used to decide where to insert a divider in the conversation.
export function isSameDay(firstIso: string, secondIso: string) {
  const first = new Date(firstIso);
  const second = new Date(secondIso);

  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}
