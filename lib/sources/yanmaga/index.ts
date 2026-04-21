import { load } from "cheerio";
import type { SourceAdapter } from "@/lib/types";
import { canonicalizeUrl, isGenericContentTitle, normalizeWhitespace, uniqBy } from "@/lib/utils";
import { fetchText } from "@/lib/sources/http";
import { currentJstDateStartIso } from "@/lib/sources/helpers";

const baseUrl = "https://yanmaga.jp";
const detailBatchSize = 4;

export const yanmagaAdapter: SourceAdapter = {
  siteId: "yanmaga",
  enabledByDefault: true,
  async sync() {
    const html = await fetchText(baseUrl);
    const $ = load(html);
    const workEntries = $('a[href*="/comics/"]')
      .map((_, element) => {
        const href = $(element).attr("href");
        const rawTitle = $(element).attr("data-name") || $(element).find("img").attr("alt") || $(element).text();
        const title = normalizeWhitespace(stripYanmagaDatePrefix(rawTitle));
        if (!href || href.includes("/columns/") || !title || isGenericContentTitle(title) || title.includes("グラビア")) {
          return null;
        }
        return {
          siteId: "yanmaga" as const,
          canonicalUrl: canonicalizeUrl(href, baseUrl),
          title,
          authors: [],
          kind: "unknown" as const,
          status: "unknown" as const
        };
      })
      .get()
      .filter(Boolean);

    const works = uniqBy(workEntries, (work) => work.canonicalUrl);
    const todayUpdateWorks = parseYanmagaTodayUpdateWorks(html);
    const todayUpdateReleases = await fetchYanmagaTodayUpdateReleases(todayUpdateWorks);
    const releases = uniqBy(
      [
        ...todayUpdateReleases,
        ...$('a[href*="/comics/"], a[href*="/columns/articles/"]')
        .map((_, element) => {
          const href = $(element).attr("href");
          const rawTitle = normalizeWhitespace($(element).attr("data-name") || $(element).find("img").attr("alt") || $(element).text());
          if (!href || !rawTitle || rawTitle.includes("グラビア")) {
            return null;
          }
          const publishedAt = parseYanmagaPublishedAt(rawTitle);
          const title = stripYanmagaDatePrefix(rawTitle);
          if (!title || isGenericContentTitle(title)) {
            return null;
          }
        const canonicalUrl = canonicalizeUrl(href, baseUrl);
        const thumbnailUrl =
          $(element).find("img").attr("data-src") ??
          $(element).find("img").attr("src") ??
          null;
        return {
          siteId: "yanmaga" as const,
          canonicalUrl,
          workCanonicalUrl: canonicalUrl.includes("/comics/") ? canonicalUrl : undefined,
          title,
          rawTitle,
          publishedAt: publishedAt ?? undefined,
          sourceType: canonicalUrl.includes("/columns/articles/") ? ("news" as const) : ("series_list" as const),
          contentKind: canonicalUrl.includes("/columns/articles/") ? ("article" as const) : ("work" as const),
          extra: {
            thumbnailUrl,
            workThumbnailUrl: thumbnailUrl,
            workTitle: title,
            previewThumbnailUrl: thumbnailUrl
          }
        };
      })
      .get()
      .filter(Boolean)
      ],
      (release) => release.canonicalUrl
    );

    return {
      works,
      releases,
      logs: [`yanmaga works=${works.length}`, `yanmaga releases=${releases.length}`]
    };
  }
};

function parseYanmagaTodayUpdateWorks(html: string) {
  const $ = load(html);
  return uniqBy(
    $('#top-books a.ga-top-today-update-item[href*="/comics/"]')
      .map((_, element) => {
        const href = $(element).attr("href");
        const rawTitle =
          $(element).attr("data-name") ??
          $(element).find("img").attr("alt") ??
          $(element).find(".mod-book-title").first().text() ??
          $(element).text();
        const title = normalizeWhitespace(stripYanmagaDatePrefix(rawTitle));
        const description = normalizeWhitespace($(element).text().replace(rawTitle, "").replace(title, ""));
        const thumbnailUrl = $(element).find("img").attr("data-src") ?? $(element).find("img").attr("src") ?? null;
        if (!href || !title || isGenericContentTitle(title)) {
          return null;
        }
        return {
          canonicalUrl: canonicalizeUrl(href, baseUrl),
          title,
          description,
          thumbnailUrl
        };
      })
      .get()
      .filter(Boolean),
    (work) => work.canonicalUrl
  );
}

