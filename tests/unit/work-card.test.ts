import { aggregateWorkCards } from "@/lib/work-card";

describe("work card aggregation", () => {
  it("groups releases by work and counts semantic kinds", () => {
    const cards = aggregateWorkCards([
      {
        workId: "w1",
        title: "作品A",
        canonicalUrl: "https://example.com/a",
        releaseCanonicalUrl: "https://example.com/a/1",
        siteId: "jumpplus",
        authors: '["作者"]',
        pin: true,
        priority: 2,
        releaseId: "r1",
        semanticKind: "main_episode",
        state: "unread",
        lane: "today",
        publishedAt: new Date("2026-04-14T10:00:00+09:00"),
        firstSeenAt: new Date("2026-04-14T10:00:00+09:00")
      },
      {
        workId: "w1",
        title: "作品A",
        canonicalUrl: "https://example.com/a",
        releaseCanonicalUrl: "https://example.com/a/2",
        siteId: "jumpplus",
        authors: '["作者"]',
        pin: true,
        priority: 2,
        releaseId: "r2",
        semanticKind: "illustration",
        state: "opened",
        lane: "archived",
        publishedAt: new Date("2026-04-14T11:00:00+09:00"),
        firstSeenAt: new Date("2026-04-14T11:00:00+09:00")
      }
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0].unreadMainCount).toBe(1);
    expect(cards[0].counts.illustration).toBe(1);
    expect(cards[0].openUrl).toBe("https://example.com/a/1");
  });
});
