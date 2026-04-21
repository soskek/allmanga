import { load } from "cheerio";
import type { NormalizedRelease, NormalizedWork, SourceAdapter } from "@/lib/types";
import { fetchText } from "@/lib/sources/http";
import { normalizeRssPubDate, parseRssItems } from "@/lib/sources/helpers";
import { canonicalizeUrl, normalizeWhitespace, uniqBy } from "@/lib/utils";

const baseUrl = "https://shonenjumpplus.com";
const rssMediaBatchSize = 8;

function extractSeriesId(url: string) {
  const decodedUrl = (() => {
    try {
      return decodeURIComponent(url);
    } catch {
      return url;
    }
  })();
  const match = decodedUrl.match(
    /(?:series-thumbnail|series-sub-thumbnail-square-with-logo|series-sub-thumbnail-horizontal-with-logo)\/(\d+)/
  );
  return match?.[1];
}

function workUrlFromSeriesId(seriesId: string) {
  return `${baseUrl}/rss/series/${seriesId}`;
}

function parseListingPage(html: string, kind: "serial" | "oneshot", sourceType: "series_list" | "oneshot_list") {
  const $ = load(html);
  const works: NormalizedWork[] = [];
  const releases: NormalizedRelease[] = [];

  $("li.series-list-item").each((_, element) => {
    const anchor = $(element).find("a").first();
    const href = anchor.attr("href");
    const title = normalizeWhitespace(anchor.find(".series-list-title").first().text());
    const authors = normalizeWhitespace(anchor.find(".series-list-author").first().text());
    const imageUrl =
      anchor.find(".series-list-thumb img").attr("data-src") ?? anchor.find(".series-list-thumb img").attr("src") ?? "";
    const seriesId = extractSeriesId(imageUrl);

    if (!href || !title || !seriesId) {
      return;
    }

    const canonicalEpisodeUrl = canonicalizeUrl(href, baseUrl);
    const workCanonicalUrl = workUrlFromSeriesId(seriesId);
    const authorList = authors
      .split("/")
      .map((author) => normalizeWhitespace(author))
      .filter(Boolean);

    works.push({
      siteId: "jumpplus",
      canonicalUrl: workCanonicalUrl,
      title,
      authors: authorList,
      kind,
      status: "active"
    });

    if (kind === "serial") {
      releases.push({
        siteId: "jumpplus",
        canonicalUrl: workCanonicalUrl,
        workCanonicalUrl,
        title,
        rawTitle: title,
        sourceType,
        contentKind: "work",
        extra: {
          workTitle: title,
          authors: authorList,
          thumbnailUrl: imageUrl || null,
          previewThumbnailUrl: imageUrl || null
        }
      });
    }

    if (kind === "oneshot") {
      releases.push({
        siteId: "jumpplus",
        canonicalUrl: canonicalEpisodeUrl,
        workCanonicalUrl,
        title,
        rawTitle: title,
        sourceType,
        contentKind: "work",
        extra: {
          workTitle: title,
          authors: authorList,
          thumbnailUrl: imageUrl || null,
          previewThumbnailUrl: imageUrl || null
        }
      });
    }
  });

  return {
    works: uniqBy(works, (work) => work.canonicalUrl),
    releases: uniqBy(releases, (release) => release.canonicalUrl)
  };
}

function parseHomeReleases(html: string) {
  const $ = load(html);
  const works: NormalizedWork[] = [];
  const releases: NormalizedRelease[] = [];

  $("li.daily-series-item").each((_, element) => {
    const anchor = $(element).find("a").first();
    const href = anchor.attr("href");
    const title = normalizeWhitespace(anchor.find(".daily-series-title").first().text());
    const authors = normalizeWhitespace(anchor.find(".daily-series-author").first().text());
    const badge = normalizeWhitespace(anchor.find('[data-test-id="content-badge"]').first().text());
    const imageUrl =
      anchor.find(".daily-series-thumb-square").attr("src") ??
      anchor.find(".daily-series-thumb-square").attr("data-src") ??
      anchor.find(".daily-series-thumb-horizontal").attr("src") ??
      "";
    const seriesId = extractSeriesId(imageUrl);

    if (!href || !title) {
      return;
    }

    const canonicalUrl = canonicalizeUrl(href, baseUrl);
    const workCanonicalUrl = seriesId ? workUrlFromSeriesId(seriesId) : undefined;
    const authorList = authors
      .split("/")
      .map((author) => normalizeWhitespace(author))
      .filter(Boolean);

    if (workCanonicalUrl) {
      works.push({
        siteId: "jumpplus",
        canonicalUrl: workCanonicalUrl,
        title,
        authors: authorList,
        kind: "serial",
        status: "active"
      });

      releases.push({
        siteId: "jumpplus",
        canonicalUrl: workCanonicalUrl,
        workCanonicalUrl,
        title,
        rawTitle: title,
        sourceType: "series_list",
        contentKind: "work",
        extra: {
          workTitle: title,
          authors: authorList,
          thumbnailUrl: imageUrl || null
        }
      });
    }

    releases.push({
      siteId: "jumpplus",
      canonicalUrl,
      workCanonicalUrl,
      title: badge ? `[${badge}]${title}` : title,
      rawTitle: badge ? `[${badge}]${title}` : title,
      rawBadgeText: badge || undefined,
      sourceType: "rss",
      contentKind: "episode",
      extra: {
        workTitle: title,
        authors: authorList,
        thumbnailUrl: imageUrl || null,
        previewThumbnailUrl: imageUrl || null
      }
    });
  });

  return {
    works: uniqBy(works, (work) => work.canonicalUrl),
    releases: uniqBy(releases, (release) => release.canonicalUrl)
  };
}