async function fetchYanmagaTodayUpdateReleases(
  items: Array<{ canonicalUrl: string; title: string; description: string; thumbnailUrl: string | null }>
) {
  const releases = [];

  for (let index = 0; index < items.length; index += detailBatchSize) {
    const batch = items.slice(index, index + detailBatchSize);
    const batchReleases = await Promise.all(batch.map((item) => fetchYanmagaTodayUpdateRelease(item)));
    for (const release of batchReleases) {
      if (release) {
        releases.push(release);
      }
    }
  }

  return releases;
}

async function fetchYanmagaTodayUpdateRelease(item: {
  canonicalUrl: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
}) {
  try {
    const html = await fetchText(`${item.canonicalUrl}${item.canonicalUrl.includes("?") ? "&" : "?"}sort=older`);
    const $ = load(html);
    const latestHref =
      $('.detailv2-button a.ga-episode-link.mod-button--black--v2').first().attr("href") ??
      $('a.mod-episode-link').last().attr("href");
    if (!latestHref) {
      return null;
    }

    const latestCanonicalUrl = canonicalizeUrl(latestHref, baseUrl);
    const workThumbnailUrl =
      $('meta[property="og:image"]').attr("content") ??
      $(".detailv2-thumbnail-image img").first().attr("src") ??
      item.thumbnailUrl;
    const episodeRows = $('a.mod-episode-link')
      .map((_, element) => {
        const node = $(element);
        const href = node.attr("href");
        const text = normalizeWhitespace(node.text());
        const thumbnailUrl = node.find(".mod-episode-thumbnail-image img").first().attr("src") ?? null;
        return {
          href: href ? canonicalizeUrl(href, baseUrl) : "",
          text,
          thumbnailUrl
        };
      })
      .get();
    const matchedEpisode = episodeRows.find((episode) => episode.href === latestCanonicalUrl) ?? episodeRows[episodeRows.length - 1];
    const publishedAt = parseYanmagaEpisodeDate(matchedEpisode?.text);
    const episodeTitle = parseYanmagaEpisodeTitle(matchedEpisode?.text);

    return {
      siteId: "yanmaga" as const,
      canonicalUrl: latestCanonicalUrl,
      workCanonicalUrl: item.canonicalUrl,
      title: episodeTitle || item.title,
      rawTitle: episodeTitle || item.title,
      publishedAt: publishedAt ?? currentJstDateStartIso(),
      sourceType: "work_page" as const,
      contentKind: "episode" as const,
      extra: {
        workTitle: item.title,
        thumbnailUrl: matchedEpisode?.thumbnailUrl ?? item.thumbnailUrl,
        workThumbnailUrl,
        previewThumbnailUrl: matchedEpisode?.thumbnailUrl ?? item.thumbnailUrl ?? workThumbnailUrl,
        descriptionText: item.description || null
      }
    };
  } catch {
    return null;
  }
}

function stripYanmagaDatePrefix(value: string) {
  return normalizeWhitespace(value.replace(/^\d{8}_/, "").replace(/_全話無料$/, ""));
}

function parseYanmagaPublishedAt(value: string) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})_/);
  if (!match) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}T00:00:00+09:00`;
}

function parseYanmagaEpisodeDate(value?: string) {
  if (!value) {
    return null;
  }
  const match = value.match(/(20\d{2})\/(\d{2})\/(\d{2})/);
  if (!match) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}T00:00:00+09:00`;
}

function parseYanmagaEpisodeTitle(value?: string) {
  if (!value) {
    return null;
  }
  const normalized = normalizeWhitespace(value)
    .replace(/^20\d{2}\/\d{2}\/\d{2}\s*/, "")
    .replace(/\s+\d+\s*(無料|有料|レンタル)?$/, "")
    .replace(/\s+(無料|有料|レンタル)$/, "")
    .trim();

  if (!normalized || isGenericContentTitle(normalized)) {
    return null;
  }

  const lines = normalized
    .split(/\s{2,}|\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
  return lines[0] ?? null;
}
