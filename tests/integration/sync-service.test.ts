import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { persistNormalizedPayload } from "@/lib/sync";
import { createIdFromUrl } from "@/lib/server/ids";
import { fixtureReleases, fixtureWork } from "@/tests/fixtures/releases";

type WorkRecord = Record<string, any>;
type ReleaseRecord = Record<string, any>;
type StateRecord = Record<string, any>;
type PrefRecord = Record<string, any>;

const db = {
  works: new Map<string, WorkRecord>(),
  releases: new Map<string, ReleaseRecord>(),
  prefs: new Map<string, PrefRecord>(),
  states: new Map<string, StateRecord>()
};

vi.mock("@/lib/settings", () => ({
  getSettings: async () => ({
    timezone: "Asia/Tokyo",
    dayBoundaryHour: 4,
    semanticDefaults: {}
  })
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    work: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const existing = db.works.get(where.id);
        const next = existing ? { ...existing, ...update } : create;
        db.works.set(where.id, next);
        return next;
      }),
      findUnique: vi.fn(async ({ where, include }: any) => {
        const work = db.works.get(where.id);
        if (!work) {
          return null;
        }
        if (include?.prefs) {
          return {
            ...work,
            prefs: [...db.prefs.values()].filter((pref) => pref.workId === where.id)
          };
        }
        return work;
      }),
      findMany: vi.fn(async () => []),
      delete: vi.fn(async ({ where }: any) => db.works.delete(where.id)),
      update: vi.fn(async ({ where, data }: any) => {
        const existing = db.works.get(where.id);
        const next = { ...existing, ...data };
        db.works.set(where.id, next);
        return next;
      })
    },
    release: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const existing = db.releases.get(where.id);
        const next = existing ? { ...existing, ...update } : create;
        db.releases.set(where.id, next);
        return next;
      }),
      findUnique: vi.fn(async ({ where }: any) => db.releases.get(where.id) ?? null),
      findMany: vi.fn(async ({ where, take, select }: any = {}) => {
        let rows = [...db.releases.values()];
        if (where?.siteId) {
          rows = rows.filter((release) => release.siteId === where.siteId);
        }
        if (typeof where?.workId === "string") {
          rows = rows.filter((release) => release.workId === where.workId);
        }
        if (where?.workId?.not === null) {
          rows = rows.filter((release) => release.workId !== null && release.workId !== undefined);
        }
        if (where?.workId?.in) {
          rows = rows.filter((release) => where.workId.in.includes(release.workId));
        }
        if (where?.semanticKind) {
          rows = rows.filter((release) => release.semanticKind === where.semanticKind);
        }
        if (where?.contentKind) {
          rows = rows.filter((release) => release.contentKind === where.contentKind);
        }
        rows = rows.sort((a, b) => {
          const aTime = new Date(a.publishedAt ?? a.firstSeenAt).getTime();
          const bTime = new Date(b.publishedAt ?? b.firstSeenAt).getTime();
          return bTime - aTime;
        });
        if (typeof take === "number") {
          rows = rows.slice(0, take);
        }
        if (select) {
          return rows.map((release) => Object.fromEntries(Object.keys(select).map((key) => [key, release[key]])));
        }
        return rows;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const existing = db.releases.get(where.id);
        const next = { ...existing, ...data };
        db.releases.set(where.id, next);
        return next;
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
      deleteMany: vi.fn(async ({ where }: any) => {
        const ids = where?.id?.in ?? [];
        for (const id of ids) {
          db.releases.delete(id);
        }
        return { count: ids.length };
      })
    },
    userReleaseState: {
      findUnique: vi.fn(async ({ where }: any) => {
        const key = `${where.userId_releaseId.userId}:${where.userId_releaseId.releaseId}`;
        return db.states.get(key) ?? null;
      }),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const key = `${where.userId_releaseId.userId}:${where.userId_releaseId.releaseId}`;
        const existing = db.states.get(key);
        const next = existing ? { ...existing, ...update } : create;
        db.states.set(key, next);
        return next;
      }),
      findMany: vi.fn(async () => []),
      deleteMany: vi.fn(async () => ({ count: 0 }))
    },
    userWorkPref: {
      findMany: vi.fn(async ({ where }: any) =>
        [...db.prefs.values()].filter((pref) => {
          if (where?.workId && pref.workId !== where.workId) {
            return false;
          }
          if (typeof where?.follow === "boolean" && pref.follow !== where.follow) {
            return false;
          }
          if (typeof where?.mute === "boolean" && pref.mute !== where.mute) {
            return false;
          }
          return true;
        })
      )
    }
  }
}));

