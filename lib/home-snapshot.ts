import { prisma } from "@/lib/db/prisma";
import type { SharedHomeDiscoverItem, SharedHomeFeedItem, SharedHomeSnapshot } from "@/lib/types";
import { calendarDayStartDate } from "@/lib/state";
import { getDefaultSettings } from "@/lib/settings";
import {
  extractAccessMeta,
  extractPreviewThumbnailUrl,
  extractThumbnailUrl,
  extractWorkMeta,
  extractWorkThumbnailUrl,
  isExcludedUrl,
  isGenericContentTitle,
  normalizeWhitespace,
  pickThumbnailUrl,
  safeJsonParse,
  titleLooksLikeEpisode
} from "@/lib/utils";

const SHARED_HOME_SNAPSHOT_KEY = "sharedHomeSnapshotV3";

type SnapshotReleaseLike = {
  id: string;
  siteId: string;
  canonicalUrl: string;
  title: string | null;
  semanticKind: string;
  sourceType: string;
  contentKind: string;
  publishedAt: Date | null;
  firstSeenAt: Date;
  extraJson?: string | null;
  workId?: string | null;
  work?: {
    id: string;
    title: string;
    authors: string;
    releases?: Array<{ extraJson?: string | null }>;
  } | null;
};

type SerializedSharedHomeSnapshot = {
  timezone: string;
  builtAt: string;
  lastSyncedAt: string | null;
  hiddenCount: number;
  hiddenBreakdown: {
    promotion: number;
    announcement: number;
  };
  todayFeed: Array<Omit<SharedHomeFeedItem, "publishedAt" | "firstSeenAt"> & { publishedAt: string | null; firstSeenAt: string }>;
  recentMainFeed: Array<Omit<SharedHomeFeedItem, "publishedAt" | "firstSeenAt"> & { publishedAt: string | null; firstSeenAt: string }>;
  discover: Array<Omit<SharedHomeDiscoverItem, "publishedAt" | "firstSeenAt"> & { publishedAt: string | null; firstSeenAt: string }>;
};

export async function getSharedHomeSnapshot() {
  const settings = getDefaultSettings();
  const row = await prisma.appSetting.findUnique({
    where: { key: SHARED_HOME_SNAPSHOT_KEY }
  });

  if (!row) {
    return rebuildSharedHomeSnapshot();
  }

  const parsed = parseSharedHomeSnapshot(row.value);
  if (!parsed || parsed.timezone !== settings.timezone) {
    return rebuildSharedHomeSnapshot();
  }

  const calendarDayStart = calendarDayStartDate(new Date(), settings.timezone);
  if (parsed.builtAt < calendarDayStart) {
    return rebuildSharedHomeSnapshot();
  }

  const latestFinishedSyncRun = await prisma.syncRun.findFirst({
    where: {
      status: "success",
      finishedAt: { not: null }
    },
    orderBy: { finishedAt: "desc" }
  });
  if (latestFinishedSyncRun?.finishedAt && latestFinishedSyncRun.finishedAt > parsed.builtAt) {
    return rebuildSharedHomeSnapshot();
  }

  return parsed;
}

