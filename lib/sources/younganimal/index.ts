import { load } from "cheerio";
import type { NormalizedRelease, NormalizedWork, SourceAdapter } from "@/lib/types";
import { fetchText } from "@/lib/sources/http";
import { normalizeRssPubDate, parseRssItems } from "@/lib/sources/helpers";
import { canonicalizeUrl, isGenericContentTitle, normalizeWhitespace, uniqBy } from "@/lib/utils";

const baseUrl = "https://younganimal.com";
const seriesListBase = `${baseUrl}/series/list/up`;
const seriesPageCount = 7;
const rssBatchSize = 6;

export const younganimalAdapter: SourceAdapter = {
  siteId: "younganimal",
  enabledByDefault: true,
  async sync() {
    const homeHtml = await fetchText(baseUrl);
    const listPages = await Promise.all(
      Array.from({ length: seriesPageCount }, (_, index) => fetchText(`${seriesListBase}/${index + 1}`))
    );
    const works = uniqBy(
      [parseYoungAnimalHomeUpdatedWorks(homeHtml), ...listPages.map((html) => parseYoungAnimalWorks(html))].flat(),
      (work) => work.canonicalUrl
    );
    const releases = await fetchYoungAnimalLatestReleases(works, homeHtml);

    return {
      works,
      releases,
      logs: [`younganimal works=${works.length}`, `younganimal releases=${releases.length}`]
    };
  }
};

function parseYoungAnimalWorks(html: string): NormalizedWork[] {
  const $ = load(html);
  return uniqBy(
    $(".series-list-item")
      .map((_, element) => {
        const root = $(element);
        const href = root.find('a[href^="/series/"]').first().attr("href");
        const title = normalizeWhitespace(root.find('[data-e2e="sliTitle"]').first().text());
        if (!href || !title || title.includes("グラビア") || isGenericContentTitle(title)) {
          return null;
        }

        const authors = root
          .find(".series-list-item-author-link")
          .map((__, authorElement) => normalizeAuthor($(authorElement).text()))
          .get()
          .filter(Boolean);

        return {
          siteId: "younganimal" as const,
          canonicalUrl: canonicalizeUrl(href, baseUrl),
          title,
          authors,
          kind: "serial" as const,
          status: "unknown" as const
        };
      })
      .get()
      .filter(Boolean),
    (work) => work.canonicalUrl
  );
}

function parseYoungAnimalHomeUpdatedWorks(html: string): NormalizedWork[] {
  const $ = load(html);
  return uniqBy(
    $(".home-series-tile-item")
      .map((_, element) => {
        const root = $(element);
        const rankingLabel = normalizeWhitespace(root.find(".home-series-tile-item-link").first().text());
        if (!rankingLabel.startsWith("更新")) {
          return null;
        }

        const href = root.find('a[href^="/series/"]').first().attr("href");
        const title = normalizeWhitespace(root.find('[data-e2e="sliTitle"]').first().text());
        if (!href || !title || title.includes("グラビア") || isGenericContentTitle(title)) {
          return null;
        }

        const authors = root
          .find(".home-series-tile-item-author-link")
          .map((__, authorElement) => normalizeAuthor($(authorElement).text()))
          .get()
          .filter(Boolean);

        return {
          siteId: "younganimal" as const,
          canonicalUrl: canonicalizeUrl(href, baseUrl),
          title,
          authors,
          kind: "serial" as const,
          status: "unknown" as const
        };
      })
      .get()
      .filter(Boolean),
    (work) => work.canonicalUrl
  );
}