describe("sync pipeline integration", () => {
  beforeEach(() => {
    db.works.clear();
    db.releases.clear();
    db.prefs.clear();
    db.states.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("normalizes, classifies, and persists releases", async () => {
    const workId = createIdFromUrl(fixtureWork.siteId, fixtureWork.canonicalUrl);
    db.prefs.set(workId, {
      userId: "default",
      workId,
      follow: true,
      mute: false,
      followedAt: new Date("2026-04-13T10:00:00+09:00"),
      followFromStart: true,
      catchupMode: "all",
      showSideStory: "collapsed",
      showIllustration: "collapsed",
      showPromotion: "hidden"
    });

    await persistNormalizedPayload(fixtureWork.siteId, [fixtureWork], [fixtureReleases.main, fixtureReleases.badgeIllustration]);

    const mainId = createIdFromUrl(fixtureWork.siteId, fixtureReleases.main.canonicalUrl);
    const illustId = createIdFromUrl(fixtureWork.siteId, fixtureReleases.badgeIllustration.canonicalUrl);
    expect(db.releases.get(mainId)?.semanticKind).toBe("main_episode");
    expect(db.releases.get(illustId)?.semanticKind).toBe("illustration");
    expect(db.states.get(`default:${mainId}`)?.state).toBe("unread");
  });

  it("keeps manual override after later sync", async () => {
    const workId = createIdFromUrl(fixtureWork.siteId, fixtureWork.canonicalUrl);
    const releaseId = createIdFromUrl(fixtureWork.siteId, fixtureReleases.main.canonicalUrl);
    db.prefs.set(workId, {
      userId: "default",
      workId,
      follow: true,
      mute: false,
      followedAt: new Date("2026-04-13T10:00:00+09:00"),
      followFromStart: true,
      catchupMode: "all",
      showSideStory: "collapsed",
      showIllustration: "collapsed",
      showPromotion: "hidden"
    });
    db.states.set(`default:${releaseId}`, {
      userId: "default",
      releaseId,
      overrideKind: "illustration",
      state: "opened",
      lane: "archived"
    });

    await persistNormalizedPayload(fixtureWork.siteId, [fixtureWork], [fixtureReleases.main]);
    expect(db.releases.get(releaseId)?.semanticKind).toBe("main_episode");
    expect(db.states.get(`default:${releaseId}`)?.overrideKind).toBe("illustration");
  });

  it("does not create unread states for releases older than follow baseline", async () => {
    const workId = createIdFromUrl(fixtureWork.siteId, fixtureWork.canonicalUrl);
    const releaseId = createIdFromUrl(fixtureWork.siteId, fixtureReleases.main.canonicalUrl);
    db.works.set(workId, {
      id: workId,
      siteId: fixtureWork.siteId,
      canonicalUrl: fixtureWork.canonicalUrl,
      title: fixtureWork.title,
      authors: JSON.stringify(fixtureWork.authors),
      kind: fixtureWork.kind,
      status: "active",
      prefs: []
    });
    db.releases.set(releaseId, {
      id: releaseId,
      siteId: fixtureWork.siteId,
      workId,
      canonicalUrl: fixtureReleases.main.canonicalUrl,
      title: fixtureReleases.main.title,
      firstSeenAt: new Date("2026-04-10T10:00:00+09:00"),
      semanticKind: "main_episode"
    });
    db.prefs.set(workId, {
      userId: "default",
      workId,
      follow: true,
      mute: false,
      followedAt: new Date("2026-04-14T10:00:00+09:00"),
      followFromStart: false,
      catchupMode: "all",
      showSideStory: "collapsed",
      showIllustration: "collapsed",
      showPromotion: "hidden"
    });

    await persistNormalizedPayload(fixtureWork.siteId, [fixtureWork], [fixtureReleases.main]);
    expect(db.states.get(`default:${releaseId}`)).toBeUndefined();
  });

  it("backfills only missing preview thumbnails and respects recent failure cooldown", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T12:00:00+09:00"));
    const fetchMock = vi.fn(async (url: string) => {
      return new Response(`<meta property="og:image" content="${url}/ogp.jpg">`, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    db.releases.set("missing", makeBackfillRelease("missing", null));
    db.releases.set(
      "recent-failure",
      makeBackfillRelease("recent-failure", {
        previewBackfillAttemptedAt: "2026-04-19T10:00:00+09:00"
      })
    );
    db.releases.set(
      "old-failure",
      makeBackfillRelease("old-failure", {
        previewBackfillAttemptedAt: "2026-04-17T10:00:00+09:00"
      })
    );
    db.releases.set(
      "already-filled",
      makeBackfillRelease("already-filled", {
        previewThumbnailUrl: "https://example.test/already.jpg"
      })
    );

    const result = await persistNormalizedPayload(fixtureWork.siteId, [], []);

    expect(result.previewBackfills).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://comic-days.com/episode/missing",
      "https://comic-days.com/episode/old-failure"
    ]);
    expect(JSON.parse(db.releases.get("missing")?.extraJson).previewThumbnailUrl).toBe(
      "https://comic-days.com/episode/missing/ogp.jpg"
    );
    expect(JSON.parse(db.releases.get("old-failure")?.extraJson).previewThumbnailUrl).toBe(
      "https://comic-days.com/episode/old-failure/ogp.jpg"
    );
    expect(JSON.parse(db.releases.get("recent-failure")?.extraJson).previewThumbnailUrl).toBeUndefined();
  });
});

function makeBackfillRelease(id: string, extra: Record<string, unknown> | null) {
  return {
    id,
    siteId: fixtureWork.siteId,
    canonicalUrl: `https://comic-days.com/episode/${id}`,
    title: `backfill ${id}`,
    publishedAt: new Date("2026-04-19T10:00:00+09:00"),
    firstSeenAt: new Date("2026-04-19T10:00:00+09:00"),
    semanticKind: "main_episode",
    contentKind: "episode",
    sourceType: "work_page",
    extraJson: extra ? JSON.stringify(extra) : null
  };
}
