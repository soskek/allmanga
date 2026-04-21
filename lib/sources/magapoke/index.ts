import { load } from "cheerio";
import type { NormalizedRelease, NormalizedWork, SourceAdapter } from "@/lib/types";
import { fetchText } from "@/lib/sources/http";
import { currentJstDateStartIso, linkReleasesToWorks } from "@/lib/sources/helpers";
import { canonicalizeUrl, normalizeWhitespace } from "@/lib/utils";

const baseUrl = "https://pocket.shonenmagazine.com";
const titlePathPattern = /\/title\/(\d+)(?:\/episode\/(\d+))?/;
const latestEpisodeBatchSize = 4;

export const magapokeAdapter: SourceAdapter = {
  siteId: "magapoke",
  enabledByDefault: true,
  async sync() {
    const [homeHtml, seriesHtml, oneshotHtml, newsHtml] = await Promise.all([
      fetchText(baseUrl),
      fetchText(`${baseUrl}/series`),
      fetchText(`${baseUrl}/search/genre/10`),
      fetchText(`${baseUrl}/article/archive/category/%E8%AA%AD%E3%81%BF%E5%88%87%E3%82%8A%E6%8E%B2%E8%BC%89`)
    ]);

    const works = [...parseMagapokeWorks(seriesHtml, "serial"), ...parseMagapokeWorks(oneshotHtml, "oneshot")];
    const latestEpisodeReleases = await enrichMagapokeLatestEpisodes(parseMagapokeLatestEpisodes(homeHtml));
    const releases: NormalizedRelease[] = linkReleasesToWorks(works, [
      ...latestEpisodeReleases,
      ...parseMagapokeReleases(oneshotHtml, "category_list", "work"),
      ...parseMagapokeNews(newsHtml)
    ]);

    return {
      works,
      releases,
      logs: [`magapoke works=${works.length}`, `magapoke releases=${releases.length}`]
    };
  }
};

function parseMagapokeWorks(html: string, kind: "serial" | "oneshot"): NormalizedWork[] {
  const $ = load(html);
  const works = new Map<
    string,
    { siteId: string; canonicalUrl: string; title: string; authors: string[]; kind: "serial" | "oneshot"; status: "active" }
  >();
  $('a[href*="/title/"]').each((_, element) => {
    const href = $(element).attr("href");
    const match = href?.match(titlePathPattern);
    if (!href || !match?.[1]) {
      return;
    }
    const canonicalUrl = `${baseUrl}/title/${match[1]}`;
    const title =
      normalizeWhitespace($(element).find(".c-series-item__ttl").first().text()) ||
      normalizeWhitespace($(element).find("img[alt]").first().attr("alt") ?? "") ||
      normalizeWhitespace($(element).attr("title") ?? "");
    if (!title) {
      return;
    }
    const authors = normalizeWhitespace($(element).find(".c-series-item__name").first().text())
      .split("/")
      .map((name) => name.trim())
      .filter(Boolean);
    works.set(canonicalUrl, {
      siteId: "magapoke",
      canonicalUrl,
      title,
      authors,
      kind,
      status: "active"
    });
  });
  return [...works.values()];
}

function parseMagapokeLatestEpisodes(html: string): NormalizedRelease[] {
  const $ = load(html);
  const releases = new Map<string, NormalizedRelease>();
  const publishedAt = currentJstDateStartIso();

  $('#todayUpdated .p-index-update__item a[href*="/title/"][href*="/episode/"]').each((_, element) => {
    const href = $(element).attr("href");
    const match = href?.match(titlePathPattern);
    if (!href || !match?.[1]) {
      return;
    }

    const canonicalUrl = canonicalizeUrl(href, baseUrl);
    const workCanonicalUrl = `${baseUrl}/title/${match[1]}`;
    const title =
      normalizeWhitespace($(element).find(".c-comic-item__ttl,.c-ranking-item__ttl,.c-series-item__ttl").first().text()) ||
      normalizeWhitespace($(element).find("img[alt]").first().attr("alt") ?? "") ||
      normalizeWhitespace($(element).attr("title") ?? "") ||
      normalizeWhitespace($(element).text().replace(/無料話更新[:：].*$/, ""));
    const updateLabel =
      normalizeWhitespace($(element).find(".c-comic-item__description,.c-ranking-item__update,[class*=update]").first().text()) ||
      normalizeWhitespace($(element).text().match(/無料話更新[:：].*$/)?.[0] ?? "");
    const thumbnailUrl =
      $(element).find("img").first().attr("data-src") ??
      $(element).find("img").first().attr("src") ??
      null;
    if (!title) {
      return;
    }

    releases.set(canonicalUrl, {
      siteId: "magapoke",
      canonicalUrl,
      workCanonicalUrl,
      title,
      rawTitle: title,
      publishedAt,
      sourceType: "work_page",
      contentKind: "episode",
      extra: {
        thumbnailUrl,
        updateLabel: updateLabel || null,
        previewThumbnailUrl: thumbnailUrl
      }
    });
  });

  return [...releases.values()];
}

