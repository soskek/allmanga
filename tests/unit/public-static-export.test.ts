import { describe, expect, it } from "vitest";

import { buildCssGridBreakpoints, fontFamilySansCss, pageMaxWidthPx } from "@/lib/design-tokens";
import { createHtml, mergePublicHomeView, safeJson } from "@/scripts/export-public-static";

describe("public static export", () => {
  it("escapes embedded JSON so release metadata cannot break out into script tags", () => {
    const payload = {
      generatedAt: "2026-04-21T00:00:00.000Z",
      lastSyncedAt: "2026-04-21T00:00:00.000Z",
      hiddenCount: 0,
      hiddenBreakdown: { promotion: 0, announcement: 0 },
      today: [card({ title: '<script>alert("x")</script>' })],
      recentGroups: [],
      discover: []
    };

    const html = createHtml(payload);

    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain("\\u003cscript");
    expect(html).toContain("localStorage");
    expect(html).toContain("allmanga-public-follows-v1");
    expect(html).toContain("フォロー中");
    expect(html).not.toContain("densityToggle");
  });

  it("keeps the static public page metadata-only", () => {
    const html = createHtml({
      generatedAt: "2026-04-21T00:00:00.000Z",
      lastSyncedAt: null,
      hiddenCount: 0,
      hiddenBreakdown: { promotion: 0, announcement: 0 },
      today: [],
      recentGroups: [],
      discover: []
    });

    expect(html).not.toContain("thumbnail");
    expect(html).not.toContain("readAt");
    expect(html).not.toContain("priority");
    expect(html).toContain("publicSiteDock");
    expect(html).toContain("apple-touch-icon");
  });

  it("embeds crawler-facing context without adding analytics", () => {
    const html = createHtml({
      generatedAt: "2026-04-21T00:00:00.000Z",
      lastSyncedAt: null,
      hiddenCount: 0,
      hiddenBreakdown: { promotion: 0, announcement: 0 },
      today: [],
      recentGroups: [],
      discover: []
    });

    expect(html).toContain("公式Webマンガサイトの更新・読切・新連載");
    expect(html).toContain('property="og:description"');
    expect(html).toContain('type="application/ld+json"');
    expect(html).not.toContain("googletagmanager");
    expect(html).not.toContain("google-analytics");
  });

  it("lets static public users export and import local follow state", () => {
    const html = createHtml({
      generatedAt: "2026-04-21T00:00:00.000Z",
      lastSyncedAt: null,
      hiddenCount: 0,
      hiddenBreakdown: { promotion: 0, announcement: 0 },
      today: [],
      recentGroups: [],
      discover: []
    });

    expect(html).toContain('id="exportFollows"');
    expect(html).toContain('id="importFollowsFile"');
    expect(html).toContain("allmanga-follows-");
    expect(html).toContain("フォローJSONの形式が違います");
  });

  it("uses shared app density tokens for the standalone public layout", () => {
    const html = createHtml({
      generatedAt: "2026-04-21T00:00:00.000Z",
      lastSyncedAt: null,
      hiddenCount: 0,
      hiddenBreakdown: { promotion: 0, announcement: 0 },
      today: [],
      recentGroups: [],
      discover: []
    });

    expect(html).toContain(`font-family: ${fontFamilySansCss}`);
    expect(html).toContain(`width: min(${pageMaxWidthPx}px, calc(100% - 16px))`);
    expect(html).toContain(buildCssGridBreakpoints(".publicGrid", "default"));
    expect(html).not.toContain("auto-fill");
  });

  it("adds an inline jump to the full discover list after the public preview", () => {
    const html = createHtml({
      generatedAt: "2026-04-21T00:00:00.000Z",
      lastSyncedAt: "2026-04-21T00:00:00.000Z",
      hiddenCount: 0,
      hiddenBreakdown: { promotion: 0, announcement: 0 },
      today: [],
      recentGroups: [],
      discover: Array.from({ length: 31 }, (_, index) =>
        card({
          id: `discover-${index}`,
          key: `jumpplus::discover-${index}`,
          title: `読切${index}`
        })
      )
    });

    expect(html).toContain("発見一覧へ");
    expect(html).toContain("さらに1件 / 全31件");
    expect(html).toContain('data-public-tab="discover"');
  });

  it("does not show first-seen dates as public discovery dates", () => {
    const html = createHtml({
      generatedAt: "2026-01-01T00:00:00.000Z",
      lastSyncedAt: "2026-01-01T00:00:00.000Z",
      hiddenCount: 0,
      hiddenBreakdown: { promotion: 0, announcement: 0 },
      today: [],
      recentGroups: [],
      discover: [
        card({
          publishedAt: null,
          firstSeenAt: "2026-04-21T00:00:00.000Z",
          title: "日付なし読切"
        })
      ]
    });

    expect(html).not.toContain(">04/21<");
  });

  it("rolls previous static updates into the recent seven-day window", () => {
    const merged = mergePublicHomeView(
      {
        generatedAt: "2026-04-21T03:00:00.000Z",
        lastSyncedAt: "2026-04-21T03:00:00.000Z",
        hiddenCount: 0,
        hiddenBreakdown: { promotion: 0, announcement: 0 },
        today: [card({ title: "今日の更新", publishedAt: "2026-04-21T01:30:00.000Z" })],
        recentGroups: [
          {
            key: "2026-04-20",
            label: "4/20(月)",
            items: [card({ id: "current-recent", key: "jumpplus::current-recent", title: "現在DBの昨日", publishedAt: "2026-04-20T09:00:00.000Z" })]
          }
        ],
        discover: []
      },
      {
        generatedAt: "2026-04-20T03:00:00.000Z",
        lastSyncedAt: "2026-04-20T03:00:00.000Z",
        hiddenCount: 0,
        hiddenBreakdown: { promotion: 0, announcement: 0 },
        today: [card({ id: "prev-today", key: "jumpplus::prev-today", title: "前回の今日", publishedAt: "2026-04-20T02:00:00.000Z" })],
        recentGroups: [
          {
            key: "2026-04-19",
            label: "4/19(日)",
            items: [card({ id: "prev-recent", key: "jumpplus::prev-recent", title: "前回の一昨日", publishedAt: "2026-04-19T02:00:00.000Z" })]
          },
          {
            key: "2026-04-13",
            label: "4/13(月)",
            items: [card({ id: "too-old", key: "jumpplus::too-old", title: "古すぎる更新", publishedAt: "2026-04-13T02:00:00.000Z" })]
          }
        ],
        discover: []
      }
    );

    expect(merged.recentGroups.flatMap((group) => group.items.map((item) => item.title))).toEqual([
      "現在DBの昨日",
      "前回の今日",
      "前回の一昨日"
    ]);
    expect(merged.recentGroups.flatMap((group) => group.items.map((item) => item.title))).not.toContain("今日の更新");
    expect(merged.recentGroups.flatMap((group) => group.items.map((item) => item.title))).not.toContain("古すぎる更新");
  });

  it("escapes HTML-breaking characters in safeJson", () => {
    expect(safeJson({ value: "<>&" })).toBe('{"value":"\\u003c\\u003e\\u0026"}');
  });
});

function card(overrides = {}) {
  const id = "id" in overrides ? String(overrides.id) : "release-1";
  return {
    id,
    key: "jumpplus::work-1",
    siteId: "jumpplus",
    siteName: "少年ジャンプ＋",
    siteMark: "J+",
    siteAccent: "#dc2626",
    title: "第1話",
    authors: JSON.stringify(["作者"]),
    semanticKind: "main_episode",
    publishedAt: "2026-04-21T00:00:00.000Z",
    firstSeenAt: "2026-04-21T00:00:00.000Z",
    officialUrl: `https://example.com/episode/${id}`,
    ...overrides
  };
}
