import { load } from "cheerio";
import type { NormalizedRelease, NormalizedWork, SourceAdapter } from "@/lib/types";
import { fetchText } from "@/lib/sources/http";
import { normalizeRssPubDate, parseRssItems } from "@/lib/sources/helpers";
import { canonicalizeUrl, normalizeWhitespace, uniqBy } from "@/lib/utils";

const baseUrl = "https://comic-days.com";

export const comicdaysAdapter: SourceAdapter = {
  siteId: "comicdays",
  enabledByDefault: true,
  async sync() {
    const [seriesHtml, rssXml] = await Promise.all([
      fetchText(`${baseUrl}/series`),
      fetchText(`${baseUrl}/rss`)
    ]);

    const seriesData = parseComicdaysSeries(seriesHtml);
    const releases = parseComicdaysRss(rssXml, seriesData.works);

    return {
      works: seriesData.works,
      releases: uniqBy(seriesData.releases.concat(releases), (release) => release.canonicalUrl),
      logs: [`comicdays works=${seriesData.works.length}`, `comicdays releases=${seriesData.releases.length + releases.length}`]
    };
  }
};

function parseComicdaysSeries(html: string) {
  const $ = load(html);
  const works: NormalizedWork[] = [];
  const releases: NormalizedRelease[] = [];

  $("li.daily-series-item").each((_, element) => {
    const item = $(element);
    const title = normalizeWhitespace(item.find(".daily-series-title").first().text());
    const authors = normalizeWhitespace(item.find(".daily-series-author").first().text())
      .split("/")
      .map((author) => normalizeWhitespace(author))
      .filter(Boolean);
    const firstHref = item.find(".daily-series-thumb a").first().attr("href") ?? item.find("a").first().attr("href");
    const thumbnailUrl = item.find("img").first().attr("data-src") ?? item.find("img").first().attr("src") ?? null;
    const descriptionText = normalizeWhitespace(item.find(".daily-series-tagline").first().text()) || null;
    const seriesId = item.attr("data-series-id");

    if (!title || !firstHref) {
      return;
    }

    const workCanonicalUrl = canonicalizeUrl(firstHref, baseUrl);
    const canonicalUrl = seriesId ? `${baseUrl}/series-cover/${seriesId}` : `${workCanonicalUrl}/__cover`;

    works.push({
      siteId: "comicdays",
      canonicalUrl: workCanonicalUrl,
      title,
      authors,
      kind: "serial",
      status: "active",
      descriptionText
    });

    releases.push({
      siteId: "comicdays",
      canonicalUrl,
      workCanonicalUrl,
      title,
      rawTitle: title,
      sourceType: "series_list",
      contentKind: "work",
      extra: {
        workTitle: title,
        authors,
        descriptionText,
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

function parseComicdaysRss(xml: string, works: Array<{ canonicalUrl: string; title: string }>) {
  const workMap = new Map(works.map((work) => [normalizeWhitespace(work.title), work.canonicalUrl]));
  const items = parseRssItems(xml);
  const releases: NormalizedRelease[] = [];

  for (const item of items) {
    const title = normalizeWhitespace(typeof item.title === "string" ? item.title : "");
    const link = typeof item.link === "string" ? item.link : "";
    const workTitle = normalizeWhitespace(typeof item.description === "string" ? item.description : "");
    const author = normalizeWhitespace(typeof item.author === "string" ? item.author : "");
    const enclosure = item.enclosure as { "@_url"?: string } | undefined;

    if (!title || !link || !workTitle) {
      continue;
    }

    releases.push({
      siteId: "comicdays",
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

  return uniqBy(releases, (release) => release.canonicalUrl);
}
