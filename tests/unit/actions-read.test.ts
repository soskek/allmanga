import { afterEach, describe, expect, it, vi } from "vitest";

describe("read state actions", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/lib/auth/session");
    vi.doUnmock("@/lib/settings");
    vi.doUnmock("@/lib/db/prisma");
  });

  it("marks a main episode as read when opened through the app link", async () => {
    const update = vi.fn(async ({ data }: any) => data);

    vi.doMock("@/lib/auth/session", () => ({
      requireSessionUserId: async () => "user-1"
    }));
    vi.doMock("@/lib/settings", () => ({
      getSettings: async () => ({ timezone: "Asia/Tokyo", dayBoundaryHour: 4 })
    }));
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        release: {
          findUnique: vi.fn(async () => ({ id: "release-1", semanticKind: "main_episode" }))
        },
        userReleaseState: {
          findUnique: vi.fn(async () => ({ id: "state-1", state: "unread", lane: "today" })),
          update,
          create: vi.fn()
        }
      }
    }));

    const { recordReleaseOpened } = await import("@/lib/actions");
    await recordReleaseOpened("release-1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "state-1" },
      data: {
        state: "read",
        lane: "archived",
        openedAt: expect.any(Date),
        readAt: expect.any(Date),
        dismissedAt: expect.any(Date)
      }
    });
  });

  it("updates all visible main releases in one bulk path instead of per-release action calls", async () => {
    const updates: any[] = [];
    const creates: any[] = [];
    const transaction = vi.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops));

    vi.doMock("@/lib/auth/session", () => ({
      requireSessionUserId: async () => "user-1"
    }));
    vi.doMock("@/lib/settings", () => ({
      getSettings: async () => ({ timezone: "Asia/Tokyo", dayBoundaryHour: 4 })
    }));
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        $transaction: transaction,
        release: {
          findMany: vi.fn(async () => [
            { id: "r1", firstSeenAt: new Date("2026-04-19T10:00:00+09:00") },
            { id: "r2", firstSeenAt: new Date("2026-04-19T11:00:00+09:00") }
          ])
        },
        userReleaseState: {
          findMany: vi.fn(async () => [{ releaseId: "r1" }]),
          update: vi.fn((input: any) => {
            updates.push(input);
            return Promise.resolve(input);
          }),
          create: vi.fn((input: any) => {
            creates.push(input);
            return Promise.resolve(input);
          })
        }
      }
    }));

    const { updateWorkMainReleaseStates } = await import("@/lib/actions");
    const result = await updateWorkMainReleaseStates("work-1", "read");

    expect(result).toEqual({ count: 2 });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(updates).toHaveLength(1);
    expect(creates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      where: {
        userId_releaseId: {
          userId: "user-1",
          releaseId: "r1"
        }
      },
      data: {
        state: "read",
        lane: "archived",
        readAt: expect.any(Date),
        dismissedAt: expect.any(Date)
      }
    });
    expect(creates[0]).toMatchObject({
      data: {
        userId: "user-1",
        releaseId: "r2",
        state: "read",
        lane: "archived",
        readAt: expect.any(Date),
        dismissedAt: expect.any(Date)
      }
    });
  });
});