async function fetchYoungAnimalLatestReleases(works: NormalizedWork[], homeHtml: string) {
  const releases: NormalizedRelease[] = [];
  const highlightedWorks = parseYoungAnimalHomeUpdatedWorks(homeHtml);

  for (let index = 0; index < works.length; index += rssBatchSize) {
    const batch = works.slice(index, index + rssBatchSize);
    const batchResults = await Promise.all(
      batch.map(async (work) => {
        try {
          const rssXml = await fetchText(`${work.canonicalUrl}/rss`);
          const item = parseRssItems(rssXml)[0];
          if (!item || typeof item.link !== "string" || typeof item.title !== "string") {
            return null;
          }

          return {
            siteId: "younganimal" as const,
            canonicalUrl: canonicalizeUrl(item.link),
            workCanonicalUrl: work.canonicalUrl,
            title: normalizeWhitespace(item.title),
            rawTitle: normalizeWhitespace(item.title),
            publishedAt: normalizeRssPubDate(typeof item.pubDate === "string" ? item.pubDate : undefined),
            sourceType: "rss" as const,
            contentKind: "episode" as const,
            extra: {
              workTitle: work.title
            }
          };
        } catch {
          return null;
        }
      })
    );

    for (const release of batchResults) {
      if (release) {
        releases.push(release);
      }
    }
  }

  const highlightedResults = await Promise.all(
    highlightedWorks.map(async (work) => {
      try {
        const seriesHtml = await fetchText(work.canonicalUrl);
        return parseYoungAnimalSeriesLatestRelease(seriesHtml, work);
      } catch {
        return null;
      }
    })
  );

  for (const release of highlightedResults) {
    if (release) {
      releases.push(release);
    }
  }

  const dedupedByUrl = new Map<string, NormalizedRelease>();
  for (const release of releases) {
    const existing = dedupedByUrl.get(release.canonicalUrl);
    if (!existing) {
      dedupedByUrl.set(release.canonicalUrl, release);
      continue;
    }

    if (existing.sourceType === "rss" && release.sourceType === "work_page") {
      dedupedByUrl.set(release.canonicalUrl, release);
    }
  }

  return [...dedupedByUrl.values()];
}

function parseYoungAnimalSeriesLatestRelease(html: string, work: NormalizedWork): NormalizedRelease | null {
  const $ = load(html);
  const latestLink = $("a.series-eplist-item-link").last();
  const href = latestLink.attr("href");
  const rawText = normalizeWhitespace(latestLink.text()).replace(/\s+/g, "");
  if (!href || !rawText) {
    return null;
  }

  const title = parseYoungAnimalEpisodeTitle(rawText);
  const publishedAt = parseYoungAnimalEpisodeDate(rawText);
  const releaseThumbnailUrl =
    pickFirst([
      html.match(/https:\/\/cdn-public\.comici\.jp\/book\/\d+\/\d+_thumbnail(?:-lg|-sm|-th)?\.webp/i)?.[0],
      latestLink.find("img").first().attr("src"),
      latestLink.find("img").first().attr("data-src")
    ]) ?? undefined;
  const workThumbnailUrl =
    pickFirst([
      html.match(/https:\/\/cdn-public\.comici\.jp\/series\/\d+\/[^"' ]+\.(?:png|webp)/i)?.[0],
      $('meta[property="og:image"]').attr("content"),
      $('meta[name="twitter:image"]').attr("content")
    ]) ?? undefined;

  return {
    siteId: "younganimal",
    canonicalUrl: canonicalizeUrl(href, baseUrl),
    workCanonicalUrl: work.canonicalUrl,
    title,
    rawTitle: rawText,
    publishedAt,
    sourceType: "work_page",
    contentKind: "episode",
    extra: {
      workTitle: work.title,
      authors: work.authors,
      thumbnailUrl: releaseThumbnailUrl,
      workThumbnailUrl,
      previewThumbnailUrl: releaseThumbnailUrl ?? workThumbnailUrl
    }
  };
}

function pickFirst(values: Array<string | undefined | null>) {
  for (const value of values) {
    if (value) {
      return canonicalizeUrl(value, baseUrl);
    }
  }
  return undefined;
}

function normalizeAuthor(value: string) {
  return normalizeWhitespace(value.replace(/^(漫画|原作|作画|構成|キャラクター原案)\//, ""));
}

function parseYoungAnimalEpisodeTitle(value: string) {
  const dateMatch = value.match(/\d{4}\/\d{2}\/\d{2}/);
  if (!dateMatch) {
    return value;
  }
  return value.slice(0, dateMatch.index).trim() || value;
}

function parseYoungAnimalEpisodeDate(value: string) {
  const dateMatch = value.match(/\d{4}\/\d{2}\/\d{2}/);
  if (!dateMatch) {
    return undefined;
  }
  const [year, month, day] = dateMatch[0].split("/").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}
