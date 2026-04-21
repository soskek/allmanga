import { afterEach, describe, expect, it, vi } from "vitest";

describe("ynjn adapter sync bounds", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.doUnmock("@/lib/sources/http");
  });

  it("limits thumbnail fetches, title episode fetches, and episodes persisted per title", async () => {
    vi.stubEnv("YNJN_THUMBNAIL_SYNC_LIMIT", "1");
    vi.stubEnv("YNJN_EPISODE_SYNC_LIMIT", "2");
    vi.stubEnv("YNJN_EPISODES_PER_TITLE_LIMIT", "2");

    const episodeTitleIds: number[] = [];
    const fetchJson = vi.fn(async (url: string) => {
      if (url.endsWith("/labels")) {
        return {
          data: {
            labels: [{ id: 1, name: "連載" }]
          }
        };
      }
      if (url.endsWith("/title/value/FREE")) {
        return {
          data: {
            values: [{ id: 10, value: "読切" }]
          }
        };
      }
      if (url.includes("category=LABEL")) {
        return {
          data: {
            titles: [
              { id: 101, name: "連載A" },
              { id: 102, name: "連載B" },
              { id: 103, name: "連載C" }
            ]
          }
        };
      }
      if (url.includes("category=FREE")) {
        return {
          data: {
            titles: [{ id: 201, name: "読切D" }]
          }
        };
      }

      const titleId = Number(url.match(/\/title\/(\d+)\/episode/)?.[1]);
      episodeTitleIds.push(titleId);
      return {
        data: {
          episodes: Array.from({ length: 5 }, (_, index) => ({
            id: titleId * 100 + index,
            name: `第${index + 1}話`,
            image_url: `https://public.ynjn.jp/episode/${titleId}_${index + 1}.jpg`,
            is_viewer_transition: true
          }))
        }
      };
    });
    const fetchText = vi.fn(async (url: string) => {
      const titleId = url.match(/\/title\/(\d+)/)?.[1] ?? "unknown";
      return `<meta property="og:image" content="https://public.ynjn.jp/comic/${titleId}_cover.jpg">`;
    });

    vi.doMock("@/lib/sources/http", () => ({
      fetchJson,
      fetchText
    }));

    const { ynjnAdapter } = await import("@/lib/sources/ynjn");
    const result = await ynjnAdapter.sync();

    expect(result.works.map((work) => work.title)).toEqual(["連載A", "連載B", "連載C", "読切D"]);
    expect(fetchText).toHaveBeenCalledTimes(1);
    expect(fetchText).toHaveBeenCalledWith("https://ynjn.jp/title/101");
    expect(episodeTitleIds).toEqual([101, 102]);
    expect(result.releases.filter((release) => release.contentKind === "episode")).toHaveLength(4);
    expect(
      result.releases.filter((release) => release.contentKind === "episode" && release.canonicalUrl.includes("/103"))
    ).toHaveLength(0);
    expect(result.logs).toContain("ynjn thumbnails limited=1/4");
    expect(result.logs).toContain("ynjn episodes limited=2/4");
    expect(result.logs).toContain("ynjn episodes:101 count=2/5");
    expect(result.logs).toContain("ynjn episodes:102 count=2/5");
  });
});
