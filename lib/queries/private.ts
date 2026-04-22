import { prisma } from "@/lib/db/prisma";
import { requireSessionUserId } from "@/lib/auth/session";
import { getSharedHomeSnapshot } from "@/lib/home-snapshot";
import { getSettings } from "@/lib/settings";
import { calendarDayStartDate } from "@/lib/state";
import { ensureSitesSeeded } from "@/lib/sync";
import { aggregateWorkCards } from "@/lib/work-card";
import type { HomeFeedWorkItem } from "@/lib/types";
import { siteDisplayOrder } from "@/lib/domain";
import {
  buildSearchableText,
  canonicalizeUrl,
  extractThumbnailUrl,
  extractAccessMeta,
  extractPreviewThumbnailUrl,
  extractWorkThumbnailUrl,
  extractWorkMeta,
  isExcludedUrl,
  isGenericContentTitle,
  normalizeWhitespace,
  pickThumbnailUrl,
  safeJsonParse,
  titleLooksLikeEpisode
} from "@/lib/utils";

type ThumbnailReleaseLike = {
  id: string;
  siteId: string;
  canonicalUrl: string;
  title: string | null;
  sourceType?: string;
  contentKind?: string;
  semanticKind?: string;
  extraJson?: string | null;
  work?: {
    title: string;
    canonicalUrl?: string;
    releases?: Array<{ extraJson?: string | null }>;
  } | null;
};

