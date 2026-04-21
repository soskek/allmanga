import { load } from "cheerio";
import type { NormalizedRelease, NormalizedWork, SourceAdapter } from "@/lib/types";
import { fetchText } from "@/lib/sources/http";
import { normalizeRssPubDate, parseRssItems } from "@/lib/sources/helpers";
import { canonicalizeUrl, normalizeWhitespace, uniqBy } from "@/lib/utils";

const baseUrl = "https://tonarinoyj.jp";
const rssMediaBatchSize = 8;

export const tonarinoyjAdapter: SourceAdapter = {
  siteId: "tonarinoyj",
  enabledByDefault: true,
  async sync() {
    const [seriesHtml, homeHtml, rssXml] = await Promise.all([fetchText(`${baseUrl}/series`), fetchText(baseUrl), fetchText(`${baseUrl}/rss`)]);
    const { works, releases } = parseTonarinoyjSeries(seriesHtml);
    const newsReleases = await enrichTonarinoyjNewsReleases(parseTonarinoyjNews(homeHtml));
    const rssReleases = await parseTonarinoyjRss(rssXml, works);

    return {
      works,
      releases: uniqBy(releases.concat(newsReleases, rssReleases), (release) => release.canonicalUrl),
      logs: [`tonarinoyj works=${works.length}`, `tonarinoyj releases=${releases.length + newsReleases.length + rssReleases.length}`]
    };
  }
};

function parseTonarinoyjSeries(html: string) {
  const $ = load(html);
  const works: NormalizedWork[] = [];
  const releases: NormalizedRelease[] = [];

  $(".subpage-table-list-item").each((_, element) => {
    const item = $(element);
    const title = normalizeWhitespace(item.find(".title").first().text());
    const authors = normalizeWhitespace(item.find(".author").first().text())
      .split("/")
      .map((author) => author.trim())
      .filter(Boolean);
    const thumbnailUrl =
      item.find("img").first().attr("data-src") ??
      item.find("img").first().attr("src") ??
      null;
    const firstHref = item.find(".link-first-episode a").first().attr("href");
    const latestHref = item.find(".link-latest a").first().attr("href");

    if (!title || !firstHref || !latestHref) {
      return;
    }

    const workCanonicalUrl = canonicalizeUrl(firstHref, baseUrl);
    const latestCanonicalUrl = canonicalizeUrl(latestHref, baseUrl);

    works.push({
      siteId: "tonarinoyj",
      canonicalUrl: workCanonicalUrl,
      title,
      authors,
      kind: "serial",
      status: "unknown"
    });

    releases.push({
      siteId: "tonarinoyj",
      canonicalUrl: `${workCanonicalUrl}/__cover`,
      workCanonicalUrl,
      title,
      rawTitle: title,
      sourceType: "series_list",
      contentKind: "work",
      extra: {
        workTitle: title,
        authors,
        descriptionText: normalizeWhitespace(item.find(".description").first().text()) || null,
        thumbnailUrl,
        previewThumbnailUrl: thumbnailUrl
      }
    });
  });

  return {
    works: uniqBy(works, (work) => work.canonicalUrl),
    releases: uniqBy(releases, (release) => release.canonicalUrl)
  };
}

