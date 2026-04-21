import { load } from "cheerio";
import type { NormalizedRelease, NormalizedWork, SourceAdapter } from "@/lib/types";
import { fetchText } from "@/lib/sources/http";
import { linkReleasesToWorks, normalizeRssPubDate, parseRssItems } from "@/lib/sources/helpers";
import { canonicalizeUrl, normalizeWhitespace, uniqBy } from "@/lib/utils";

const baseUrl = "https://www.sunday-webry.com";
const blogUrl = "https://blog.www.sunday-webry.com";
const rssMediaBatchSize = 6;

export const sundaywebryAdapter: SourceAdapter = {
  siteId: "sundaywebry",
  enabledByDefault: true,
  async sync() {
    const [seriesHtml, oneshotHtml, homeHtml, blogHtml, rssXml] = await Promise.all([
      fetchText(`${baseUrl}/series`),
      fetchText(`${baseUrl}/series/oneshot`),
      fetchText(baseUrl),
      fetchText(blogUrl),
      fetchText(`${baseUrl}/rss`)
    ]);

    const serial = parseWebrySeriesCards(seriesHtml, "serial", "series_list");
    const oneshots = parseWebrySeriesCards(oneshotHtml, "oneshot", "oneshot_list");
    const works = uniqBy(serial.works.concat(oneshots.works), (work) => work.canonicalUrl);
    const titleToWork = new Map(works.map((work) => [work.title, work]));
    const rssReleases = await parseWebryRss(rssXml, titleToWork);
    const discoveryReleases = await enrichWebryDiscoveryReleases(
      parseWebryDiscovery(homeHtml, "category_list").concat(parseWebryDiscovery(blogHtml, "news"))
    );
    const mergedReleases = mergeReleasesByCanonical([
      ...serial.releases,
      ...oneshots.releases,
      ...discoveryReleases,
      ...rssReleases
    ]);
    const enrichedReleases = await enrichWebryReleaseThumbnails(mergedReleases);
    const releases = linkReleasesToWorks(works, enrichedReleases);

    return {
      works,
      releases,
      logs: [`sundaywebry works=${works.length}`, `sundaywebry releases=${releases.length}`]
    };
  }
};

function parseWebrySeriesCards(
  html: string,
  kind: "serial" | "oneshot",
  sourceType: "series_list" | "oneshot_list"
) {
  const $ = load(html);
  const works = new Map<string, NormalizedWork>();
  const releases = new Map<string, NormalizedRelease>();

  $(".webry-series-item-link").each((_, element) => {
    const card = $(element);
    const linkWrapper = card.nextAll(".episode-link-wrapper").first();
    const title = normalizeWhitespace(card.find(".series-title").first().text());
    if (!title) {
      return;
    }

    const authors = normalizeWhitespace(card.find(".author").first().text())
      .split("/")
      .map((author) => author.trim())
      .filter(Boolean);
    const thumbnailUrl =
      card.find("img").first().attr("data-src") ??
      card.find("img").first().attr("src") ??
      null;
    const firstHref =
      linkWrapper.find(".episode-link.first").first().attr("href") ||
      $(element).attr("href");
    const latestHref =
      linkWrapper.find(".episode-link.test-series-read-latest").first().attr("href") ||
      $(element).attr("href");

    if (!firstHref || !latestHref) {
      return;
    }

    const workCanonicalUrl = canonicalizeUrl(firstHref, baseUrl);
    const latestCanonicalUrl = canonicalizeUrl(latestHref, baseUrl);
    const publishedAt = normalizeWebryDate(card.find(".series-badge").first().attr("data-datetime"));

    works.set(workCanonicalUrl, {
      siteId: "sundaywebry",
      canonicalUrl: workCanonicalUrl,
      title,
      authors,
      kind,
      status: "unknown"
    });

    releases.set(latestCanonicalUrl, {
      siteId: "sundaywebry",
      canonicalUrl: latestCanonicalUrl,
      workCanonicalUrl,
      title,
      rawTitle: title,
      publishedAt,
      sourceType,
      contentKind: "episode",
      extra: {
        authors,
        labelName: normalizeWhitespace(card.find(".label").first().text()) || null,
        thumbnailUrl,
        previewThumbnailUrl: thumbnailUrl
      }
    });
  });

  return {
    works: [...works.values()],
    releases: [...releases.values()]
  };
}

function parseWebryDiscovery(html: string, sourceType: "category_list" | "news") {
  const $ = load(html);
  const releases = new Map<string, { siteId: string; canonicalUrl: string; workCanonicalUrl?: string; title?: string; rawTitle?: string; sourceType: "category_list" | "news"; contentKind: "work" | "article" }>();
  $('a[href]').each((_, element) => {
    const title = normalizeWhitespace($(element).text());
    const href = $(element).attr("href");
    if (!href || !title) {
      return;
    }
    if (!title.includes("新連載") && !title.includes("読切") && !title.includes("読み切り") && !title.includes("特集")) {
      return;
    }
    const canonicalUrl = canonicalizeUrl(href, sourceType === "news" ? blogUrl : baseUrl);
    releases.set(canonicalUrl, {
      siteId: "sundaywebry",
      canonicalUrl,
      title,
      rawTitle: title,
      sourceType,
      contentKind: sourceType === "news" ? "article" : "work"
    });
  });
  return [...releases.values()];
}