export async function getHomeView() {
  const userId = await requireSessionUserId();
  await ensureSitesSeeded();
  const settings = await getSettings(userId);
  const sharedSnapshot = await getSharedHomeSnapshot();
  const calendarDayStart = calendarDayStartDate(new Date(), settings.timezone);
  const nextCalendarDayStart = new Date(calendarDayStart.getTime() + 24 * 60 * 60 * 1000);
  const releaseInclude = {
    release: {
      include: {
        work: {
          include: {
            prefs: {
              where: { userId }
            },
            releases: {
              where: {
                extraJson: {
                  contains: "thumbnailUrl"
                }
              },
              orderBy: [{ publishedAt: "desc" as const }, { firstSeenAt: "desc" as const }],
              take: 1
            }
          }
        },
        site: true
      }
    }
  };
  const [rows, todayReadRows, followedWorkCount, totalWorkCount] = await Promise.all([
    prisma.userReleaseState.findMany({
      where: {
        userId,
        state: { in: ["unread", "opened", "snoozed"] }
      },
      include: releaseInclude
    }),
    prisma.userReleaseState.findMany({
      where: {
        userId,
        state: "read",
        readAt: {
          gte: calendarDayStart,
          lt: nextCalendarDayStart
        },
        release: {
          semanticKind: "main_episode",
          work: {
            prefs: {
              some: {
                userId,
                follow: true,
                mute: false
              }
            }
          }
        }
      },
      include: releaseInclude,
      orderBy: [{ readAt: "desc" }],
      take: 48
    }),
    prisma.userWorkPref.count({
      where: {
        userId,
        follow: true,
        mute: false
      }
    }),
    prisma.work.count()
  ]);

  const resolvedStackReleases = await attachResolvedThumbnails(rows.map((row) => row.release), { allowRemoteRefetch: true });
  const resolvedStackById = new Map(resolvedStackReleases.map((release) => [release.id, release]));

  const workRows = rows
    .filter((row) => row.release.work && row.release.work.prefs[0]?.follow && !row.release.work.prefs[0]?.mute)
    .map((row) => {
      const resolvedRelease = resolvedStackById.get(row.release.id) ?? row.release;
      return {
        workId: row.release.work!.id,
        title:
          !isGenericContentTitle(row.release.work!.title)
            ? row.release.work!.title
            : extractWorkMeta(row.release.extraJson).workTitle ?? row.release.title ?? "タイトル不明",
        canonicalUrl: row.release.work!.canonicalUrl,
        releaseCanonicalUrl: row.release.canonicalUrl,
        siteId: row.release.siteId,
        authors: row.release.work!.authors,
        previewThumbnailUrl: pickThumbnailUrl(
          extractPreviewThumbnailUrl(resolvedRelease.extraJson),
          extractPreviewThumbnailUrl(row.release.work!.releases[0]?.extraJson)
        ),
        workThumbnailUrl: pickThumbnailUrl(
          (resolvedRelease as { resolvedThumbnailUrl?: string | null }).resolvedThumbnailUrl,
          extractWorkThumbnailUrl(resolvedRelease.extraJson),
          extractThumbnailUrl(row.release.work!.releases[0]?.extraJson),
          extractWorkThumbnailUrl(row.release.work!.releases[0]?.extraJson)
        ),
        releaseThumbnailUrl: pickThumbnailUrl(
          (resolvedRelease as { resolvedSecondaryThumbnailUrl?: string | null }).resolvedSecondaryThumbnailUrl,
          extractThumbnailUrl(resolvedRelease.extraJson),
          extractThumbnailUrl(row.release.work!.releases[0]?.extraJson)
        ),
        pin: row.release.work!.prefs[0]?.pin,
        priority: row.release.work!.prefs[0]?.priority,
        releaseId: row.release.id,
        semanticKind: row.overrideKind ?? row.release.semanticKind,
        state: row.state,
        lane: row.lane,
        publishedAt: row.release.publishedAt,
        firstSeenAt: row.release.firstSeenAt
      };
    });

  const unreadStack = sortWorkCardsForHome(
    aggregateWorkCards(workRows.filter((row) => row.lane === "stack" || row.lane === "today")),
    settings.siteOrder
  );
  const resolvedTodayReadReleases = await attachResolvedThumbnails(todayReadRows.map((row) => row.release), { allowRemoteRefetch: false });
  const resolvedTodayReadById = new Map(resolvedTodayReadReleases.map((release) => [release.id, release]));
  const todayReadFeed = todayReadRows
    .filter((row) => row.release.work && row.release.work.prefs[0]?.follow && !row.release.work.prefs[0]?.mute)
    .map((row) => {
      const resolvedRelease = resolvedTodayReadById.get(row.release.id) ?? row.release;
      const workMeta = extractWorkMeta(row.release.extraJson);
      const title =
        row.release.work?.title && !isGenericContentTitle(row.release.work.title)
          ? row.release.work.title
          : workMeta.workTitle ?? row.release.title ?? "タイトル不明";
      const releaseThumb = pickThumbnailUrl(
        (resolvedRelease as { resolvedSecondaryThumbnailUrl?: string | null }).resolvedSecondaryThumbnailUrl,
        extractThumbnailUrl(resolvedRelease.extraJson),
        extractThumbnailUrl(row.release.work?.releases[0]?.extraJson)
      );
      const workThumb = pickThumbnailUrl(
        (resolvedRelease as { resolvedThumbnailUrl?: string | null }).resolvedThumbnailUrl,
        extractWorkThumbnailUrl(resolvedRelease.extraJson),
        extractWorkThumbnailUrl(row.release.work?.releases[0]?.extraJson)
      );
      return {
        workKey: row.release.work?.id ? `${row.release.siteId}::${row.release.work.id}` : `${row.release.siteId}::${title}`,
        workId: row.release.work?.id ?? null,
        openReleaseId: row.release.id,
        openUrl: row.release.canonicalUrl,
        siteId: row.release.siteId,
        title,
        authors: row.release.work?.authors ?? JSON.stringify(workMeta.authors),
        semanticKind: row.overrideKind ?? row.release.semanticKind,
        publishedAt: row.release.publishedAt,
        firstSeenAt: row.release.firstSeenAt,
        previewThumbnailUrl: extractPreviewThumbnailUrl(resolvedRelease.extraJson) ?? null,
        thumbnailUrl: pickThumbnailUrl(workThumb, releaseThumb) ?? null,
        secondaryThumbnailUrl: releaseThumb ?? null,
        followed: true,
        isPaidOnly: extractAccessMeta(row.release.extraJson).isPaidOnly,
        followWorkId: null,
        followReleaseId: null,
        userState: row.state
      };
    });
  const inboxToday = rows
    .filter((row) => row.lane === "today")
    .sort((a, b) => (b.release.publishedAt ?? b.release.firstSeenAt).getTime() - (a.release.publishedAt ?? a.release.firstSeenAt).getTime());
  const visibleWorkIds = [
    ...new Set(
      [...sharedSnapshot.todayFeed, ...sharedSnapshot.recentMainFeed, ...sharedSnapshot.discover]
        .flatMap((item) => (item.workId ? [item.workId] : []))
    )
  ];
  const visiblePrefs = visibleWorkIds.length
    ? await prisma.userWorkPref.findMany({
        where: {
          userId,
          workId: {
            in: visibleWorkIds
          }
        }
      })
    : [];
  const prefByWorkId = new Map(visiblePrefs.map((pref) => [pref.workId, pref]));
  const todayFeed = sharedSnapshot.todayFeed.map((item) => {
    const pref = item.workId ? prefByWorkId.get(item.workId) : null;
    const followed = Boolean(pref?.follow && !pref?.mute);
    return {
      ...item,
      followed,
      followWorkId: !followed && item.workId ? item.workId : null,
      followReleaseId: !item.workId ? item.openReleaseId : null
    };
  });
  const recentMainFeed = sharedSnapshot.recentMainFeed.map((item) => {
    const pref = item.workId ? prefByWorkId.get(item.workId) : null;
    const followed = Boolean(pref?.follow && !pref?.mute);
    return {
      ...item,
      followed,
      followWorkId: !followed && item.workId ? item.workId : null,
      followReleaseId: !item.workId ? item.openReleaseId : null
    };
  });
  const discover = sharedSnapshot.discover.map((item) => {
    const pref = item.workId ? prefByWorkId.get(item.workId) : null;
    const followed = Boolean(pref?.follow && !pref?.mute);
    return {
      ...item,
      followWorkId: !followed && item.workId ? item.workId : null,
      followReleaseId: !item.workId ? item.id : null
    };
  });

  const summary = todayFeed.reduce(
    (acc, row) => {
      if (row.semanticKind === "side_story") {
        acc.sideStory += 1;
      }
      if (row.semanticKind === "illustration" || row.semanticKind === "hiatus_illustration") {
        acc.illustration += 1;
      }
      if (row.semanticKind === "promotion") {
        acc.promotion += 1;
      }
      acc.today += 1;
      return acc;
    },
    {
      unreadMain: workRows.filter((row) => row.semanticKind === "main_episode" && row.state === "unread").length,
      today: 0,
      oneshot: 0,
      announcement: 0,
      sideStory: 0,
      illustration: 0,
      promotion: 0
    }
  );

  return {
    now: new Date(),
    lastSyncedAt: sharedSnapshot.lastSyncedAt,
    settings,
    summary,
    followedWorkCount,
    totalWorkCount,
    unreadStack,
    todayReadFeed,
    inboxToday,
    todayFeed,
    recentMainFeed,
    discover,
    hiddenCount: sharedSnapshot.hiddenCount,
    hiddenBreakdown: sharedSnapshot.hiddenBreakdown
  };
}

function collapseFeedReleasesByWork<
  T extends {
    id: string;
    siteId: string;
    title: string | null;
    extraJson?: string | null;
    publishedAt: Date | null;
    firstSeenAt: Date;
    work?: { id?: string; title: string | null } | null;
  }
