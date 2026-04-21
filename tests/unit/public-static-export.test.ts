import { describe, expect, it } from "vitest";

import { createHtml, safeJson } from "@/scripts/export-public-static";

describe("public static export", () => {
  it("escapes embedded JSON so release metadata cannot break out into script tags", () => {
    const payload = {
      generatedAt: "2026-04-21T00:00:00.000Z",
      recent: [
        {
          id: "release-1",
          workTitle: '<script>alert("x")</script>',
          authors: JSON.stringify(["作者"]),
          siteName: "少年ジャンプ＋",
          semanticKind: "main_episode",
          title: "第1話",
          publishedAt: new Date("2026-04-21T00:00:00.000Z"),
          officialUrl: "https://example.com/episode/1"
        }
      ],
      discover: []
    };

    const html = createHtml(payload);

    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain("\\u003cscript");
    expect(html).toContain("localStorage");
    expect(html).toContain("allmanga-public-follows-v1");
    expect(html).toContain("フォロー中");
    expect(html).toContain("densityToggle");
  });

  it("keeps the static public page metadata-only", () => {
    const html = createHtml({
      generatedAt: "2026-04-21T00:00:00.000Z",
      recent: [],
      discover: []
    });

    expect(html).not.toContain("<img");
    expect(html).not.toContain("thumbnail");
    expect(html).not.toContain("readAt");
    expect(html).not.toContain("priority");
  });

  it("escapes HTML-breaking characters in safeJson", () => {
    expect(safeJson({ value: "<>&" })).toBe('{"value":"\\u003c\\u003e\\u0026"}');
  });
});