async function parseWebryRss(xml: string, titleToWork: Map<string, NormalizedWork>) {
  const items = parseRssItems(xml);
  const releases: NormalizedRelease[] = [];

  for (const item of items) {
    const link = typeof item.link === "string" ? item.link : "";
    const title = typeof item.title === "string" ? normalizeWhitespace(item.title) : "";
    const workTitle = typeof item.description === "string" ? normalizeWhitespace(item.description) : "";
    if (!link || !title || !workTitle) {
      continue;
    }

    const matchedWork = titleToWork.get(workTitle);
    releases.push({
      siteId: "sundaywebry",
      canonicalUrl: canonicalizeUrl(link),
      workCanonicalUrl: matchedWork?.canonicalUrl,
      title,
      rawTitle: title,
      publishedAt: normalizeRssPubDate(typeof item.pubDate === "string" ? item.pubDate : undefined),
      sourceType: "rss",
      contentKind: "episode",
      extra: {
        workTitle,
        authorName: typeof item.author === "string" ? normalizeWhitespace(item.author) : null,
        previewThumbnailUrl: null
      }
    });
  }

  const enriched = await enrichWebryRssReleases(releases);
  return enriched;
}

async function enrichWebryRssReleases(releases: NormalizedRelease[]) {
  return enrichWebryReleaseThumbnails(releases);
}

async function enrichWebryDiscoveryReleases(releases: NormalizedRelease[]) {
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
          const { episodeThumbnailUrl, workThumbnailUrl } = extractWebryImageUrls(html);
          const previewThumbnailUrl = episodeThumbnailUrl ?? workThumbnailUrl;

          if (!previewThumbnailUrl) {
            return release;
          }

          return {
            ...release,
            extra: {
              ...(release.extra ?? {}),
              previewThumbnailUrl
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

async function enrichWebryReleaseThumbnails(releases: NormalizedRelease[]) {
  const enriched: NormalizedRelease[] = [];
  const imageCache = new Map<string, { episodeThumbnailUrl: string | null; workThumbnailUrl: string | null }>();

  for (let index = 0; index < releases.length; index += rssMediaBatchSize) {
    const batch = releases.slice(index, index + rssMediaBatchSize);
    const batchResults = await Promise.all(
      batch.map(async (release) => {
        if (typeof release.extra?.thumbnailUrl === "string" && typeof release.extra?.workThumbnailUrl === "string") {
          return release;
        }

        try {
          const targetUrl = release.canonicalUrl;
          const cached = imageCache.get(targetUrl);
          const imagePayload =
            cached ??
            (async () => {
              const html = await fetchText(targetUrl);
              const imageUrls = extractWebryImageUrls(html);
              imageCache.set(targetUrl, imageUrls);
              return imageUrls;
            })();

          const { episodeThumbnailUrl, workThumbnailUrl } = await imagePayload;
          if (!episodeThumbnailUrl && !workThumbnailUrl) {
            return release;
          }
          return {
            ...release,
            extra: {
              ...(release.extra ?? {}),
              thumbnailUrl: episodeThumbnailUrl ?? release.extra?.thumbnailUrl ?? null,
              workThumbnailUrl:
                workThumbnailUrl && workThumbnailUrl !== episodeThumbnailUrl ? workThumbnailUrl : release.extra?.workThumbnailUrl ?? null,
              previewThumbnailUrl:
                episodeThumbnailUrl ??
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

function extractWebryImageUrls(html: string) {
  const episodeMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i);
  const workMatch =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) ??
    html.match(/<meta[^>]+name=["']thumbnail["'][^>]+content=["']([^"']+)/i) ??
    html.match(/<img[^>]+class=["'][^"']*series-header-image[^"']*["'][^>]+data-src=["']([^"']+)/i);

  const episodeThumbnailUrl = episodeMatch?.[1] ? canonicalizeUrl(episodeMatch[1]) : null;
  const workThumbnailUrl = workMatch?.[1] ? canonicalizeUrl(workMatch[1]) : null;

  return {
    episodeThumbnailUrl,
    workThumbnailUrl
  };
}

function mergeReleasesByCanonical(releases: NormalizedRelease[]) {
  const merged = new Map<string, NormalizedRelease>();
  for (const release of releases) {
    merged.set(release.canonicalUrl, release);
  }
  return [...merged.values()];
}

function normalizeWebryDate(value?: string) {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}
