import { calendarDayStartDate, laneBoundaryDate, resolveLaneForUnread, shouldCreateUnreadState } from "@/lib/state";

describe("lane state transition", () => {
  it("calculates JST calendar start independently of the server timezone", () => {
    expect(calendarDayStartDate(new Date("2026-04-19T12:00:00+09:00"), "Asia/Tokyo").toISOString()).toBe(
      "2026-04-18T15:00:00.000Z"
    );
  });

  it("calculates JST lane boundary independently of the server timezone", () => {
    expect(laneBoundaryDate(new Date("2026-04-19T12:00:00+09:00"), 4, "Asia/Tokyo").toISOString()).toBe(
      "2026-04-18T19:00:00.000Z"
    );
  });

  it("keeps same-day unread in today lane", () => {
    const now = new Date("2026-04-14T12:00:00+09:00");
    const firstSeenAt = new Date("2026-04-14T09:00:00+09:00");
    expect(resolveLaneForUnread(firstSeenAt, now, 4, "Asia/Tokyo")).toBe("today");
  });

  it("moves older unread into stack lane", () => {
    const now = new Date("2026-04-15T12:00:00+09:00");
    const firstSeenAt = new Date("2026-04-14T02:00:00+09:00");
    expect(resolveLaneForUnread(firstSeenAt, now, 4, "Asia/Tokyo")).toBe("stack");
  });

  it("does not flood unread for baseline follow", () => {
    expect(
      shouldCreateUnreadState({
        followedAt: new Date("2026-04-14T10:00:00+09:00"),
        firstSeenAt: new Date("2026-04-13T10:00:00+09:00"),
        followFromStart: false,
        semanticKind: "main_episode"
      })
    ).toBe(false);
  });
});
