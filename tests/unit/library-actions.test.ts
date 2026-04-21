import { afterEach, describe, expect, it, vi } from "vitest";

describe("library follow controls", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/lib/auth/session");
    vi.doUnmock("@/lib/db/prisma");
  });

  it("clears pin and priority when a work is unfollowed so it leaves the normal library", async () => {
    const upsert = vi.fn(async ({ update }: any) => update);

    vi.doMock("@/lib/auth/session", () => ({
      requireSessionUserId: async () => "user-1"
    }));
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        userWorkPref: {
          upsert
        }
      }
    }));

    const { toggleFollow } = await import("@/lib/actions");
    await toggleFollow("work-1", false);

    expect(upsert).toHaveBeenCalledWith({
      where: {
        userId_workId: {
          userId: "user-1",
          workId: "work-1"
        }
      },
      update: {
        follow: false,
        mute: undefined,
        pin: false,
        priority: 0,
        followedAt: undefined
      },
      create: {
        userId: "user-1",
        workId: "work-1",
        follow: false,
        followedAt: expect.any(Date)
      }
    });
  });

  it("loads only active library preferences", async () => {
    const findMany = vi.fn(async () => []);

    vi.doMock("@/lib/auth/session", () => ({
      requireSessionUserId: async () => "user-1"
    }));
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        userWorkPref: {
          findMany
        }
      }
    }));

    const { getLibraryView } = await import("@/lib/queries/private");
    await getLibraryView();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          OR: [{ follow: true }, { pin: true }, { mute: true }, { priority: { gt: 0 } }]
        }
      })
    );
  });
});
