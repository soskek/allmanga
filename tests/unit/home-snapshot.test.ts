import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ReleaseRecord = {
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

const releases: ReleaseRecord[] = [];
const appSettings = new Map<string, string>();
let latestSyncStartedAt = new Date("2026-04-19T09:00:00+09:00");
let latestSyncFinishedAt = new Date("2026-04-19T09:01:00+09:00");

vi.mock("@/lib/settings", () => ({
  getDefaultSettings: () => ({
    timezone: "Asia/Tokyo",
    dayBoundaryHour: 4,
    discoverWindowDays: 7,
    semanticDefaults: {},
    tileDensity: "compact",
    tileAspect: "wide",
    imagePolicy: "preview_safe",
    siteOrder: []
  })
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    syncRun: {
      findFirst: vi.fn(async () => ({ startedAt: latestSyncStartedAt, finishedAt: latestSyncFinishedAt }))
    },
    release: {
      findMany: vi.fn(async ({ where, orderBy, take }: any) => {
        const rows = releases
          .filter((release) => matchesWhere(release, where))
          .sort((left, right) => {
            if (!orderBy) {
              return 0;
            }
            const leftAt = (left.publishedAt ?? left.firstSeenAt).getTime();
            const rightAt = (right.publishedAt ?? right.firstSeenAt).getTime();
            return rightAt - leftAt;
          });
        return typeof take === "number" ? rows.slice(0, take) : rows;
      })
    },
    appSetting: {
      findUnique: vi.fn(async ({ where }: any) => {
        const value = appSettings.get(where.key);
        return value ? { key: where.key, value } : null;
      }),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        appSettings.set(where.key, update?.value ?? create.value);
        return { key: where.key, value: appSettings.get(where.key) };
      })
    }
  }
}));

describe("shared home snapshot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T12:00:00+09:00"));
    releases.length = 0;
    appSettings.clear();
    latestSyncStartedAt = new Date("2026-04-19T09:00:00+09:00");
    latestSyncFinishedAt = new Date("2026-04-19T09:01:00+09:00");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps today's feed and recent feed in separate date windows", async () => {
    releases.push(
      makeMainRelease("today", "今日の作品", "2026-04-19T10:00:00+09:00"),
      makeMainRelease("yesterday", "昨日の作品", "2026-04-18T10:00:00+09:00")
    );

    const { rebuildSharedHomeSnapshot } = await import("@/lib/home-snapshot");
    const snapshot = await rebuildSharedHomeSnapshot();

    expect(snapshot.todayFeed.map((item) => item.title)).toEqual(["今日の作品"]);
    expect(snapshot.recentMainFeed.map((item) => item.title)).toEqual(["昨日の作品"]);
    expect(new Set(snapshot.todayFeed.map((item) => item.workKey))).not.toContain(snapshot.recentMainFeed[0]?.workKey);
  });

  it("limits discover items to the configured discovery window", async () => {
    releases.push(
      makeDiscoverRelease("inside", "期間内の読切", "2026-04-13T00:00:00+09:00"),
      makeDiscoverRelease("outside", "古い読切", "2026-04-12T23:59:59+09:00")
    );

    const { rebuildSharedHomeSnapshot } = await import("@/lib/home-snapshot");
    const snapshot = await rebuildSharedHomeSnapshot();

    expect(snapshot.discover.map((item) => item.title)).toEqual(["期間内の読切"]);
  });

  it("does not treat undated episode or announcement backfills as fresh discoveries", async () => {
    releases.push(
      makeDiscoverRelease("official", "公式日付ありの読切", "2026-04-18T10:00:00+09:00"),
      makeDiscoverRelease("catalog", "日付なしカタログ読切", null, {
        contentKind: "work",
        sourceType: "category_list",
        firstSeenAt: new Date("2026-04-18T10:00:00+09:00")
      }),
      makeDiscoverRelease("episode-backfill", "日付なし episode 読切", null, {
        contentKind: "episode",
        sourceType: "work_page",
        firstSeenAt: new Date("2026-04-18T10:00:00+09:00")
      }),
      makeDiscoverRelease("announcement-backfill", "日付なし告知", null, {
        semanticKind: "announcement",
        contentKind: "article",
        sourceType: "news",
        firstSeenAt: new Date("2026-04-18T10:00:00+09:00")
      })
    );

    const { rebuildSharedHomeSnapshot } = await import("@/lib/home-snapshot");
    const snapshot = await rebuildSharedHomeSnapshot();

    expect(snapshot.discover.map((item) => item.title)).toEqual(["公式日付ありの読切", "日付なしカタログ読切"]);
    expect(snapshot.discover[0]?.publishedAt).toEqual(new Date("2026-04-18T10:00:00+09:00"));
    expect(snapshot.discover[1]?.publishedAt).toBeNull();
  });

  it("sorts discover items by official dates before undated catalogue fallbacks", async () => {
    releases.push(
      makeDiscoverRelease("old-official", "古い公式日付の読切", "2026-04-17T22:00:00+09:00"),
      makeDiscoverRelease("fallback-newer", "新しい日付なしカタログ読切", null, {
        contentKind: "work",
        sourceType: "category_list",
        firstSeenAt: new Date("2026-04-18T09:00:00+09:00")
      }),
      makeDiscoverRelease("new-official", "新しい公式日付の読切", "2026-04-18T20:00:00+09:00")
    );

    const { rebuildSharedHomeSnapshot } = await import("@/lib/home-snapshot");
    const snapshot = await rebuildSharedHomeSnapshot();

    expect(snapshot.discover.map((item) => item.title)).toEqual([
      "新しい公式日付の読切",
      "古い公式日付の読切",
      "新しい日付なしカタログ読切"
    ]);
  });

  it("balances discover items across sites before applying the display limit", async () => {
    for (let index = 0; index < 130; index += 1) {
      releases.push(
        makeDiscoverRelease(`jump-${index}`, `ジャンプ読切${index}`, null, {
          siteId: "jumpplus",
          canonicalUrl: `https://shonenjumpplus.com/episode/jump-${index}`
        })
      );
    }
    for (let index = 0; index < 3; index += 1) {
      releases.push(
        makeDiscoverRelease(`maga-${index}`, `マガポケ読切${index}`, null, {
          siteId: "magapoke",
          canonicalUrl: `https://pocket.shonenmagazine.com/episode/maga-${index}`
        })
      );
    }

    const { rebuildSharedHomeSnapshot } = await import("@/lib/home-snapshot");
    const snapshot = await rebuildSharedHomeSnapshot();

    expect(snapshot.discover).toHaveLength(100);
    expect(snapshot.discover.filter((item) => item.siteId === "magapoke")).toHaveLength(3);
    expect(new Set(snapshot.discover.map((item) => item.siteId))).toEqual(new Set(["jumpplus", "magapoke"]));
  });

  it("rebuilds a cached snapshot when a newer sync has finished", async () => {
    appSettings.set(
      "sharedHomeSnapshotV3",
      JSON.stringify({
        timezone: "Asia/Tokyo",
        builtAt: "2026-04-19T00:00:00.000Z",
        lastSyncedAt: "2026-04-19T00:00:00.000Z",
        hiddenCount: 0,
        hiddenBreakdown: {
          promotion: 0,
          announcement: 0
        },
        todayFeed: [],
        recentMainFeed: [],
        discover: []
      })
    );
    latestSyncFinishedAt = new Date("2026-04-19T10:00:00+09:00");
    releases.push(makeMainRelease("today", "再生成される作品", "2026-04-19T10:00:00+09:00"));

    const { getSharedHomeSnapshot } = await import("@/lib/home-snapshot");
    const snapshot = await getSharedHomeSnapshot();

    expect(snapshot.todayFeed.map((item) => item.title)).toEqual(["再生成される作品"]);
    expect(JSON.parse(appSettings.get("sharedHomeSnapshotV3") ?? "{}").todayFeed).toHaveLength(1);
  });
});