async function enrichMagapokeLatestEpisodes(releases: NormalizedRelease[]) {
  const enriched: NormalizedRelease[] = [];

  for (let index = 0; index < releases.length; index += latestEpisodeBatchSize) {
    const batch = releases.slice(index, index + latestEpisodeBatchSize);
    const results = await Promise.all(batch.map((release) => enrichMagapokeLatestEpisode(release)));
    enriched.push(...results);
  }

  return enriched;
}

async function enrichMagapokeLatestEpisode(release: NormalizedRelease) {
  try {
    const html = await fetchText(release.canonicalUrl);
    const episodeThumbnailUrl =
      html.match(/"thumbnail_image_url":"([^"]+)"/i)?.[1] ??
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i)?.[1] ??
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1] ??
      html.match(/https:\/\/mgpk-cdn\.magazinepocket\.com\/static\/titles\/\d+\/episodes\/\d+\/thumbnail_[^"' ]+/i)?.[0] ??
      null;
    const bannerImageUrl =
      html.match(/<meta[^>]+name=["']thumbnail["'][^>]+content=["']([^"']+)/i)?.[1] ??
      html.match(/https:\/\/mgpk-cdn\.magazinepocket\.com\/static\/titles\/[^"' ]*banner[^"' ]+/i)?.[0] ??
      null;
    const workThumbnailUrl = html.match(
      /https:\/\/mgpk-cdn\.magazinepocket\.com\/static\/titles\/[^"' ]*title_grid_wide[^"' ]+/i
    )?.[0];

    return {
      ...release,
      extra: {
        ...(release.extra ?? {}),
        thumbnailUrl:
          episodeThumbnailUrl ??
          bannerImageUrl ??
          (release.extra?.thumbnailUrl as string | null | undefined) ??
          null,
        workThumbnailUrl: workThumbnailUrl ?? null,
        previewThumbnailUrl:
          episodeThumbnailUrl ??
          bannerImageUrl ??
          (typeof release.extra?.previewThumbnailUrl === "string" ? release.extra.previewThumbnailUrl : null)
      }
    };
  } catch {
    return release;
  }
}

function parseMagapokeReleases(
  html: string,
  sourceType: "series_list" | "category_list",
  contentKind: "episode" | "work"
): NormalizedRelease[] {
  const $ = load(html);
  const releases = new Map<
    string,
    {
      siteId: string;
      canonicalUrl: string;
      workCanonicalUrl?: string;
      title?: string;
      rawTitle?: string;
      sourceType: "series_list" | "category_list";
      contentKind: "episode" | "work";
      extra?: Record<string, unknown>;
    }
  >();
  $('a[href*="/title/"]').each((_, element) => {
    const href = $(element).attr("href");
    const match = href?.match(titlePathPattern);
    if (!href || !match?.[1]) {
      return;
    }
    const title =
      normalizeWhitespace($(element).find(".c-series-item__ttl").first().text()) ||
      normalizeWhitespace($(element).find("img[alt]").first().attr("alt") ?? "") ||
      normalizeWhitespace($(element).attr("title") ?? "");
    const thumbnailUrl =
      $(element).find("img").first().attr("data-src") ??
      $(element).find("img").first().attr("src") ??
      null;
    if (!title) {
      return;
    }
    const canonicalUrl = canonicalizeUrl(href, baseUrl);
    const workCanonicalUrl = `${baseUrl}/title/${match[1]}`;
    releases.set(canonicalUrl, {
      siteId: "magapoke",
      canonicalUrl,
      workCanonicalUrl,
      title,
      rawTitle: title,
      sourceType,
      contentKind,
      extra: {
        thumbnailUrl,
        previewThumbnailUrl: thumbnailUrl
      }
    });
  });
  return [...releases.values()];
}

function parseMagapokeNews(html: string): NormalizedRelease[] {
  const $ = load(html);
  const releases = new Map<
    string,
    {
      siteId: string;
      canonicalUrl: string;
      title?: string;
      rawTitle?: string;
      sourceType: "news";
      contentKind: "article";
      extra?: Record<string, unknown>;
    }
  >();
  $(".archive-entry").each((_, element) => {
    const root = $(element);
    const link = root.find('a[href*="/article/entry/"]').first();
    const title = normalizeWhitespace(root.find(".entry-title-link").first().text() || link.text());
    const href = link.attr("href");
    if (!href || !title) {
      return;
    }
    if (!title.startsWith("〖マガポケ新連載〗") && !title.startsWith("〖特別読み切り〗")) {
      return;
    }
    const thumbnailUrl =
      root.find(".entry-thumb-link img").first().attr("data-src") ??
      root.find(".entry-thumb-link img").first().attr("src") ??
      root.find("img").first().attr("data-src") ??
      root.find("img").first().attr("src") ??
      null;
    const canonicalUrl = canonicalizeUrl(href, baseUrl);
    releases.set(canonicalUrl, {
      siteId: "magapoke",
      canonicalUrl,
      title,
      rawTitle: title,
      sourceType: "news",
      contentKind: "article",
      extra: {
        thumbnailUrl,
        previewThumbnailUrl: thumbnailUrl
      }
    });
  });
  return [...releases.values()];
}
