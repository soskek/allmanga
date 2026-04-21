import { prisma } from "@/lib/db/prisma";
import { requireSessionUserId } from "@/lib/auth/session";
import { createIdFromUrl } from "@/lib/server/ids";
import { getSettings } from "@/lib/settings";
import { resolveLaneForUnread } from "@/lib/state";
import { extractWorkMeta, isGenericContentTitle } from "@/lib/utils";

export async function toggleFollow(workId: string, follow: boolean) {
  const userId = await requireSessionUserId();
  const pref = await prisma.userWorkPref.upsert({
    where: {
      userId_workId: {
        userId,
        workId
      }
    },
    update: {
      follow,
      mute: follow ? false : undefined,
      pin: follow ? undefined : false,
      priority: follow ? undefined : 0,
      followedAt: follow ? new Date() : undefined
    },
    create: {
      userId,
      workId,
      follow,
      followedAt: new Date()
    }
  });

  if (!follow) {
    return pref;
  }

  const latestMainRelease = await prisma.release.findFirst({
    where: {
      workId,
      semanticKind: "main_episode",
      contentKind: "episode"
    },
    orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }]
  });

  if (!latestMainRelease) {
    return pref;
  }

  const existingState = await prisma.userReleaseState.findUnique({
    where: {
        userId_releaseId: {
        userId,
        releaseId: latestMainRelease.id
      }
    }
  });

  if (!existingState) {
    const settings = await getSettings(userId);
    await prisma.userReleaseState.create({
      data: {
        userId,
        releaseId: latestMainRelease.id,
        state: "unread",
        lane: resolveLaneForUnread(latestMainRelease.firstSeenAt, new Date(), settings.dayBoundaryHour, settings.timezone)
      }
    });
  }

  return pref;
}

export async function ensureWorkForRelease(releaseId: string) {
  const release = await prisma.release.findUnique({
    where: { id: releaseId },
    include: {
      work: true
    }
  });

  if (!release) {
    throw new Error("Release not found");
  }

  if (release.workId && release.work) {
    return release.work.id;
  }

  const workMeta = extractWorkMeta(release.extraJson);
  const workTitle = workMeta.workTitle && !isGenericContentTitle(workMeta.workTitle) ? workMeta.workTitle : null;
  if (!workTitle) {
    throw new Error("Unable to resolve work for release");
  }

  const syntheticCanonicalUrl = `https://allmanga.local/work/${encodeURIComponent(release.siteId)}/${encodeURIComponent(workTitle)}`;
  const workId = createIdFromUrl(release.siteId, syntheticCanonicalUrl);

  await prisma.work.upsert({
    where: { id: workId },
    update: {
      title: workTitle,
      authors: JSON.stringify(workMeta.authors),
      lastSeenAt: new Date()
    },
    create: {
      id: workId,
      siteId: release.siteId,
      canonicalUrl: syntheticCanonicalUrl,
      title: workTitle,
      authors: JSON.stringify(workMeta.authors),
      kind: "serial",
      status: "unknown",
      firstSeenAt: release.firstSeenAt,
      lastSeenAt: new Date()
    }
  });

  const matchingReleases = await prisma.release.findMany({
    where: {
      siteId: release.siteId,
      workId: null,
      extraJson: {
        contains: `"workTitle":"${workTitle.replaceAll("\"", "\\\"")}"`
      }
    },
    select: { id: true }
  });

  if (matchingReleases.length) {
    await prisma.release.updateMany({
      where: {
        id: {
          in: matchingReleases.map((item) => item.id)
        }
      },
      data: {
        workId
      }
    });
  } else {
    await prisma.release.update({
      where: { id: releaseId },
      data: { workId }
    });
  }

  return workId;
}

export async function updateWorkFlags(
  workId: string,
  changes: Partial<{
    pin: boolean;
    mute: boolean;
    priority: number;
    catchupMode: string;
    showSideStory: string;
    showIllustration: string;
    showPromotion: string;
    followFromStart: boolean;
  }>
) {
  const userId = await requireSessionUserId();
  return prisma.userWorkPref.upsert({
    where: {
      userId_workId: {
        userId,
        workId
      }
    },
    update: changes,
    create: {
      userId,
      workId,
      follow: true,
      ...changes
    }
  });
}

export async function updateReleaseState(
  releaseId: string,
  action: "read" | "unread" | "snooze" | "opened",
  overrideKind?: string | null
) {
  const userId = await requireSessionUserId();
  const settings = await getSettings(userId);
  const release = await prisma.release.findUnique({ where: { id: releaseId } });
  if (!release) {
    throw new Error("Release not found");
  }

  const data =
    action === "read"
      ? { state: "read", lane: "archived", readAt: new Date(), dismissedAt: new Date() }
      : action === "snooze"
        ? { state: "snoozed", lane: "weekend", dismissedAt: new Date() }
        : action === "opened"
          ? { state: "opened", lane: "archived", openedAt: new Date() }
          : {
              state: "unread",
              lane: resolveLaneForUnread(release.firstSeenAt, new Date(), settings.dayBoundaryHour, settings.timezone)
            };

  return prisma.userReleaseState.upsert({
    where: {
      userId_releaseId: {
        userId,
        releaseId
      }
    },
    update: {
      ...data,
      overrideKind: overrideKind ?? undefined
    },
    create: {
      userId,
      releaseId,
      ...data,
      overrideKind: overrideKind ?? undefined
    }
  });
}