>(items: T[]) {
  const bestByKey = new Map<string, T>();

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
    if (currentAt > existingAt) {
      bestByKey.set(key, item);
      continue;
    }
    if (currentAt === existingAt && item.firstSeenAt > existing.firstSeenAt) {
      bestByKey.set(key, item);
    }
  }

  return [...bestByKey.values()];
}

function collapseResolvedReleasesToFeedWorks<
  T extends {
    id: string;
    siteId: string;
    title: string | null;
    canonicalUrl: string;
    semanticKind: string;
    publishedAt: Date | null;
    firstSeenAt: Date;
    extraJson?: string | null;
    resolvedThumbnailUrl?: string | null;
    resolvedSecondaryThumbnailUrl?: string | null;
    work?: {
      id?: string;
      title: string;
      authors: string;
      prefs?: Array<{ follow: boolean }>;
    } | null;
  }
>(items: T[], options: { includeSecondary: boolean }): HomeFeedWorkItem[] {
  return items.map((item) => {
    const workMeta = extractWorkMeta(item.extraJson);
    const title =
      item.work?.title && !isGenericContentTitle(item.work.title)
        ? item.work.title
        : workMeta.workTitle ?? item.title ?? "タイトル不明";
    const workKey = item.work?.id ? `${item.siteId}::${item.work.id}` : `${item.siteId}::${title}`;
    const followed = Boolean(item.work?.prefs?.[0]?.follow);

    return {
      workKey,
      workId: item.work?.id ?? null,
      openReleaseId: item.id,
      openUrl: item.canonicalUrl,
      siteId: item.siteId,
      title,
      authors: item.work?.authors ?? JSON.stringify(workMeta.authors),
      semanticKind: item.semanticKind,
      publishedAt: item.publishedAt,
      firstSeenAt: item.firstSeenAt,
      previewThumbnailUrl: pickThumbnailUrl(extractPreviewThumbnailUrl(item.extraJson)) ?? null,
      thumbnailUrl: item.resolvedThumbnailUrl ?? null,
      secondaryThumbnailUrl: options.includeSecondary ? item.resolvedSecondaryThumbnailUrl ?? null : null,
      followed,
      isPaidOnly: extractAccessMeta(item.extraJson).isPaidOnly,
      followWorkId: !followed && item.work?.id ? item.work.id : null,
      followReleaseId: !item.work ? item.id : null
    };
  });
}

function sortWorkCardsForHome<
  T extends {
    pin: boolean;
    priority: number;
    siteId: string;
    newestUnreadAt: Date | null;
    title: string;
  }
>(items: T[], siteOrder: string[]) {
  const siteOrderIndex = new Map(siteOrder.map((siteId, index) => [siteId, index]));

  return [...items].sort((left, right) => {
    if (left.pin !== right.pin) {
      return left.pin ? -1 : 1;
    }

    const leftSiteIndex = siteOrderIndex.get(left.siteId) ?? Number.MAX_SAFE_INTEGER;
    const rightSiteIndex = siteOrderIndex.get(right.siteId) ?? Number.MAX_SAFE_INTEGER;
    if (leftSiteIndex !== rightSiteIndex) {
      return leftSiteIndex - rightSiteIndex;
    }

    if (left.priority !== right.priority) {
      return right.priority - left.priority;
    }

    const leftAt = left.newestUnreadAt?.getTime() ?? 0;
    const rightAt = right.newestUnreadAt?.getTime() ?? 0;
    if (leftAt !== rightAt) {
      return rightAt - leftAt;
    }

    return left.title.localeCompare(right.title, "ja");
  });
}

export async function getDiscoverView() {
  const userId = await requireSessionUserId();
  const settings = await getSettings(userId);
  const calendarDayStart = calendarDayStartDate(new Date(), settings.timezone);
  const nextCalendarDayStart = new Date(calendarDayStart.getTime() + 24 * 60 * 60 * 1000);
  const discoverWindowStart = new Date(calendarDayStart.getTime() - Math.max(settings.discoverWindowDays - 1, 0) * 24 * 60 * 60 * 1000);
  const items = await prisma.release.findMany({
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
          prefs: {
            where: { userId }
          },
          releases: {
            where: {
              extraJson: {
                contains: "thumbnailUrl"
              }
            },
            orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
            take: 1
          }
        }
      },
      site: true
    },
    orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
    take: 200
  });
  const visibleItems = items
    .filter((item) => shouldDisplayDiscoverRelease(item, discoverWindowStart, nextCalendarDayStart))
    .sort(sortDiscoverReleaseForDisplay)
    .slice(0, 100);

  return filterBrokenDiscoverItems(
    await attachResolvedThumbnails(
      visibleItems,
      { allowRemoteRefetch: false }
    )
  );
}

