import { afterEach, describe, expect, it, vi } from "vitest";

describe("runSiteSync telemetry", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/lib/db/prisma");
    vi.doUnmock("@/lib/home-snapshot");
    vi.doUnmock("@/lib/settings");
    vi.doUnmock("@/lib/sources/registry");
  });

  it("records adapter, persist, snapshot, and total timings in SyncRun stats", async () => {
    let updatedStatsJson = "";
    const rebuildSharedHomeSnapshot = vi.fn(async () => undefined);

    vi.doMock("@/lib/sources/registry", () => ({
      adapterMap: {
        fake: {
          siteId: "fake",
          enabledByDefault: true,
          sync: vi.fn(async () => ({
            works: [],
            releases: [],
            logs: ["fake adapter completed"]
          }))
        }
      },
      defaultSites: [],
      sourceAdapters: []
    }));
    vi.doMock("@/lib/home-snapshot", () => ({
      rebuildSharedHomeSnapshot
    }));
    vi.doMock("@/lib/settings", () => ({
      getSettings: async () => ({
        timezone: "Asia/Tokyo",
        dayBoundaryHour: 4,
        semanticDefaults: {}
      })
    }));
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        site: {
          findUnique: vi.fn(async () => ({ id: "fake", enabled: true }))
        },
        syncRun: {
          create: vi.fn(async () => ({ id: "sync-run-1" })),
          update: vi.fn(async ({ data }: any) => {
            updatedStatsJson = data.statsJson;
            return data;
          })
        },
        work: {
          findMany: vi.fn(async () => []),
          delete: vi.fn(),
          update: vi.fn()
        },
        release: {
          findMany: vi.fn(async () => []),
          update: vi.fn(),
          updateMany: vi.fn(),
          deleteMany: vi.fn()
        },
        userReleaseState: {
          findMany: vi.fn(async () => []),
          deleteMany: vi.fn()
        },
        userWorkPref: {
          findMany: vi.fn(async () => [])
        }
      }
    }));

    const { runSiteSync } = await import("@/lib/sync");
    const result = await runSiteSync("fake");
    const stats = JSON.parse(updatedStatsJson);

    expect(rebuildSharedHomeSnapshot).toHaveBeenCalledTimes(1);
    expect(stats.logs).toEqual(["fake adapter completed"]);
    expect(stats.timingMs).toEqual({
      adapter: expect.any(Number),
      persist: expect.any(Number),
      snapshot: expect.any(Number),
      total: expect.any(Number)
    });
    expect(stats.timingMs.total).toBe(stats.timingMs.adapter + stats.timingMs.persist + stats.timingMs.snapshot);
    expect(result.timingMs).toEqual(stats.timingMs);
  });
});