export async function rebuildSharedHomeSnapshot() {
  const settings = getDefaultSettings();
  const calendarDayStart = calendarDayStartDate(new Date(), settings.timezone);
  const nextCalendarDayStart = new Date(calendarDayStart.getTime() + 24 * 60 * 60 * 1000);
  const discoverWindowStart = new Date(calendarDayStart.getTime() - Math.max(settings.discoverWindowDays - 1, 0) * 24 * 60 * 60 * 1000);
  const recentWindowStart = new Date(calendarDayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

  const [latestSyncRun, todayReleases, recentMainReleases, discoverReleases] = await Promise.all([
    prisma.syncRun.findFirst({
      orderBy: { startedAt: "desc" }
    }),
    prisma.release.findMany({
      where: {
        semanticKind: { in: ["main_episode", "side_story", "illustration", "hiatus_illustration", "promotion"] },
        contentKind: "episode",
        OR: [
          {
            sourceType: { in: ["rss", "work_page"] },
            publishedAt: { gte: calendarDayStart, lt: nextCalendarDayStart }
          }
        ]
      },
      include: {
        work: {
          include: {
            releases: {
              where: {
                OR: [
                  { extraJson: { contains: "thumbnailUrl" } },
                  { extraJson: { contains: "workThumbnailUrl" } }
                ]
              },
              orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
              take: 1
            }
          }
        }
      },
      orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
      take: 320
    }),
    prisma.release.findMany({
      where: {
        semanticKind: "main_episode",
        contentKind: "episode",
        sourceType: { in: ["rss", "work_page"] },
        publishedAt: { gte: recentWindowStart, lt: calendarDayStart }
      },
      include: {
        work: {
          include: {
            releases: {
              where: {
                OR: [
                  { extraJson: { contains: "thumbnailUrl" } },
                  { extraJson: { contains: "workThumbnailUrl" } }
                ]
              },
              orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
              take: 1
            }
          }
        }
      },
      orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
      take: 240
    }),
    prisma.release.findMany({
      where: {
        semanticKind: { in: ["oneshot_discovery", "announcement"] },
        OR: [
          {
            publishedAt: { gte: discoverWindowStart, lt: nextCalendarDayStart }
          },
          {
            publishedAt: null,
            semanticKind: "oneshot_discovery",
            contentKind: "work",
            sourceType: { in: ["oneshot_list", "category_list"] },
            firstSeenAt: { gte: discoverWindowStart, lt: nextCalendarDayStart }
          }
        ]
      },
      include: {
        work: {
          include: {
            releases: {
              where: {
                OR: [
                  { extraJson: { contains: "thumbnailUrl" } },
                  { extraJson: { contains: "workThumbnailUrl" } }
                ]
              },
              orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
              take: 1
            }
          }
        }
      },
      orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
      take: 50
    })
  ]);

  const filteredToday = todayReleases.filter((item) => shouldDisplayTodayRelease(item, calendarDayStart, nextCalendarDayStart));
  const filteredRecent = recentMainReleases.filter((item) => shouldDisplayRecentMainRelease(item));
  const filteredDiscover = discoverReleases.filter((item) =>
    shouldDisplayDiscoverRelease(item, discoverWindowStart, nextCalendarDayStart)
  );

  const snapshot: SharedHomeSnapshot = {
    timezone: settings.timezone,
    builtAt: new Date(),
    lastSyncedAt: latestSyncRun?.startedAt ?? null,
    hiddenCount: filteredToday.filter((row) => ["promotion", "announcement"].includes(row.semanticKind)).length,
    hiddenBreakdown: filteredToday.reduce(
      (acc, row) => {
        if (row.semanticKind === "promotion") {
          acc.promotion += 1;
        }
        if (row.semanticKind === "announcement") {
          acc.announcement += 1;
        }
        return acc;
      },
      { promotion: 0, announcement: 0 }
    ),
    todayFeed: collapseFeedReleasesByWork(filteredToday).map(toSharedFeedItem),
    recentMainFeed: collapseFeedReleasesByWork(filteredRecent).map(toSharedFeedItem),
    discover: filteredDiscover.map(toSharedDiscoverItem)
  };

  await prisma.appSetting.upsert({
    where: { key: SHARED_HOME_SNAPSHOT_KEY },
    update: { value: JSON.stringify(serializeSharedHomeSnapshot(snapshot)) },
    create: { key: SHARED_HOME_SNAPSHOT_KEY, value: JSON.stringify(serializeSharedHomeSnapshot(snapshot)) }
  });

  return snapshot;
}

function serializeSharedHomeSnapshot(snapshot: SharedHomeSnapshot): SerializedSharedHomeSnapshot {
  return {
    timezone: snapshot.timezone,
    builtAt: snapshot.builtAt.toISOString(),
    lastSyncedAt: snapshot.lastSyncedAt?.toISOString() ?? null,
    hiddenCount: snapshot.hiddenCount,
    hiddenBreakdown: snapshot.hiddenBreakdown,
    todayFeed: snapshot.todayFeed.map(serializeFeedItem),
    recentMainFeed: snapshot.recentMainFeed.map(serializeFeedItem),
    discover: snapshot.discover.map((item) => ({
      ...item,
      publishedAt: item.publishedAt?.toISOString() ?? null,
      firstSeenAt: item.firstSeenAt.toISOString()
    }))
  };
}

function parseSharedHomeSnapshot(value: string): SharedHomeSnapshot | null {
  try {
    const parsed = JSON.parse(value) as SerializedSharedHomeSnapshot;
    return {
      timezone: parsed.timezone,
      builtAt: new Date(parsed.builtAt),
      lastSyncedAt: parsed.lastSyncedAt ? new Date(parsed.lastSyncedAt) : null,
      hiddenCount: parsed.hiddenCount,
      hiddenBreakdown: parsed.hiddenBreakdown,
      todayFeed: parsed.todayFeed.map(parseFeedItem),
      recentMainFeed: parsed.recentMainFeed.map(parseFeedItem),
      discover: parsed.discover.map((item) => ({
        ...item,
        publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
        firstSeenAt: new Date(item.firstSeenAt)
      }))
    };
  } catch {
    return null;
  }
}

function serializeFeedItem(item: SharedHomeFeedItem) {
  return {
    ...item,
    publishedAt: item.publishedAt?.toISOString() ?? null,
    firstSeenAt: item.firstSeenAt.toISOString()
  };
}

function parseFeedItem(item: ReturnType<typeof serializeFeedItem>): SharedHomeFeedItem {
  return {
    ...item,
    publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
    firstSeenAt: new Date(item.firstSeenAt)
  };
}

function collapseFeedReleasesByWork(items: SnapshotReleaseLike[]) {
  const bestByKey = new Map<string, SnapshotReleaseLike>();

  for (const item of items) {
    const workMeta = extractWorkMeta(item.extraJson);
    const workTitle = normalizeWhitespace(
      item.work?.title && !isGenericContentTitle(item.work.title)
        ? item.work.title
        : workMeta.workTitle ?? item.title ?? ""
    );
    const key = item.work?.id
      ? `${item.siteId}::${item.work.id}`
      : `${item.siteId}::${workTitle || item.id}`;
    const existing = bestByKey.get(key);
    if (!existing) {
      bestByKey.set(key, item);
      continue;
    }

    const existingAt = resolveFeedDate(existing).getTime();
    const currentAt = resolveFeedDate(item).getTime();
    if (currentAt > existingAt || (currentAt === existingAt && item.firstSeenAt > existing.firstSeenAt)) {
      bestByKey.set(key, item);
    }
  }

  return [...bestByKey.values()];
}

function toSharedFeedItem(item: SnapshotReleaseLike): SharedHomeFeedItem {
  const workMeta = extractWorkMeta(item.extraJson);
  const title =
    item.work?.title && !isGenericContentTitle(item.work.title)
      ? item.work.title
      : workMeta.workTitle ?? item.title ?? "タイトル不明";
  const workThumb = pickThumbnailUrl(
    extractPreviewThumbnailUrl(item.extraJson),
    extractWorkThumbnailUrl(item.extraJson),
    extractThumbnailUrl(item.work?.releases?.[0]?.extraJson),
    extractWorkThumbnailUrl(item.work?.releases?.[0]?.extraJson)
  );
  const releaseThumb = pickThumbnailUrl(
    extractThumbnailUrl(item.extraJson),
    extractThumbnailUrl(item.work?.releases?.[0]?.extraJson)
  );
  const primary = pickThumbnailUrl(workThumb, releaseThumb);
  const secondary = pickThumbnailUrl(
    releaseThumb && releaseThumb !== primary ? releaseThumb : undefined,
    workThumb && workThumb !== primary ? workThumb : undefined
  );

  return {
    workKey: item.work?.id ? `${item.siteId}::${item.work.id}` : `${item.siteId}::${title}`,
    workId: item.work?.id ?? null,
    openReleaseId: item.id,
    openUrl: item.canonicalUrl,
    siteId: item.siteId,
    title,
    authors: item.work?.authors ?? JSON.stringify(workMeta.authors),
    semanticKind: item.semanticKind,
    publishedAt: item.publishedAt,
    firstSeenAt: item.firstSeenAt,
    previewThumbnailUrl: pickThumbnailUrl(
      extractPreviewThumbnailUrl(item.extraJson),
      extractPreviewThumbnailUrl(item.work?.releases?.[0]?.extraJson)
    ) ?? null,
    thumbnailUrl: primary ?? null,
    secondaryThumbnailUrl: secondary ?? null,
    isPaidOnly: extractAccessMeta(item.extraJson).isPaidOnly
  };
}

function toSharedDiscoverItem(item: SnapshotReleaseLike): SharedHomeDiscoverItem {
  const workMeta = extractWorkMeta(item.extraJson);
  const title =
    item.work?.title && !isGenericContentTitle(item.work.title)
      ? item.work.title
      : workMeta.workTitle ?? item.title ?? "タイトル不明";
  const thumbnailUrl = pickThumbnailUrl(
    extractPreviewThumbnailUrl(item.extraJson),
    extractPreviewThumbnailUrl(item.work?.releases?.[0]?.extraJson)
  );

  return {
    id: item.id,
    workId: item.work?.id ?? null,
    canonicalUrl: item.canonicalUrl,
    siteId: item.siteId,
    title,
    authors: item.work?.authors ?? JSON.stringify(workMeta.authors),
    semanticKind: item.semanticKind,
    publishedAt: item.publishedAt,
    firstSeenAt: item.firstSeenAt,
    previewThumbnailUrl: thumbnailUrl ?? null,
    thumbnailUrl: thumbnailUrl ?? null,
    isPaidOnly: extractAccessMeta(item.extraJson).isPaidOnly
  };
}

function shouldDisplayTodayRelease(item: SnapshotReleaseLike, calendarDayStart: Date, nextCalendarDayStart: Date) {
  if (!shouldDisplayRelease(item)) {
    return false;
  }

  if (item.contentKind !== "episode") {
    return false;
  }

  if (!["rss", "work_page"].includes(item.sourceType)) {
    return false;
  }

  if (item.semanticKind === "announcement" || item.semanticKind === "oneshot_discovery") {
    return false;
  }

  if (!item.publishedAt) {
    return false;
  }

  const effectiveDate = resolveFeedDate(item);
  return effectiveDate >= calendarDayStart && effectiveDate < nextCalendarDayStart;
}

function shouldDisplayRecentMainRelease(item: SnapshotReleaseLike) {
  return shouldDisplayRelease(item) && item.contentKind === "episode" && item.semanticKind === "main_episode" && ["rss", "work_page"].includes(item.sourceType);
}

function shouldDisplayDiscoverRelease(item: SnapshotReleaseLike, discoverWindowStart: Date, nextCalendarDayStart: Date) {
  if (!shouldDisplayRelease(item)) {
    return false;
  }

  if (item.semanticKind === "oneshot_discovery" && titleLooksLikeEpisode(item.title ?? "")) {
    return false;
  }

  const effectiveDate = resolveDiscoverDate(item);
  if (!effectiveDate) {
    return false;
  }
  return Boolean(item.canonicalUrl) && effectiveDate >= discoverWindowStart && effectiveDate < nextCalendarDayStart;
}

function shouldDisplayRelease(item: Pick<SnapshotReleaseLike, "canonicalUrl" | "title" | "extraJson" | "work">) {
  if (isExcludedUrl(item.canonicalUrl)) {
    return false;
  }

  const workTitle = item.work?.title ?? "";
  const releaseTitle = item.title ?? "";
  const workMeta = extractWorkMeta(item.extraJson);
  if (workTitle && isGenericContentTitle(workTitle) && titleLooksLikeEpisode(releaseTitle)) {
    return false;
  }

  return Boolean(
    (workTitle && !isGenericContentTitle(workTitle)) ||
      (releaseTitle && !isGenericContentTitle(releaseTitle)) ||
      workMeta.workTitle
  );
}

function resolveFeedDate(item: Pick<SnapshotReleaseLike, "publishedAt" | "firstSeenAt">, now = new Date()) {
  if (item.publishedAt) {
    const oneDayAhead = now.getTime() + 24 * 60 * 60 * 1000;
    if (item.publishedAt.getTime() <= oneDayAhead) {
      return item.publishedAt;
    }
  }
  return item.firstSeenAt;
}

function resolveDiscoverDate(item: Pick<SnapshotReleaseLike, "publishedAt" | "firstSeenAt" | "contentKind" | "sourceType" | "semanticKind">) {
  if (item.publishedAt) {
    return item.publishedAt;
  }

  // Work/category lists without official dates are catalogue discovery. Keep them discoverable,
  // but do not let undated episode/article backfills masquerade as new releases.
  if (
    item.semanticKind === "oneshot_discovery" &&
    item.contentKind === "work" &&
    ["oneshot_list", "category_list"].includes(item.sourceType)
  ) {
    return item.firstSeenAt;
  }

  return null;
}