async function parseRootRss(xml: string) {
  const items = parseRssItems(xml);
  const releases: NormalizedRelease[] = [];

  for (const item of items) {
    const title = normalizeWhitespace(typeof item.title === "string" ? item.title : "");
    const link = typeof item.link === "string" ? item.link : "";
    const publishedAt = normalizeRssPubDate(typeof item.pubDate === "string" ? item.pubDate : undefined);
    const workTitle = normalizeWhitespace(typeof item.description === "string" ? item.description : "");
    const author = normalizeWhitespace(typeof item.author === "string" ? item.author : "");

    if (!title || !link) {
      continue;
    }

    releases.push({
      siteId: "jumpplus",
      canonicalUrl: canonicalizeUrl(link, baseUrl),
      title,
      rawTitle: title,
      publishedAt,
      sourceType: "rss",
      contentKind: "episode",
      extra: {
        workTitle,
        authors: author ? author.split("/").map((value) => normalizeWhitespace(value)).filter(Boolean) : [],
        previewThumbnailUrl: null
      }
    });
  }

  const enriched = await enrichJumpplusRssReleases(releases);
  return uniqBy(enriched, (release) => release.canonicalUrl);
}

function mergeReleases(primary: NormalizedRelease[], secondary: NormalizedRelease[]) {
  const merged = new Map<string, NormalizedRelease>();

  for (const release of [...secondary, ...primary]) {
    const current = merged.get(release.canonicalUrl);
    merged.set(release.canonicalUrl, {
      ...current,
      ...release,
      extra: {
        ...(current?.extra ?? {}),
        ...(release.extra ?? {})
      },
      rawBadgeText: release.rawBadgeText ?? current?.rawBadgeText,
      workCanonicalUrl: release.workCanonicalUrl ?? current?.workCanonicalUrl,
      publishedAt: release.publishedAt ?? current?.publishedAt,
      title: release.title ?? current?.title,
      rawTitle: release.rawTitle ?? current?.rawTitle
    });
  }

  return [...merged.values()];
}

function linkJumpplusRssReleases(works: NormalizedWork[], releases: NormalizedRelease[]) {
  const keyed = new Map(
    works.map((work) => [
      normalizeWhitespace(work.title).toLowerCase(),
      {
        title: normalizeWhitespace(work.title).toLowerCase(),
        canonicalUrl: work.canonicalUrl
      }
    ])
  );

  return releases.map((release) => {
    if (release.workCanonicalUrl) {
      return release;
    }

    const rawWorkTitle =
      typeof release.extra?.workTitle === "string"
        ? normalizeWhitespace(release.extra.workTitle).toLowerCase()
        : "";
    const directMatch = rawWorkTitle ? keyed.get(rawWorkTitle) : undefined;
    if (directMatch) {
      return {
        ...release,
        workCanonicalUrl: directMatch.canonicalUrl
      };
    }

    const releaseTitle = normalizeWhitespace(release.title).toLowerCase();
    const fuzzyMatch = [...keyed.values()].find(
      (work) => work.title && (releaseTitle.includes(work.title) || work.title.includes(releaseTitle))
    );
    return fuzzyMatch
      ? {
          ...release,
          workCanonicalUrl: fuzzyMatch.canonicalUrl
        }
      : release;
  });
}

export const jumpplusAdapter: SourceAdapter = {
  siteId: "jumpplus",
  enabledByDefault: true,
  async sync() {
    const [seriesHtml, oneshotHtml, homeHtml, rssXml] = await Promise.all([
      fetchText(`${baseUrl}/series`),
      fetchText(`${baseUrl}/series/oneshot`),
      fetchText(baseUrl),
      fetchText(`${baseUrl}/rss`)
    ]);

    const serialListing = parseListingPage(seriesHtml, "serial", "series_list");
    const oneshotListing = parseListingPage(oneshotHtml, "oneshot", "oneshot_list");
    const homeData = parseHomeReleases(homeHtml);
    const rssReleases = await parseRootRss(rssXml);

    const works = uniqBy(
      [...serialListing.works, ...oneshotListing.works, ...homeData.works],
      (work) => work.canonicalUrl
    );
    const releases = linkJumpplusRssReleases(
      works,
      mergeReleases(rssReleases, [...serialListing.releases, ...homeData.releases, ...oneshotListing.releases])
    );

    return {
      works,
      releases,
      logs: [
        `jumpplus serialWorks=${serialListing.works.length}`,
        `jumpplus oneshotWorks=${oneshotListing.works.length}`,
        `jumpplus releases=${releases.length}`
      ]
    };
  }
};

async function enrichJumpplusRssReleases(releases: NormalizedRelease[]) {
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
            html.match(/<meta[^>]+name=["']thumbnail["'][^>]+content=["']([^"']+)/i);
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
