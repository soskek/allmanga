import { classifyRelease } from "@/lib/classifier";
import { fixtureReleases, fixtureWork } from "@/tests/fixtures/releases";

describe("semantic classifier", () => {
  it("classifies badge illustration with full confidence", () => {
    const result = classifyRelease({
      release: fixtureReleases.badgeIllustration,
      work: { ...fixtureWork, id: "work-1" }
    });
    expect(result.semanticKind).toBe("illustration");
    expect(result.semanticSignals).toContain("badge:イラスト");
  });

  it("detects hiatus illustration", () => {
    const result = classifyRelease({
      release: fixtureReleases.hiatusIllustration,
      work: { ...fixtureWork, id: "work-1" }
    });
    expect(result.semanticKind).toBe("hiatus_illustration");
  });

  it("prioritizes oneshot discovery for oneshot-list entries", () => {
    const result = classifyRelease({
      release: fixtureReleases.oneshot1,
      work: {
        id: "work-1",
        siteId: "sundaywebry",
        canonicalUrl: fixtureReleases.oneshot1.workCanonicalUrl!,
        title: "読切作品",
        authors: [],
        kind: "oneshot",
        status: "active"
      }
    });
    expect(result.semanticKind).toBe("oneshot_discovery");
  });

  it("treats news articles as announcements", () => {
    const result = classifyRelease({
      release: fixtureReleases.news,
      work: { ...fixtureWork, id: "work-1" }
    });
    expect(result.semanticKind).toBe("announcement");
  });
});