export async function getFollowedTimelineView() {
  const userId = await requireSessionUserId();
  const settings = await getSettings(userId);
  const prefs = await prisma.userWorkPref.findMany({
    where: {
      userId,
      follow: true,
      mute: false
    },
    select: {
      workId: true
    }
  });
  const workIds = prefs.map((pref) => pref.workId);
  if (!workIds.length) {
    return {
      settings,
      items: []
    };
  }

  const releases = await prisma.release.findMany({
    where: {
      workId: { in: workIds },
      semanticKind: "main_episode",
      contentKind: "episode",
      sourceType: { in: ["rss", "work_page"] }
    },
    include: {
      userStates: {
        where: { userId },
        take: 1
      },
      work: {
        include: {
          releases: {
            where: {
              extraJson: {
                contains: "thumbnailUrl"
              }
            },
            orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
            take: 1
          }
        }
      }
    },
    orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
    take: 240
  });
  const resolvedReleases = await attachResolvedThumbnails(releases, { allowRemoteRefetch: false });
  const resolvedById = new Map(resolvedReleases.map((release) => [release.id, release]));

  return {
    settings,
    items: releases
      .filter((release) => release.work && shouldDisplayRelease(release))
      .map((release) => {
        const resolvedRelease = resolvedById.get(release.id) ?? release;
        const workMeta = extractWorkMeta(release.extraJson);
        const title =
          release.work?.title && !isGenericContentTitle(release.work.title)
            ? release.work.title
            : workMeta.workTitle ?? release.title ?? "タイトル不明";
        const releaseThumb = pickThumbnailUrl(
          (resolvedRelease as { resolvedSecondaryThumbnailUrl?: string | null }).resolvedSecondaryThumbnailUrl,
          extractThumbnailUrl(resolvedRelease.extraJson),
          extractThumbnailUrl(release.work?.releases[0]?.extraJson)
        );
        const workThumb = pickThumbnailUrl(
          (resolvedRelease as { resolvedThumbnailUrl?: string | null }).resolvedThumbnailUrl,
          extractPreviewThumbnailUrl(resolvedRelease.extraJson),
          extractWorkThumbnailUrl(resolvedRelease.extraJson),
          extractWorkThumbnailUrl(release.work?.releases[0]?.extraJson)
        );
        const state = release.userStates[0]?.state ?? "unread";
        return {
          workKey: release.work?.id ? `${release.siteId}::${release.work.id}` : `${release.siteId}::${title}`,
          workId: release.work?.id ?? null,
          openReleaseId: release.id,
          openUrl: release.canonicalUrl,
          siteId: release.siteId,
          title,
          authors: release.work?.authors ?? JSON.stringify(workMeta.authors),
          semanticKind: release.userStates[0]?.overrideKind ?? release.semanticKind,
          publishedAt: release.publishedAt,
          firstSeenAt: release.firstSeenAt,
          previewThumbnailUrl: extractPreviewThumbnailUrl(resolvedRelease.extraJson) ?? null,
          thumbnailUrl: pickThumbnailUrl(workThumb, releaseThumb) ?? null,
          secondaryThumbnailUrl: releaseThumb ?? null,
          followed: true,
          isPaidOnly: extractAccessMeta(release.extraJson).isPaidOnly,
          followWorkId: null,
          followReleaseId: null,
          userState: state
        };
      })
  };
}

export async function getLibraryView() {
  const userId = await requireSessionUserId();
  return prisma.userWorkPref.findMany({
    where: {
      userId,
      OR: [{ follow: true }, { pin: true }, { mute: true }, { priority: { gt: 0 } }]
    },
    include: {
      work: {
        include: {
          site: true,
          releases: {
            orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
            take: 5
          }
        }
      }
    },
    orderBy: [{ pin: "desc" }, { priority: "desc" }, { updatedAt: "desc" }]
  });
}

export async function searchLibrary(query: string) {
  const userId = await requireSessionUserId();
  const trimmed = query.trim();
  const maybeCanonicalUrl = looksLikeSearchUrl(trimmed) ? canonicalizeUrl(trimmed) : null;

  const items = await prisma.work.findMany({
    include: {
      site: true,
      releases: {
        orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
        take: 5
      },
      prefs: {
        where: { userId }
      }
    }
  });

  const releaseMatches = maybeCanonicalUrl
    ? await prisma.release.findMany({
        where: {
          canonicalUrl: maybeCanonicalUrl,
          workId: { not: null }
        },
        select: {
          workId: true
        }
      })
    : [];

  const exactWorkIds = new Set<string>([
    ...items.filter((work) => maybeCanonicalUrl && work.canonicalUrl === maybeCanonicalUrl).map((work) => work.id),
    ...releaseMatches.map((release) => release.workId).filter((value): value is string => Boolean(value))
  ]);

  const lowered = trimmed.toLowerCase();
  const filtered = items.filter((work) => {
    if (exactWorkIds.has(work.id)) {
      return true;
    }
    const searchable = buildSearchableText([work.title, safeJsonParse<string[]>(work.authors, []), work.site.name]);
    return searchable.includes(lowered);
  });

  return filtered.sort((left, right) => {
    const leftExact = exactWorkIds.has(left.id) ? 1 : 0;
    const rightExact = exactWorkIds.has(right.id) ? 1 : 0;
    if (leftExact !== rightExact) {
      return rightExact - leftExact;
    }
    const leftFollow = left.prefs[0]?.follow ? 1 : 0;
    const rightFollow = right.prefs[0]?.follow ? 1 : 0;
    if (leftFollow !== rightFollow) {
      return leftFollow - rightFollow;
    }
    return left.title.localeCompare(right.title, "ja");
  });
}

function looksLikeSearchUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function shouldDisplayRelease(item: {
  canonicalUrl: string;
  title: string | null;
  extraJson?: string | null;
  work?: { title: string } | null;
}) {
  if (isExcludedUrl(item.canonicalUrl)) {
    return false;
  }

  const workTitle = item.work?.title ?? "";
  const releaseTitle = item.title ?? "";
  const workMeta = extractWorkMeta(item.extraJson);
  if (looksLikeExcludedNonManga(`${workTitle} ${releaseTitle} ${workMeta.workTitle ?? ""}`)) {
    return false;
  }
  if (workTitle && isGenericContentTitle(workTitle) && titleLooksLikeEpisode(releaseTitle)) {
    return false;
  }

  return Boolean(
    (workTitle && !isGenericContentTitle(workTitle)) ||
      (releaseTitle && !isGenericContentTitle(releaseTitle))
  );
}