function makeMainRelease(id: string, title: string, publishedAt: string): ReleaseRecord {
  return {
    id,
    siteId: "jumpplus",
    canonicalUrl: `https://shonenjumpplus.com/episode/${id}`,
    title: "第1話",
    semanticKind: "main_episode",
    sourceType: "rss",
    contentKind: "episode",
    publishedAt: new Date(publishedAt),
    firstSeenAt: new Date(publishedAt),
    workId: `work-${id}`,
    work: {
      id: `work-${id}`,
      title,
      authors: JSON.stringify(["作者"]),
      releases: []
    }
  };
}

function makeDiscoverRelease(
  id: string,
  title: string,
  publishedAt: string | null,
  overrides: Partial<ReleaseRecord> = {}
): ReleaseRecord {
  const firstSeenAt = overrides.firstSeenAt ?? (publishedAt ? new Date(publishedAt) : new Date("2026-04-18T10:00:00+09:00"));
  return {
    id,
    siteId: "jumpplus",
    canonicalUrl: `https://shonenjumpplus.com/episode/${id}`,
    title,
    semanticKind: "oneshot_discovery",
    sourceType: "oneshot_list",
    contentKind: "work",
    publishedAt: publishedAt ? new Date(publishedAt) : null,
    firstSeenAt,
    workId: `work-${id}`,
    work: {
      id: `work-${id}`,
      title,
      authors: JSON.stringify(["作者"]),
      releases: []
    },
    ...overrides
  };
}

function matchesWhere(release: ReleaseRecord, where: any): boolean {
  if (!where) {
    return true;
  }
  if (where.OR && !where.OR.some((child: any) => matchesWhere(release, child))) {
    return false;
  }
  if (where.semanticKind && !matchesScalar(release.semanticKind, where.semanticKind)) {
    return false;
  }
  if (where.sourceType && !matchesScalar(release.sourceType, where.sourceType)) {
    return false;
  }
  if (where.contentKind && !matchesScalar(release.contentKind, where.contentKind)) {
    return false;
  }
  if (where.siteId && !matchesScalar(release.siteId, where.siteId)) {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(where, "publishedAt") && !matchesDate(release.publishedAt, where.publishedAt)) {
    return false;
  }
  if (where.firstSeenAt && !matchesDate(release.firstSeenAt, where.firstSeenAt)) {
    return false;
  }
  return true;
}

function matchesScalar(value: string, condition: any): boolean {
  if (condition?.in) {
    return condition.in.includes(value);
  }
  return value === condition;
}

function matchesDate(value: Date | null, condition: any): boolean {
  if (condition === null) {
    return value === null;
  }
  if (condition?.not === null) {
    return value !== null;
  }
  if (!value) {
    return false;
  }
  if (condition.gte && value < condition.gte) {
    return false;
  }
  if (condition.lt && value >= condition.lt) {
    return false;
  }
  return true;
}