export async function recordReleaseOpened(releaseId: string) {
  const userId = await requireSessionUserId();
  const release = await prisma.release.findUnique({ where: { id: releaseId } });
  if (!release) {
    throw new Error("Release not found");
  }

  const now = new Date();
  const data =
    release.semanticKind === "main_episode"
      ? {
          state: "read",
          lane: "archived",
          openedAt: now,
          readAt: now,
          dismissedAt: now
        }
      : {
          state: "opened",
          lane: "archived",
          openedAt: now
        };

  const existing = await prisma.userReleaseState.findUnique({
    where: {
      userId_releaseId: {
        userId,
        releaseId
      }
    }
  });

  if (existing) {
    return prisma.userReleaseState.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.userReleaseState.create({
    data: {
      userId,
      releaseId,
      ...data
    }
  });
}

export async function updateWorkMainReleaseStates(
  workId: string,
  action: "read" | "unread" | "snooze",
  options?: { latestOnly?: boolean }
) {
  const userId = await requireSessionUserId();
  const settings = action === "unread" ? await getSettings(userId) : null;
  const releases = await prisma.release.findMany({
    where: { workId, semanticKind: "main_episode", contentKind: "episode" },
    orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
    take: options?.latestOnly ? 1 : undefined
  });
  if (!releases.length) {
    return { count: 0 };
  }

  const releaseIds = releases.map((release) => release.id);
  const existingStates = await prisma.userReleaseState.findMany({
    where: {
      userId,
      releaseId: { in: releaseIds }
    },
    select: {
      releaseId: true
    }
  });
  const existingReleaseIds = new Set(existingStates.map((state) => state.releaseId));
  const now = new Date();

  const dataFor = (release: (typeof releases)[number]) => {
    if (action === "read") {
      return {
        state: "read",
        lane: "archived",
        readAt: now,
        dismissedAt: now
      };
    }
    if (action === "snooze") {
      return {
        state: "snoozed",
        lane: "weekend",
        dismissedAt: now
      };
    }
    return {
      state: "unread",
      lane: resolveLaneForUnread(release.firstSeenAt, now, settings!.dayBoundaryHour, settings!.timezone),
      readAt: null,
      dismissedAt: null
    };
  };

  await prisma.$transaction([
    ...releases
      .filter((release) => existingReleaseIds.has(release.id))
      .map((release) =>
        prisma.userReleaseState.update({
          where: {
            userId_releaseId: {
              userId,
              releaseId: release.id
            }
          },
          data: dataFor(release)
        })
      ),
    ...releases
      .filter((release) => !existingReleaseIds.has(release.id))
      .map((release) =>
        prisma.userReleaseState.create({
          data: {
            userId,
            releaseId: release.id,
            ...dataFor(release)
          }
        })
      )
  ]);

  return { count: releases.length };
}

export async function updateReleaseOverrideKind(releaseId: string, overrideKind: string | null) {
  const userId = await requireSessionUserId();
  return prisma.userReleaseState.upsert({
    where: {
      userId_releaseId: {
        userId,
        releaseId
      }
    },
    update: {
      overrideKind
    },
    create: {
      userId,
      releaseId,
      state: "opened",
      lane: "archived",
      overrideKind
    }
  });
}

export async function exportUserData() {
  const userId = await requireSessionUserId();
  const [prefs, states] = await Promise.all([
    prisma.userWorkPref.findMany({ where: { userId } }),
    prisma.userReleaseState.findMany({ where: { userId } })
  ]);
  return {
    exportedAt: new Date().toISOString(),
    prefs,
    states
  };
}

export async function importUserData(payload: {
  prefs?: Array<Record<string, unknown>>;
  states?: Array<Record<string, unknown>>;
}) {
  const userId = await requireSessionUserId();
  if (payload.prefs) {
    for (const pref of payload.prefs) {
      const workId = String(pref.workId);
      await prisma.userWorkPref.upsert({
        where: {
          userId_workId: {
            userId,
            workId
          }
        },
        update: {
          ...pref,
          workId,
          userId
        },
        create: {
          ...pref,
          workId,
          userId
        } as never
      });
    }
  }

  if (payload.states) {
    for (const state of payload.states) {
      const releaseId = String(state.releaseId);
      await prisma.userReleaseState.upsert({
        where: {
          userId_releaseId: {
            userId,
            releaseId
          }
        },
        update: {
          ...state,
          releaseId,
          userId
        },
        create: {
          ...state,
          releaseId,
          userId
        } as never
      });
    }
  }
}