function resolveFeedDate(
  item: {
    publishedAt: Date | null;
    firstSeenAt: Date;
  },
  now = new Date()
) {
  if (item.publishedAt) {
    const oneDayAhead = now.getTime() + 24 * 60 * 60 * 1000;
    if (item.publishedAt.getTime() <= oneDayAhead) {
      return item.publishedAt;
    }
  }

  return item.firstSeenAt;
}

function normalizeFeedRelease<T extends { publishedAt: Date | null; firstSeenAt: Date }>(item: T): T {
  return {
    ...item,
    publishedAt: resolveFeedDate(item)
  };
}

function shouldDisplayTodayRelease(
  item: {
    siteId: string;
    canonicalUrl: string;
    title: string | null;
    work?: { title: string } | null;
    semanticKind: string;
    sourceType: string;
    contentKind: string;
    publishedAt: Date | null;
    firstSeenAt: Date;
  },
  calendarDayStart: Date,
  nextCalendarDayStart: Date
) {
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

  if (item.siteId === "mangaone" && !item.publishedAt) {
    return false;
  }

  if (!item.publishedAt) {
    return false;
  }

  const effectiveDate = resolveFeedDate(item);
  return effectiveDate >= calendarDayStart && effectiveDate < nextCalendarDayStart;
}

function shouldDisplayRecentMainRelease(item: {
  canonicalUrl: string;
  title: string | null;
  work?: { title: string } | null;
  sourceType: string;
  contentKind: string;
}) {
  if (!shouldDisplayRelease(item)) {
    return false;
  }

  return item.contentKind === "episode" && ["rss", "work_page"].includes(item.sourceType);
}

function shouldDisplayDiscoverRelease(item: {
  canonicalUrl: string;
  title: string | null;
  semanticKind: string;
  sourceType: string;
  contentKind: string;
  work?: { title: string } | null;
  publishedAt: Date | null;
  firstSeenAt: Date;
}, discoverWindowStart: Date, nextCalendarDayStart: Date) {
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
  return effectiveDate >= discoverWindowStart && effectiveDate < nextCalendarDayStart;
}

function resolveDiscoverDate(item: {
  publishedAt: Date | null;
  firstSeenAt: Date;
  contentKind: string;
  sourceType: string;
  semanticKind: string;
}) {
  if (item.publishedAt) {
    return item.publishedAt;
  }

  if (
    item.semanticKind === "oneshot_discovery" &&
    item.contentKind === "work" &&
    ["oneshot_list", "category_list"].includes(item.sourceType)
  ) {
    return item.firstSeenAt;
  }

  return null;
}

function discoverDisplaySortTime(item: { publishedAt: Date | null }) {
  if (item.publishedAt) {
    return item.publishedAt.getTime();
  }
  return 0;
}

function sortDiscoverReleaseForDisplay(
  left: { publishedAt: Date | null; firstSeenAt: Date; siteId: string },
  right: { publishedAt: Date | null; firstSeenAt: Date; siteId: string }
) {
  if (Boolean(left.publishedAt) !== Boolean(right.publishedAt)) {
    return left.publishedAt ? -1 : 1;
  }
  const byDate = discoverDisplaySortTime(right) - discoverDisplaySortTime(left);
  if (byDate !== 0) {
    return byDate;
  }
  return siteOrderIndex(left.siteId) - siteOrderIndex(right.siteId);
}

function siteOrderIndex(siteId: string) {
  const index = (siteDisplayOrder as readonly string[]).indexOf(siteId);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function isPaidOnlyFeedRelease(item: { extraJson?: string | null }) {
  return extractAccessMeta(item.extraJson).isPaidOnly;
}

function mixReleasesBySite<T extends { siteId: string; publishedAt: Date | null; firstSeenAt: Date }>(items: T[], limit: number) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(item.siteId) ?? [];
    group.push(item);
    groups.set(item.siteId, group);
  }

  for (const group of groups.values()) {
    group.sort((left, right) => {
      const leftAt = resolveFeedDate(left);
      const rightAt = resolveFeedDate(right);
      return rightAt.getTime() - leftAt.getTime();
    });
  }

  const mixed: T[] = [];
  while (mixed.length < limit) {
    const activeGroups = [...groups.entries()]
      .filter(([, group]) => group.length > 0)
      .sort((left, right) => {
        const leftAt = resolveFeedDate(left[1][0]);
        const rightAt = resolveFeedDate(right[1][0]);
        return rightAt.getTime() - leftAt.getTime();
      });

    if (!activeGroups.length) {
      break;
    }

    for (const [, group] of activeGroups) {
      const next = group.shift();
      if (!next) {
        continue;
      }
      mixed.push(next);
      if (mixed.length >= limit) {
        break;
      }
    }
  }

  return mixed;
}

async function attachResolvedThumbnails<T extends ThumbnailReleaseLike>(
  items: T[],
  options?: { allowRemoteRefetch?: boolean }
): Promise<Array<T & { resolvedThumbnailUrl?: string | null; resolvedSecondaryThumbnailUrl?: string | null }>> {
  const lookup = await buildThumbnailLookup(items);
  const allowRemoteRefetch = options?.allowRemoteRefetch ?? false;

  return Promise.all(
    items.map(async (item) => {
      const existingReleaseThumb = extractThumbnailUrl(item.extraJson);
      const existingWorkThumb = extractWorkThumbnailUrl(item.extraJson);
      const fallbackPair =
        allowRemoteRefetch && shouldRefetchDisplayThumbnailPair(item.siteId, existingReleaseThumb, existingWorkThumb)
          ? await fetchDisplayThumbnailPair(item)
          : null;
      const releaseThumb = pickThumbnailUrl(
        fallbackPair?.releaseThumb,
        existingReleaseThumb,
        findReleaseThumbnail(lookup, item.siteId, item.title)
      );
      const workThumb = pickThumbnailUrl(
        fallbackPair?.workThumb,
        existingWorkThumb,
        findWorkThumbnail(
          lookup,
          item.siteId,
          item.work?.title ?? extractWorkMeta(item.extraJson).workTitle ?? null,
          item.semanticKind,
          item.sourceType
        ),
        extractThumbnailUrl(item.work?.releases?.[0]?.extraJson)
      );
      const resolvedThumbnailUrl = pickThumbnailUrl(workThumb, releaseThumb);
      const resolvedSecondaryThumbnailUrl = pickThumbnailUrl(
        releaseThumb && releaseThumb !== resolvedThumbnailUrl ? releaseThumb : undefined,
        workThumb && workThumb !== resolvedThumbnailUrl ? workThumb : undefined
      );

      return {
        ...item,
        resolvedThumbnailUrl,
        resolvedSecondaryThumbnailUrl
      };
    })
  );
}

