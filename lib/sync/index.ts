import { prisma } from "@/lib/db/prisma";
import { classifyRelease } from "@/lib/classifier";
import { BOOTSTRAP_OWNER_USER_ID } from "@/lib/domain";
import { env } from "@/lib/env";
import { rebuildSharedHomeSnapshot } from "@/lib/home-snapshot";
import { getSettings } from "@/lib/settings";
import { resolveLaneForUnread, shouldCreateUnreadState } from "@/lib/state";
import { adapterMap, defaultSites, sourceAdapters } from "@/lib/sources/registry";
import type { NormalizedRelease, NormalizedWork } from "@/lib/types";
import { createIdFromUrl } from "@/lib/server/ids";
import {
  coerceDate,
  extractPreviewThumbnailUrl,
  isGenericContentTitle,
  normalizeForMatch,
  normalizeWhitespace,
  safeJsonParse,
  uniqBy
} from "@/lib/utils";

export async function ensureSitesSeeded() {
  for (const site of defaultSites) {
    await prisma.site.upsert({
      where: { id: site.id },
      update: {
        name: site.name,
        baseUrl: site.baseUrl,
        syncStrategy: site.syncStrategy
      },
      create: site
    });
  }

  await cleanupLegacyDemoSeed();
}

export async function runAllEnabledSyncs() {
  await ensureSitesSeeded();
  const enabledSites = await prisma.site.findMany({ where: { enabled: true } });
  const results = await Promise.allSettled(enabledSites.map((site) => runSiteSync(site.id, { skipSharedHomeRefresh: true })));
  await rebuildSharedHomeSnapshot();
  return results;
}

export async function runSiteSync(siteId: string, options?: { skipSharedHomeRefresh?: boolean }) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  const adapter = adapterMap[siteId];
  if (!site || !site.enabled || !adapter) {
    throw new Error(`Site ${siteId} is unavailable`);
  }

  const syncRun = await prisma.syncRun.create({
    data: {
      siteId,
      status: "running",
      statsJson: JSON.stringify({})
    }
  });

  try {
    const adapterStartedAt = Date.now();
    const result = await adapter.sync();
    const adapterMs = Date.now() - adapterStartedAt;
    const persistStartedAt = Date.now();
    const persisted = await persistNormalizedPayload(siteId, result.works, result.releases);
    const persistMs = Date.now() - persistStartedAt;
    let snapshotMs = 0;
    if (!options?.skipSharedHomeRefresh) {
      const snapshotStartedAt = Date.now();
      await rebuildSharedHomeSnapshot();
      snapshotMs = Date.now() - snapshotStartedAt;
    }
    const timingMs = {
      adapter: adapterMs,
      persist: persistMs,
      snapshot: snapshotMs,
      total: adapterMs + persistMs + snapshotMs
    };
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        statsJson: JSON.stringify({
          works: result.works.length,
          releases: result.releases.length,
          insufficientData: result.works.length === 0 && result.releases.length === 0,
          upsertedWorks: persisted.upsertedWorks,
          upsertedReleases: persisted.upsertedReleases,
          userStates: persisted.userStates,
          reconciledWorks: persisted.reconciledWorks,
          deletedWorks: persisted.deletedWorks,
          deletedReleases: persisted.deletedReleases,
          previewBackfills: persisted.previewBackfills,
          timingMs,
          logs: result.logs
        })
      }
    });
    return {
      ...persisted,
      timingMs
    };
  } catch (error) {
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorText: error instanceof Error ? error.message : String(error)
      }
    });
    throw error;
  }
}