async function enrichTonarinoyjNewsReleases(releases: NormalizedRelease[]) {
  const enriched: NormalizedRelease[] = [];

  for (let index = 0; index < releases.length; index += rssMediaBatchSize) {
    const batch = releases.slice(index, index + rssMediaBatchSize);
    const batchResults = await Promise.all(
      batch.map(async (release) => {
        if (typeof release.extra?.previewThumbnailUrl === "string") {
          return release;
        }

        try {
          const html = await fetchText(release.canonicalUrl);
          const previewThumbnailUrl =
            html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i)?.[1] ??
            html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1] ??
            html.match(/<meta[^>]+name=["']thumbnail["'][^>]+content=["']([^"']+)/i)?.[1] ??
            null;

          if (!previewThumbnailUrl) {
            return release;
          }

          return {
            ...release,
            extra: {
              ...(release.extra ?? {}),
              previewThumbnailUrl: canonicalizeUrl(previewThumbnailUrl, baseUrl)
            }
          };
        } catch {
          return release;
        }
      })
    );

    enriched.push(...batchResults);
  }

  return enriched;
}

function parseTonarinoyjNews(html: string) {
  const $ = load(html);
  const releases: NormalizedRelease[] = [];

  $('a[href*="/article/entry/"]').each((_, element) => {
    const root = $(element).closest(".archive-entry, .entry, article, li");
    const title = normalizeWhitespace($(element).text());
    const href = $(element).attr("href");
    if (!href || !title) {
      return;
    }

    releases.push({
      siteId: "tonarinoyj",
      canonicalUrl: canonicalizeUrl(href, baseUrl),
      title,
      rawTitle: title,
      sourceType: "news",
      contentKind: "article",
      extra: {
        thumbnailUrl:
          root.find(".entry-thumb img, .archive-entry .entry-thumb img").first().attr("data-src") ??
          root.find(".entry-thumb img, .archive-entry .entry-thumb img").first().attr("src") ??
          null,
        previewThumbnailUrl:
          root.find(".entry-thumb img, .archive-entry .entry-thumb img").first().attr("data-src") ??
          root.find(".entry-thumb img, .archive-entry .entry-thumb img").first().attr("src") ??
          null
      }
    });
  });

  return uniqBy(releases, (release) => release.canonicalUrl);
}

async function parseTonarinoyjRss(xml: string, works: Array<{ canonicalUrl: string; title: string }>) {
  const workMap = new Map(works.map((work) => [normalizeWhitespace(work.title), work.canonicalUrl]));
  const items = parseRssItems(xml);
  const releases: NormalizedRelease[] = [];
  for (const item of items) {
    const link = typeof item.link === "string" ? item.link : "";
    const title = normalizeWhitespace(typeof item.title === "string" ? item.title : "");
    const workTitle = normalizeWhitespace(typeof item.description === "string" ? item.description : "");
    const author = normalizeWhitespace(typeof item.author === "string" ? item.author : "");
    const enclosure = item.enclosure as { "@_url"?: string } | undefined;
    if (!link || !title || !workTitle) {
      continue;
    }

    releases.push({
      siteId: "tonarinoyj",
      canonicalUrl: canonicalizeUrl(link, baseUrl),
      workCanonicalUrl: workMap.get(workTitle),
      title,
      rawTitle: title,
      publishedAt: normalizeRssPubDate(typeof item.pubDate === "string" ? item.pubDate : undefined),
      sourceType: "rss",
      contentKind: "episode",
      extra: {
        workTitle,
        authors: author ? author.split("/").map((value) => normalizeWhitespace(value)).filter(Boolean) : [],
        thumbnailUrl: enclosure?.["@_url"] ?? null,
        previewThumbnailUrl: enclosure?.["@_url"] ?? null
      }
    });
  }

  return uniqBy(await enrichTonarinoyjRssReleases(releases), (release) => release.canonicalUrl);
}

async function enrichTonarinoyjRssReleases(releases: NormalizedRelease[]) {
  const enriched: NormalizedRelease[] = [];

  for (let index = 0; index < releases.length; index += rssMediaBatchSize) {
    const batch = releases.slice(index, index + rssMediaBatchSize);
    const batchResults = await Promise.all(
      batch.map(async (release) => {
        try {
          const html = await fetchText(release.canonicalUrl);
          const episodeMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i);
          const workMatch =
            html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) ??
            html.match(/<img[^>]+class=["'][^"']*series-header-image[^"']*["'][^>]+data-src=["']([^"']+)/i);

          const thumbnailUrl = episodeMatch?.[1] ? canonicalizeUrl(episodeMatch[1]) : null;
          const workThumbnailUrl = workMatch?.[1] ? canonicalizeUrl(workMatch[1]) : null;

          if (!thumbnailUrl && !workThumbnailUrl) {
            return release;
          }

          return {
            ...release,
            extra: {
              ...(release.extra ?? {}),
              thumbnailUrl: thumbnailUrl ?? release.extra?.thumbnailUrl ?? null,
              workThumbnailUrl:
                workThumbnailUrl && workThumbnailUrl !== thumbnailUrl ? workThumbnailUrl : release.extra?.workThumbnailUrl ?? null,
              previewThumbnailUrl:
                thumbnailUrl ??
                (typeof release.extra?.previewThumbnailUrl === "string" ? release.extra.previewThumbnailUrl : null)
            }
          };
        } catch {
          return release;
        }
      })
    );

    enriched.push(...batchResults);
  }

  return enriched;
}