function shouldRefetchDisplayThumbnailPair(
  siteId: string,
  existingReleaseThumb?: string | null,
  existingWorkThumb?: string | null
) {
  if (!existingReleaseThumb || !existingWorkThumb || existingReleaseThumb === existingWorkThumb) {
    return true;
  }

  if (siteId === "magapoke" && /\/static\/titles\/\d+\/banner_/i.test(existingReleaseThumb)) {
    return true;
  }

  if (siteId === "younganimal" && /\/series\//i.test(existingReleaseThumb)) {
    return true;
  }

  return false;
}

async function attachInferredWorks<
  T extends {
    siteId: string;
    title: string | null;
    extraJson?: string | null;
    work?: ThumbnailReleaseLike["work"] & {
      prefs?: Array<{ follow: boolean; mute: boolean; pin: boolean; priority: number }>;
    } | null;
  }
>(items: T[], userId: string): Promise<T[]> {
  const missing = items.filter((item) => !item.work);
  if (!missing.length) {
    return items;
  }

  const titles = [...new Set(missing.flatMap((item) => {
    const workMeta = extractWorkMeta(item.extraJson);
    const candidates = [workMeta.workTitle, item.title].filter((value): value is string => Boolean(value) && !isGenericContentTitle(value));
    return candidates.map((value) => normalizeWhitespace(value));
  }))];

  if (!titles.length) {
    return items;
  }

  const works = await prisma.work.findMany({
    where: {
      title: {
        in: titles
      }
    },
    include: {
      prefs: {
        where: { userId }
      },
      releases: {
        where: {
          extraJson: {
            contains: "thumbnailUrl"
          }
        },
        orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
        take: 1
      }
    }
  });

  const workBySiteAndTitle = new Map<string, (typeof works)[number]>();
  for (const work of works) {
    const key = `${work.siteId}::${normalizeWhitespace(work.title)}`;
    if (!workBySiteAndTitle.has(key)) {
      workBySiteAndTitle.set(key, work);
    }
  }

  return items.map((item) => {
    if (item.work) {
      return item;
    }
    const workMeta = extractWorkMeta(item.extraJson);
    const titleCandidates = [workMeta.workTitle, item.title]
      .filter((value): value is string => Boolean(value) && !isGenericContentTitle(value))
      .map((value) => normalizeWhitespace(value));

    for (const candidate of titleCandidates) {
      const linkedWork = workBySiteAndTitle.get(`${item.siteId}::${candidate}`);
      if (linkedWork) {
        return {
          ...item,
          work: linkedWork
        };
      }
    }

    return item;
  });
}

const displayThumbnailPairCache = new Map<string, { releaseThumb?: string; workThumb?: string }>();
const displayThumbnailHtmlCache = new Map<string, string | null>();

async function fetchDisplayThumbnailPair(item: ThumbnailReleaseLike) {
  const cacheKey = `${item.siteId}:${item.canonicalUrl}`;
  const cached = displayThumbnailPairCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  if (!["magapoke", "ynjn", "comicdays", "tonarinoyj", "jumpplus", "comicwalker", "yanmaga", "mangaone", "sundaywebry"].includes(item.siteId)) {
    return null;
  }

  try {
    const releaseHtml = await fetchDisplayThumbnailHtml(item.canonicalUrl);
    if (!releaseHtml) {
      return null;
    }
    const releaseThumb = resolveReleaseThumbnailFromPage(item.siteId, releaseHtml);
    let workThumb = resolveWorkThumbnailFromReleasePage(item.siteId, releaseHtml);

    if ((!workThumb || workThumb === releaseThumb) && item.work?.canonicalUrl && item.work.canonicalUrl !== item.canonicalUrl) {
      const workHtml = await fetchDisplayThumbnailHtml(item.work.canonicalUrl);
      if (workHtml) {
        workThumb = pickThumbnailUrl(
          resolveWorkThumbnailFromWorkPage(item.siteId, workHtml),
          workThumb
        );
      }
    }

    const pair = {
      releaseThumb,
      workThumb
    };

    displayThumbnailPairCache.set(cacheKey, pair);
    return pair;
  } catch {
    return null;
  }
}

async function fetchDisplayThumbnailHtml(url: string) {
  if (displayThumbnailHtmlCache.has(url)) {
    return displayThumbnailHtmlCache.get(url) ?? null;
  }

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "AllMangaInbox/0.1 (+self-hosted; metadata-only)"
      },
      next: {
        revalidate: 60 * 60
      }
    });
    if (!response.ok) {
      displayThumbnailHtmlCache.set(url, null);
      return null;
    }

    const html = await response.text();
    displayThumbnailHtmlCache.set(url, html);
    return html;
  } catch {
    displayThumbnailHtmlCache.set(url, null);
    return null;
  }
}