export async function persistNormalizedPayload(
  siteId: string,
  works: NormalizedWork[],
  releases: NormalizedRelease[]
) {
  const settingsByUserId = new Map<string, Awaited<ReturnType<typeof getSettings>>>();
  const dedupedWorks = uniqBy(works, (work) => `${work.siteId}:${work.canonicalUrl}`);
  const dedupedReleases = uniqBy(releases, (release) => `${release.siteId}:${release.canonicalUrl}`);
  const workIdByNormalizedTitle = new Map(
    dedupedWorks
      .map((work) => [normalizeForMatch(work.title), createIdFromUrl(work.siteId, work.canonicalUrl)] as const)
      .filter(([title]) => Boolean(title))
  );
  let upsertedWorks = 0;
  let upsertedReleases = 0;
  let userStates = 0;
  let reconciledWorks = 0;
  let deletedWorks = 0;
  let deletedReleases = 0;
  let previewBackfills = 0;

  for (const work of dedupedWorks) {
    const id = createIdFromUrl(work.siteId, work.canonicalUrl);
    await prisma.work.upsert({
      where: { id },
      update: {
        title: work.title,
        authors: JSON.stringify(work.authors),
        kind: work.kind,
        status: work.status ?? "unknown",
        descriptionText: work.descriptionText ?? null,
        lastSeenAt: new Date()
      },
      create: {
        id,
        siteId: work.siteId,
        canonicalUrl: work.canonicalUrl,
        title: work.title,
        authors: JSON.stringify(work.authors),
        kind: work.kind,
        status: work.status ?? "unknown",
        descriptionText: work.descriptionText ?? null,
        firstSeenAt: new Date(),
        lastSeenAt: new Date()
      }
    });
    upsertedWorks += 1;
  }

  const staleWorkResult = await reconcileStaleWorks(siteId, dedupedWorks);
  reconciledWorks += staleWorkResult.reconciledWorks;
  deletedWorks += staleWorkResult.deletedWorks;

  for (const release of dedupedReleases) {
    const releaseMeta = release.extra as Record<string, unknown> | undefined;
    const fallbackWorkTitle =
      typeof releaseMeta?.workTitle === "string" ? normalizeWhitespace(releaseMeta.workTitle) : release.title ?? null;
    const workId =
      release.workCanonicalUrl
        ? createIdFromUrl(siteId, release.workCanonicalUrl)
        : workIdByNormalizedTitle.get(normalizeForMatch(fallbackWorkTitle)) ?? null;
    const work = workId
      ? await prisma.work.findUnique({
          where: { id: workId }
        })
      : null;
    const classification = classifyRelease({
      release,
      work: work
        ? {
            id: work.id,
            siteId: work.siteId,
            canonicalUrl: work.canonicalUrl,
            title: work.title,
            authors: safeJsonParse<string[]>(work.authors, []),
            kind: work.kind as "serial" | "oneshot" | "unknown",
            status: work.status as "active" | "ended" | "unknown"
          }
        : undefined
    });

    const releaseId = createIdFromUrl(siteId, release.canonicalUrl);
    const firstSeenAt = new Date();
    await prisma.release.upsert({
      where: { id: releaseId },
      update: {
        workId,
        title: release.title ?? null,
        publishedAt: coerceDate(release.publishedAt),
        sourceType: release.sourceType,
        rawBadgeText: release.rawBadgeText ?? null,
        semanticKind: classification.semanticKind,
        semanticConfidence: classification.semanticConfidence,
        semanticSignals: JSON.stringify(classification.semanticSignals),
        defaultVisibility: classification.defaultVisibility,
        contentKind: release.contentKind,
        extraJson: release.extra ? JSON.stringify(release.extra) : null
      },
      create: {
        id: releaseId,
        siteId,
        workId,
        canonicalUrl: release.canonicalUrl,
        title: release.title ?? null,
        publishedAt: coerceDate(release.publishedAt),
        firstSeenAt,
        sourceType: release.sourceType,
        rawBadgeText: release.rawBadgeText ?? null,
        semanticKind: classification.semanticKind,
        semanticConfidence: classification.semanticConfidence,
        semanticSignals: JSON.stringify(classification.semanticSignals),
        defaultVisibility: classification.defaultVisibility,
        contentKind: release.contentKind,
        extraJson: release.extra ? JSON.stringify(release.extra) : null
      }
    });
    upsertedReleases += 1;

    if (!work || !workId) {
      continue;
    }

    const releaseRecord = await prisma.release.findUnique({ where: { id: releaseId } });
    if (!releaseRecord) {
      continue;
    }

    const followerPrefs = await prisma.userWorkPref.findMany({
      where: {
        workId,
        follow: true,
        mute: false
      }
    });

    for (const pref of followerPrefs) {
      const shouldCreate = shouldCreateUnreadState({
        followedAt: pref.followedAt,
        firstSeenAt: releaseRecord.firstSeenAt,
        followFromStart: pref.followFromStart,
        semanticKind: classification.semanticKind
      });

      if (!shouldCreate) {
        continue;
      }

      const userSettings =
        settingsByUserId.get(pref.userId) ??
        (await getSettings(pref.userId));
      settingsByUserId.set(pref.userId, userSettings);

      const state = classification.semanticKind === "main_episode" ? "unread" : "opened";
      const lane =
        state === "unread"
          ? resolveLaneForUnread(
              releaseRecord.firstSeenAt,
              new Date(),
              userSettings.dayBoundaryHour,
              userSettings.timezone
            )
          : "archived";
      const existingState = await prisma.userReleaseState.findUnique({
        where: {
          userId_releaseId: {
            userId: pref.userId,
            releaseId
          }
        }
      });

      await prisma.userReleaseState.upsert({
        where: {
          userId_releaseId: {
            userId: pref.userId,
            releaseId
          }
        },
        update: {
          state: existingState?.state ?? state,
          lane: existingState?.lane ?? lane
        },
        create: {
          userId: pref.userId,
          releaseId,
          state,
          lane
        }
      });
      userStates += 1;

      if (pref.catchupMode === "latest_only" && classification.semanticKind === "main_episode" && workId) {
        const mainReleases = await prisma.release.findMany({
          where: {
            workId,
            semanticKind: "main_episode"
          },
          orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }]
        });
        const [, ...olderReleases] = mainReleases;
        await Promise.all(
          olderReleases.map((olderRelease) =>
            prisma.userReleaseState.upsert({
              where: {
                userId_releaseId: {
                  userId: pref.userId,
                  releaseId: olderRelease.id
                }
              },
              update: {
                state: "opened",
                lane: "archived"
              },
              create: {
                userId: pref.userId,
                releaseId: olderRelease.id,
                state: "opened",
                lane: "archived"
              }
            })
          )
        );
      }
    }
  }

  deletedReleases += await reconcileFallbackReleases(siteId);
  await repairGenericWorkMetadata(siteId);
  previewBackfills += await backfillMissingPreviewUrls(siteId);

  if (dedupedWorks.length || dedupedReleases.length) {
    await advanceUnreadLanes();
  }

  return {
    upsertedWorks,
    upsertedReleases,
    userStates,
    reconciledWorks,
    deletedWorks,
    deletedReleases,
    previewBackfills
  };
}

