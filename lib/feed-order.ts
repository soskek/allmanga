import { siteLabels, siteShortLabels } from "@/lib/domain";

type FeedOrderItem = {
  followed?: boolean;
  siteId: string;
  publishedAt: Date | null;
  firstSeenAt: Date;
};

export function sortFeedByUserSiteOrder<T extends FeedOrderItem>(items: T[], siteOrder: string[]) {
  const siteOrderIndex = new Map<string, number>(siteOrder.map((siteId, index) => [siteId, index]));
  return [...items].sort((left, right) => {
    const leftFollowed = left.followed ? 1 : 0;
    const rightFollowed = right.followed ? 1 : 0;
    if (leftFollowed !== rightFollowed) {
      return rightFollowed - leftFollowed;
    }

    const leftIndex = siteOrderIndex.get(left.siteId) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = siteOrderIndex.get(right.siteId) ?? Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    const leftAt = (left.publishedAt ?? left.firstSeenAt).getTime();
    const rightAt = (right.publishedAt ?? right.firstSeenAt).getTime();
    if (leftAt !== rightAt) {
      return rightAt - leftAt;
    }

    return (siteShortLabels[left.siteId] ?? siteLabels[left.siteId] ?? left.siteId).localeCompare(
      siteShortLabels[right.siteId] ?? siteLabels[right.siteId] ?? right.siteId,
      "ja"
    );
  });
}

export function sortFeedByDateThenSite<T extends FeedOrderItem>(items: T[], siteOrder: string[], timezone: string) {
  const siteOrderIndex = new Map<string, number>(siteOrder.map((siteId, index) => [siteId, index]));
  return [...items].sort((left, right) => {
    const leftDateKey = feedDateKey(left.publishedAt ?? left.firstSeenAt, timezone);
    const rightDateKey = feedDateKey(right.publishedAt ?? right.firstSeenAt, timezone);
    if (leftDateKey !== rightDateKey) {
      return rightDateKey.localeCompare(leftDateKey);
    }

    const leftIndex = siteOrderIndex.get(left.siteId) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = siteOrderIndex.get(right.siteId) ?? Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    const leftAt = (left.publishedAt ?? left.firstSeenAt).getTime();
    const rightAt = (right.publishedAt ?? right.firstSeenAt).getTime();
    if (leftAt !== rightAt) {
      return rightAt - leftAt;
    }

    const leftFollowed = left.followed ? 1 : 0;
    const rightFollowed = right.followed ? 1 : 0;
    if (leftFollowed !== rightFollowed) {
      return rightFollowed - leftFollowed;
    }

    return siteLabel(left.siteId).localeCompare(siteLabel(right.siteId), "ja");
  });
}

export function groupFeedByDate<T extends FeedOrderItem>(items: T[], timezone: string) {
  const groups: Array<{ key: string; label: string; items: T[] }> = [];
  for (const item of items) {
    const date = item.publishedAt ?? item.firstSeenAt;
    const key = feedDateKey(date, timezone);
    const existing = groups.at(-1);
    if (existing?.key === key) {
      existing.items.push(item);
      continue;
    }
    groups.push({
      key,
      label: formatFeedDateLabel(date, timezone),
      items: [item]
    });
  }
  return groups;
}

function feedDateKey(date: Date, timezone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatFeedDateLabel(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: timezone,
    month: "numeric",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function siteLabel(siteId: string) {
  return siteShortLabels[siteId] ?? siteLabels[siteId] ?? siteId;
}
