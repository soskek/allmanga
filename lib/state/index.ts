import { type ReleaseState, type SemanticKind, type UserLane } from "@/lib/domain";

function zonedParts(now: Date, timezone = "Asia/Tokyo") {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  return Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value])) as Record<string, string>;
}

function offsetForTimezone(date: Date, timezone = "Asia/Tokyo") {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset"
  });
  const value = formatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";
  const match = value.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return "+00:00";
  }

  const [, sign, rawHour, rawMinute = "00"] = match;
  return `${sign}${rawHour.padStart(2, "0")}:${rawMinute.padStart(2, "0")}`;
}

function zonedBoundaryDate(now: Date, hour: number, timezone = "Asia/Tokyo") {
  const parts = zonedParts(now, timezone);
  const isoLocal = `${parts.year}-${parts.month}-${parts.day}T${String(hour).padStart(2, "0")}:00:00`;
  const offset = offsetForTimezone(new Date(`${isoLocal}Z`), timezone);
  return new Date(`${isoLocal}${offset}`);
}

export function calendarDayStartDate(now: Date, timezone = "Asia/Tokyo") {
  return zonedBoundaryDate(now, 0, timezone);
}

export function laneBoundaryDate(now: Date, dayBoundaryHour: number, timezone = "Asia/Tokyo") {
  const boundary = zonedBoundaryDate(now, dayBoundaryHour, timezone);
  if (now < boundary) {
    return new Date(boundary.getTime() - 24 * 60 * 60 * 1000);
  }
  return boundary;
}

export function resolveLaneForUnread(
  firstSeenAt: Date,
  now: Date,
  dayBoundaryHour: number,
  timezone = "Asia/Tokyo"
): UserLane {
  const boundary = laneBoundaryDate(now, dayBoundaryHour, timezone);
  return firstSeenAt >= boundary ? "today" : "stack";
}

export function transitionStateToLane(state: ReleaseState): UserLane {
  if (state === "read") {
    return "archived";
  }
  if (state === "snoozed") {
    return "weekend";
  }
  return "stack";
}

export function nextStateForAction(action: "open" | "read" | "unread" | "snooze"): ReleaseState {
  switch (action) {
    case "open":
      return "opened";
    case "read":
      return "read";
    case "unread":
      return "unread";
    case "snooze":
      return "snoozed";
  }
}

export function shouldCreateUnreadState(params: {
  followedAt: Date;
  firstSeenAt: Date;
  followFromStart?: boolean;
  semanticKind: SemanticKind;
}) {
  if (params.semanticKind === "announcement" || params.semanticKind === "promotion") {
    return false;
  }
  if (params.followFromStart) {
    return true;
  }
  return params.firstSeenAt >= params.followedAt;
}