export async function advanceUnreadLanes() {
  const unreadStates = await prisma.userReleaseState.findMany({
    where: {
      state: { in: ["unread", "opened"] }
    },
    include: {
      release: true
    }
  });
  const settingsByUserId = new Map<string, Awaited<ReturnType<typeof getSettings>>>();
  await Promise.all(
    unreadStates.map(async (state) => {
      const settings = settingsByUserId.get(state.userId) ?? (await getSettings(state.userId));
      settingsByUserId.set(state.userId, settings);
      return prisma.userReleaseState.update({
        where: { id: state.id },
        data: {
          lane:
            state.state === "unread"
              ? resolveLaneForUnread(state.release.firstSeenAt, new Date(), settings.dayBoundaryHour, settings.timezone)
              : state.lane
        }
      });
    })
  );
}

export async function bootstrapFromSeededSites() {
  await ensureSitesSeeded();
  return sourceAdapters.map((adapter) => adapter.siteId);
}

async function cleanupLegacyDemoSeed() {
  const legacyWorkUrls = [
    "https://shonenjumpplus.com/series/dandadan",
    "https://tonarinoyj.jp/episode/spy-family",
    "https://comic-days.com/episode/sample-days",
    "https://www.sunday-webry.com/episode/special-read",
    "https://pocket.shonenmagazine.com/episode/sample-pocket"
  ];
  const legacyReleaseUrls = [
    "https://shonenjumpplus.com/episode/dandadan-173",
    "https://shonenjumpplus.com/episode/dandadan-illust",
    "https://tonarinoyj.jp/episode/spy-family-pr",
    "https://www.sunday-webry.com/episode/special-read-1"
  ];
  const legacyWorkIds = legacyWorkUrls.map((url) => {
    const siteId =
      url.includes("shonenjumpplus") ? "jumpplus" :
      url.includes("tonarinoyj") ? "tonarinoyj" :
      url.includes("comic-days") ? "comicdays" :
      url.includes("sunday-webry") ? "sundaywebry" :
      "magapoke";
    return createIdFromUrl(siteId, url);
  });
  const legacyReleaseIds = legacyReleaseUrls.map((url) => {
    const siteId =
      url.includes("shonenjumpplus") ? "jumpplus" :
      url.includes("tonarinoyj") ? "tonarinoyj" :
      "sundaywebry";
    return createIdFromUrl(siteId, url);
  });

  await prisma.userReleaseState.deleteMany({
    where: {
      OR: [
        { releaseId: { in: legacyReleaseIds } },
        { release: { canonicalUrl: { in: legacyReleaseUrls } } },
        { release: { workId: { in: legacyWorkIds } } }
      ]
    }
  });
  await prisma.release.deleteMany({
    where: {
      OR: [{ canonicalUrl: { in: legacyReleaseUrls } }, { workId: { in: legacyWorkIds } }]
    }
  });
  await prisma.userWorkPref.deleteMany({
    where: { workId: { in: legacyWorkIds } }
  });
  await prisma.work.deleteMany({
    where: { id: { in: legacyWorkIds } }
  });

  const prefs = await prisma.userWorkPref.findMany({
    where: { userId: BOOTSTRAP_OWNER_USER_ID },
    include: { work: true }
  });
  const looksLikeLegacyDemo =
    prefs.length === 5 &&
    prefs.some((pref) => pref.work.canonicalUrl.includes("/sample-days")) &&
    prefs.some((pref) => pref.work.canonicalUrl.includes("/sample-pocket")) &&
    prefs.some((pref) => pref.work.title === "サンデーうぇぶり特別読切");

  if (looksLikeLegacyDemo) {
    await prisma.userReleaseState.deleteMany({
      where: { userId: BOOTSTRAP_OWNER_USER_ID }
    });
    await prisma.userWorkPref.deleteMany({
      where: { userId: BOOTSTRAP_OWNER_USER_ID }
    });
  }

  await prisma.appSetting.upsert({
    where: { key: "legacyDemoSeedClearedV1" },
    update: { value: looksLikeLegacyDemo ? "cleared+purged" : "checked+purged" },
    create: { key: "legacyDemoSeedClearedV1", value: looksLikeLegacyDemo ? "cleared+purged" : "checked+purged" }
  });
}

