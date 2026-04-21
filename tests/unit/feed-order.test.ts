import { describe, expect, it } from "vitest";
import { groupFeedByDate, sortFeedByDateThenSite, sortFeedByUserSiteOrder } from "@/lib/feed-order";

const baseDate = new Date("2026-04-19T10:00:00+09:00");

describe("feed ordering", () => {
  it("uses the same site order for feed sections", () => {
    const rows = [
      row("mangaone", "mangaone"),
      row("jumpplus", "jumpplus"),
      row("magapoke", "magapoke")
    ];

    expect(sortFeedByUserSiteOrder(rows, ["magapoke", "jumpplus", "mangaone"]).map((item) => item.id)).toEqual([
      "magapoke",
      "jumpplus",
      "mangaone"
    ]);
  });

  it("keeps followed works first before site ordering", () => {
    const rows = [
      row("magapoke", "magapoke"),
      row("mangaone", "mangaone", true)
    ];

    expect(sortFeedByUserSiteOrder(rows, ["magapoke", "mangaone"]).map((item) => item.id)).toEqual([
      "mangaone",
      "magapoke"
    ]);
  });

  it("orders recent feed by calendar date first, then site order inside the date", () => {
    const rows = [
      row("old-jump", "jumpplus", false, "2026-04-18T23:30:00+09:00"),
      row("new-mangaone", "mangaone", false, "2026-04-19T08:00:00+09:00"),
      row("new-jump", "jumpplus", false, "2026-04-19T07:00:00+09:00"),
      row("old-magapoke", "magapoke", false, "2026-04-18T22:00:00+09:00")
    ];

    expect(
      sortFeedByDateThenSite(rows, ["jumpplus", "magapoke", "mangaone"], "Asia/Tokyo").map((item) => item.id)
    ).toEqual(["new-jump", "new-mangaone", "old-jump", "old-magapoke"]);
  });

  it("groups already sorted feed rows by timezone calendar date", () => {
    const rows = [
      row("late", "jumpplus", false, "2026-04-19T00:30:00+09:00"),
      row("previous", "jumpplus", false, "2026-04-18T23:30:00+09:00")
    ];

    expect(groupFeedByDate(rows, "Asia/Tokyo").map((group) => ({ key: group.key, ids: group.items.map((item) => item.id) }))).toEqual([
      {
        key: "2026-04-19",
        ids: ["late"]
      },
      {
        key: "2026-04-18",
        ids: ["previous"]
      }
    ]);
  });
});

function row(id: string, siteId: string, followed = false, date = baseDate.toISOString()) {
  const resolvedDate = new Date(date);
  return {
    id,
    siteId,
    followed,
    publishedAt: resolvedDate,
    firstSeenAt: resolvedDate
  };
}