function resolveReleaseThumbnailFromPage(siteId: string, html: string) {
  if (siteId === "magapoke") {
    return pickThumbnailUrl(
      matchAssetUrl(
        html,
        /https:\/\/mgpk-cdn\.magazinepocket\.com\/static\/titles\/\d+\/episodes\/\d+\/thumbnail_[^"' ]+/i
      ),
      matchMetaContent(html, "thumbnail"),
      matchAssetUrl(html, /https:\/\/mgpk-cdn\.magazinepocket\.com\/static\/titles\/[^"' ]*banner[^"' ]+/i)
    );
  }

  if (siteId === "younganimal") {
    return pickThumbnailUrl(
      matchAssetUrl(html, /https:\/\/cdn-public\.comici\.jp\/book\/\d+\/\d+_thumbnail(?:-lg|-sm|-th)?\.webp/i),
      matchMetaContent(html, "twitter:image"),
      matchMetaProperty(html, "og:image")
    );
  }

  return pickThumbnailUrl(
    matchMetaContent(html, "twitter:image"),
    matchMetaProperty(html, "og:image"),
    matchMetaContent(html, "thumbnail")
  );
}

function resolveWorkThumbnailFromReleasePage(siteId: string, html: string) {
  if (siteId === "magapoke") {
    return matchAssetUrl(html, /https:\/\/mgpk-cdn\.magazinepocket\.com\/static\/titles\/[^"' ]*title_grid_wide[^"' ]+/i);
  }

  if (siteId === "ynjn") {
    return pickThumbnailUrl(
      matchAssetUrl(html, /https:\/\/public\.ynjn\.jp\/comic\/[^"' ]+_cover_[^"' ]+\.(jpg|png|webp)/i),
      matchMetaProperty(html, "og:image")
    );
  }

  if (siteId === "younganimal") {
    return pickThumbnailUrl(
      matchAssetUrl(html, /https:\/\/cdn-public\.comici\.jp\/series\/\d+\/[^"' ]+\.(png|webp)/i),
      matchMetaProperty(html, "og:image"),
      matchMetaContent(html, "twitter:image")
    );
  }

  if (["comicdays", "tonarinoyj", "jumpplus", "sundaywebry"].includes(siteId)) {
    return pickThumbnailUrl(matchMetaContent(html, "thumbnail"), matchMetaProperty(html, "og:image"));
  }

  if (siteId === "comicwalker") {
    return pickThumbnailUrl(
      matchJsonUrl(html, /"bookCover":"([^"]+)"/i),
      matchJsonUrl(html, /"originalThumbnail":"([^"]+)"/i),
      matchJsonUrl(html, /"thumbnail":"([^"]+)"/i)
    );
  }

  return undefined;
}

function resolveWorkThumbnailFromWorkPage(siteId: string, html: string) {
  if (siteId === "comicwalker") {
    return pickThumbnailUrl(
      matchJsonUrl(html, /"bookCover":"([^"]+)"/i),
      matchJsonUrl(html, /"originalThumbnail":"([^"]+)"/i),
      matchJsonUrl(html, /"thumbnail":"([^"]+)"/i),
      matchMetaProperty(html, "og:image"),
      matchMetaContent(html, "thumbnail")
    );
  }

  if (siteId === "yanmaga") {
    return pickThumbnailUrl(
      matchHtmlImageByClass(html, "detailv2-thumbnail-image"),
      matchHtmlImageByClass(html, "mod-comic-detail-main-img"),
      matchMetaProperty(html, "og:image"),
      matchMetaContent(html, "thumbnail")
    );
  }

  if (siteId === "ynjn") {
    return pickThumbnailUrl(
      matchAssetUrl(html, /https:\/\/public\.ynjn\.jp\/comic\/[^"' ]+_cover_[^"' ]+\.(jpg|png|webp)/i),
      matchMetaProperty(html, "og:image")
    );
  }

  if (siteId === "younganimal") {
    return pickThumbnailUrl(
      matchAssetUrl(html, /https:\/\/cdn-public\.comici\.jp\/series\/\d+\/[^"' ]+\.(png|webp)/i),
      matchMetaProperty(html, "og:image"),
      matchMetaContent(html, "twitter:image")
    );
  }

  return pickThumbnailUrl(
    matchMetaProperty(html, "og:image"),
    matchMetaContent(html, "thumbnail"),
    matchMetaContent(html, "twitter:image")
  );
}

function matchMetaContent(html: string, name: string) {
  return matchMetaTagContent(html, "name", name);
}

function matchMetaProperty(html: string, property: string) {
  return matchMetaTagContent(html, "property", property);
}

function matchAssetUrl(html: string, pattern: RegExp) {
  return normalizeCandidateUrl(html.match(pattern)?.[0]);
}

function matchMetaTagContent(html: string, attribute: "name" | "property", value: string) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const matcher = new RegExp(`${attribute}=["']${escapeRegExp(value)}["']`, "i");

  for (const tag of metaTags) {
    if (!matcher.test(tag)) {
      continue;
    }

    const contentMatch = tag.match(/content=["']([^"']+)/i);
    if (contentMatch?.[1]) {
      return normalizeCandidateUrl(decodeHtmlAttribute(contentMatch[1]));
    }
  }

  return undefined;
}

function matchJsonUrl(html: string, pattern: RegExp) {
  return normalizeCandidateUrl(decodeHtmlAttribute(html.match(pattern)?.[1]));
}

function matchHtmlImageByClass(html: string, className: string) {
  const pattern = new RegExp(`<[^>]+class=["'][^"']*${escapeRegExp(className)}[^"']*["'][^>]*>[\\s\\S]{0,400}?<img[^>]+src=["']([^"']+)`, "i");
  return normalizeCandidateUrl(decodeHtmlAttribute(html.match(pattern)?.[1]));
}

function normalizeCandidateUrl(url?: string | null) {
  return typeof url === "string" && /^https?:\/\//.test(url) ? url : undefined;
}

function decodeHtmlAttribute(value?: string | null) {
  if (!value) {
    return undefined;
  }

  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/g, "/")
    .replace(/\\u002F/g, "/")
    .replace(/\\\//g, "/");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function filterBrokenDiscoverItems<
  T extends ThumbnailReleaseLike & { canonicalUrl: string; resolvedThumbnailUrl?: string | null; work?: { canonicalUrl?: string | null } | null }
>(items: T[]): T[] {
  return items.filter((item) => Boolean(item.canonicalUrl));
}

async function buildThumbnailLookup(items: ThumbnailReleaseLike[]) {
  const releaseTitles = [
    ...new Set(
      items
        .map((item) => normalizeThumbnailKey(item.title))
        .filter((value): value is string => Boolean(value))
    )
  ];
  const workTitles = [
    ...new Set(
      items
        .map((item) => normalizeThumbnailKey(item.work?.title ?? extractWorkMeta(item.extraJson).workTitle ?? null))
        .filter((value): value is string => Boolean(value))
    )
  ];
  if (!releaseTitles.length && !workTitles.length) {
    return {
      releaseBySiteAndTitle: new Map<string, string>(),
      workBySiteAndTitle: new Map<string, string>(),
      workByTitle: new Map<string, string>()
    };
  }

  const candidates = await prisma.release.findMany({
    where: {
      AND: [
        {
          OR: [
            {
              extraJson: {
                contains: "thumbnailUrl"
              }
            },
            {
              extraJson: {
                contains: "workThumbnailUrl"
              }
            }
          ]
        },
        {
          OR: [
            {
              title: {
                in: [...releaseTitles, ...workTitles]
              }
            },
            {
              work: {
                title: {
                  in: workTitles
                }
              }
            }
          ]
        }
      ]
    },
    include: {
      work: true
    },
    orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
    take: Math.max(180, (releaseTitles.length + workTitles.length) * 14)
  });

  const releaseBySiteAndTitle = new Map<string, string>();
  const workBySiteAndTitle = new Map<string, string>();
  const workByTitle = new Map<string, string>();

  for (const candidate of candidates) {
    const episodeThumb = extractThumbnailUrl(candidate.extraJson);
    const workThumb = extractWorkThumbnailUrl(candidate.extraJson) ?? episodeThumb;
    if (!episodeThumb && !workThumb) {
      continue;
    }

    const releaseTitle = normalizeThumbnailKey(candidate.title);
    const workTitle = normalizeThumbnailKey(candidate.work?.title ?? extractWorkMeta(candidate.extraJson).workTitle ?? null);

    if (releaseTitle && episodeThumb && isLikelyEpisodeThumbnailCandidate(candidate)) {
      const siteKey = `${candidate.siteId}::${releaseTitle}`;
      if (!releaseBySiteAndTitle.has(siteKey)) {
        releaseBySiteAndTitle.set(siteKey, episodeThumb);
      }
    }

    if (workTitle && workThumb && isLikelyWorkThumbnailCandidate(candidate)) {
      const siteKey = `${candidate.siteId}::${workTitle}`;
      if (!workBySiteAndTitle.has(siteKey)) {
        workBySiteAndTitle.set(siteKey, workThumb);
      }
      if (!workByTitle.has(workTitle)) {
        workByTitle.set(workTitle, workThumb);
      }
    }
  }

  return { releaseBySiteAndTitle, workBySiteAndTitle, workByTitle };
}

function normalizeThumbnailKey(value?: string | null) {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  if (!normalized || isGenericContentTitle(normalized)) {
    return null;
  }
  return normalized;
}

function findReleaseThumbnail(
  lookup: {
    releaseBySiteAndTitle: Map<string, string>;
  },
  siteId: string,
  title?: string | null
) {
  const normalized = normalizeThumbnailKey(title);
  if (!normalized) {
    return undefined;
  }

  return lookup.releaseBySiteAndTitle.get(`${siteId}::${normalized}`);
}

function findWorkThumbnail(
  lookup: {
    workBySiteAndTitle: Map<string, string>;
    workByTitle: Map<string, string>;
  },
  siteId: string,
  title?: string | null,
  semanticKind?: string | null,
  sourceType?: string | null
) {
  const normalized = normalizeThumbnailKey(title);
  if (!normalized) {
    return undefined;
  }

  const scoped = lookup.workBySiteAndTitle.get(`${siteId}::${normalized}`);
  if (scoped) {
    return scoped;
  }

  if (semanticKind === "announcement" || semanticKind === "promotion" || sourceType === "news") {
    return lookup.workByTitle.get(normalized);
  }

  return undefined;
}

function isLikelyEpisodeThumbnailCandidate(candidate: {
  sourceType?: string | null;
  contentKind?: string | null;
  semanticKind?: string | null;
  title?: string | null;
}) {
  if (candidate.contentKind === "episode") {
    return true;
  }
  return candidate.sourceType === "rss" || candidate.sourceType === "work_page";
}

function isLikelyWorkThumbnailCandidate(candidate: {
  sourceType?: string | null;
  contentKind?: string | null;
  semanticKind?: string | null;
  title?: string | null;
}) {
  if (candidate.contentKind === "work") {
    return true;
  }
  if (["series_list", "category_list", "oneshot_list", "label_list"].includes(candidate.sourceType ?? "")) {
    return true;
  }
  return candidate.semanticKind === "oneshot_discovery" || candidate.semanticKind === "announcement";
}

function looksLikeExcludedNonManga(value: string) {
  const normalized = normalizeWhitespace(value);
  return /(WEB限定グラビア|グラビア|写真集|デジタル限定|水着)/i.test(normalized);
}