async function backfillMissingPreviewUrls(siteId: string) {
  if (env.PREVIEW_BACKFILL_LIMIT === 0) {
    return 0;
  }

  const cooldownCutoff = Date.now() - env.PREVIEW_BACKFILL_COOLDOWN_HOURS * 60 * 60 * 1000;
  const candidates = await prisma.release.findMany({
    where: { siteId },
    orderBy: [{ firstSeenAt: "desc" }],
    take: Math.max(env.PREVIEW_BACKFILL_LIMIT * 6, env.PREVIEW_BACKFILL_LIMIT),
    select: {
      id: true,
      canonicalUrl: true,
      extraJson: true
    }
  });

  const missing = candidates
    .filter((release) => {
      if (extractPreviewThumbnailUrl(release.extraJson)) {
        return false;
      }
      const extra = safeJsonParse<Record<string, unknown>>(release.extraJson, {});
      const attemptedAt =
        typeof extra.previewBackfillAttemptedAt === "string"
          ? new Date(extra.previewBackfillAttemptedAt).getTime()
          : 0;
      return !attemptedAt || Number.isNaN(attemptedAt) || attemptedAt < cooldownCutoff;
    })
    .slice(0, env.PREVIEW_BACKFILL_LIMIT);
  let updated = 0;

  for (let index = 0; index < missing.length; index += env.PREVIEW_BACKFILL_CONCURRENCY) {
    const batch = missing.slice(index, index + env.PREVIEW_BACKFILL_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (release) => {
        const previewThumbnailUrl = await fetchPreviewThumbnailUrl(release.canonicalUrl);
        const extra = safeJsonParse<Record<string, unknown>>(release.extraJson, {});
        await prisma.release.update({
          where: { id: release.id },
          data: {
            extraJson: JSON.stringify({
              ...extra,
              previewBackfillAttemptedAt: new Date().toISOString(),
              ...(previewThumbnailUrl ? { previewThumbnailUrl } : {})
            })
          }
        });
        return Boolean(previewThumbnailUrl);
      })
    );
    updated += results.filter(Boolean).length;
  }

  return updated;
}

async function fetchPreviewThumbnailUrl(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.SOURCE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "AllMangaInbox/0.1 (+self-hosted; metadata-only)"
      }
    });
    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return (
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i)?.[1] ??
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1] ??
      html.match(/<meta[^>]+name=["']thumbnail["'][^>]+content=["']([^"']+)/i)?.[1] ??
      null
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function reconcileStaleWorks(siteId: string, works: NormalizedWork[]) {
  if (typeof prisma.work.findMany !== "function") {
    return {
      reconciledWorks: 0,
      deletedWorks: 0
    };
  }

  const currentWorks = works.map((work) => ({
    id: createIdFromUrl(siteId, work.canonicalUrl),
    title: work.title
  }));
  const currentWorkIds = new Set(currentWorks.map((work) => work.id));
  const currentWorkByTitle = new Map(currentWorks.map((work) => [work.title, work.id]));
  const staleWorks = await prisma.work.findMany({
    where: { siteId },
    include: {
      prefs: true
    }
  });

  let reconciledWorks = 0;
  let deletedWorks = 0;

  for (const staleWork of staleWorks) {
    if (currentWorkIds.has(staleWork.id)) {
      continue;
    }

    const replacementWorkId = currentWorkByTitle.get(staleWork.title);
    if (replacementWorkId && replacementWorkId !== staleWork.id) {
      await moveWorkAssociations(staleWork.id, replacementWorkId);
      await prisma.work.delete({ where: { id: staleWork.id } });
      reconciledWorks += 1;
      continue;
    }

    if (!staleWork.prefs.length && isGenericContentTitle(staleWork.title)) {
      await prisma.work.delete({ where: { id: staleWork.id } });
      deletedWorks += 1;
    }
  }

  return {
    reconciledWorks,
    deletedWorks
  };
}

async function moveWorkAssociations(fromWorkId: string, toWorkId: string) {
  await prisma.release.updateMany({
    where: { workId: fromWorkId },
    data: { workId: toWorkId }
  });

  const stalePrefs = await prisma.userWorkPref.findMany({
    where: { workId: fromWorkId }
  });

  for (const stalePref of stalePrefs) {
    const existingPref = await prisma.userWorkPref.findUnique({
      where: {
        userId_workId: {
          userId: stalePref.userId,
          workId: toWorkId
        }
      }
    });

    if (!existingPref) {
      await prisma.userWorkPref.update({
        where: { id: stalePref.id },
        data: { workId: toWorkId }
      });
      continue;
    }

    await prisma.userWorkPref.update({
      where: { id: existingPref.id },
      data: {
        follow: existingPref.follow || stalePref.follow,
        mute: existingPref.mute || stalePref.mute,
        pin: existingPref.pin || stalePref.pin,
        priority: Math.max(existingPref.priority, stalePref.priority),
        catchupMode: existingPref.catchupMode !== "all" ? existingPref.catchupMode : stalePref.catchupMode,
        showSideStory: existingPref.showSideStory !== "collapsed" ? existingPref.showSideStory : stalePref.showSideStory,
        showIllustration:
          existingPref.showIllustration !== "collapsed" ? existingPref.showIllustration : stalePref.showIllustration,
        showPromotion: existingPref.showPromotion !== "hidden" ? existingPref.showPromotion : stalePref.showPromotion,
        followedAt: existingPref.followedAt < stalePref.followedAt ? existingPref.followedAt : stalePref.followedAt,
        followFromStart: existingPref.followFromStart || stalePref.followFromStart
      }
    });

    await prisma.userWorkPref.delete({
      where: { id: stalePref.id }
    });
  }
}

async function reconcileFallbackReleases(siteId: string) {
  const episodeReleases = await prisma.release.findMany({
    where: {
      siteId,
      workId: { not: null },
      contentKind: "episode",
      sourceType: "work_page"
    },
    select: {
      workId: true
    }
  });

  const workIds = uniqBy(
    episodeReleases
      .map((release) => release.workId)
      .filter((workId): workId is string => typeof workId === "string" && workId.length > 0),
    (workId) => workId
  );

  if (workIds.length === 0) {
    return 0;
  }

  const fallbackReleases = await prisma.release.findMany({
    where: {
      siteId,
      workId: { in: workIds },
      contentKind: "work"
    },
    select: {
      id: true
    }
  });

  if (fallbackReleases.length === 0) {
    return 0;
  }

  const releaseIds = fallbackReleases.map((release) => release.id);

  await prisma.userReleaseState.deleteMany({
    where: {
      releaseId: { in: releaseIds }
    }
  });

  await prisma.release.deleteMany({
    where: {
      id: { in: releaseIds }
    }
  });

  return releaseIds.length;
}

async function repairGenericWorkMetadata(siteId: string) {
  if (typeof prisma.work.findMany !== "function" || typeof prisma.work.update !== "function") {
    return 0;
  }

  const genericWorks = await prisma.work.findMany({
    where: {
      siteId,
      title: {
        in: ["初めから", "最新話へ", "作品を読む"]
      }
    },
    include: {
      releases: {
        orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
        take: 10
      }
    }
  });

  for (const work of genericWorks) {
    const candidate = work.releases
      .map((release) => safeJsonParse<Record<string, unknown>>(release.extraJson, {}))
      .map((extra) => ({
        title: typeof extra.workTitle === "string" ? normalizeWhitespace(extra.workTitle) : "",
        authors: Array.isArray(extra.authors)
          ? extra.authors.filter((value): value is string => typeof value === "string").map((value) => normalizeWhitespace(value)).filter(Boolean)
          : typeof extra.authorName === "string"
            ? [normalizeWhitespace(extra.authorName)].filter(Boolean)
            : []
      }))
      .find((item) => item.title && !isGenericContentTitle(item.title));

    if (!candidate) {
      continue;
    }

    await prisma.work.update({
      where: { id: work.id },
      data: {
        title: candidate.title,
        authors: candidate.authors.length ? JSON.stringify(candidate.authors) : work.authors
      }
    });
  }
}
