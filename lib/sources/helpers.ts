import { load } from "cheerio";
import { XMLParser } from "fast-xml-parser";
import type { NormalizedRelease, NormalizedWork } from "@/lib/types";
import { canonicalizeUrl, isExcludedUrl, isGenericContentTitle, normalizeForMatch, normalizeWhitespace, uniqBy } from "@/lib/utils";

export function collectAnchorsAsWorks(params: {
  html: string;
  siteId: string;
  baseUrl: string;
  selectors: string[];
  kind?: "serial" | "oneshot" | "unknown";
}) {
  const $ = load(params.html);
  const works: NormalizedWork[] = [];
  for (const selector of params.selectors) {
    $(selector).each((_, element) => {
      const href = $(element).attr("href");
      const title = normalizeWhitespace($(element).text());
      if (!href || !title || isGenericContentTitle(title)) {
        return;
      }
      const canonicalUrl = canonicalizeUrl(href, params.baseUrl);
      if (isExcludedUrl(canonicalUrl)) {
        return;
      }
      works.push({
        siteId: params.siteId,
        canonicalUrl,
        title,
        authors: [],
        kind: params.kind ?? "unknown",
        status: "unknown"
      });
    });
  }
  return uniqBy(works, (work) => work.canonicalUrl);
}

export function collectAnchorsAsReleases(params: {
  html: string;
  siteId: string;
  baseUrl: string;
  selectors: string[];
  sourceType: NormalizedRelease["sourceType"];
  contentKind: NormalizedRelease["contentKind"];
}) {
  const $ = load(params.html);
  const releases: NormalizedRelease[] = [];
  for (const selector of params.selectors) {
    $(selector).each((_, element) => {
      const href = $(element).attr("href");
      const title = normalizeWhitespace($(element).text());
      if (!href || !title || isGenericContentTitle(title)) {
        return;
      }
      const canonicalUrl = canonicalizeUrl(href, params.baseUrl);
      if (isExcludedUrl(canonicalUrl)) {
        return;
      }
      const badge = normalizeWhitespace(
        $(element).find('[data-test-id="content-badge"], .badge, [class*="badge"]').first().text()
      );
      releases.push({
        siteId: params.siteId,
        canonicalUrl,
        title,
        rawTitle: title,
        rawBadgeText: badge || undefined,
        sourceType: params.sourceType,
        contentKind: params.contentKind
      });
    });
  }
  return uniqBy(releases, (release) => release.canonicalUrl);
}

export function linkReleasesToWorks(works: NormalizedWork[], releases: NormalizedRelease[]) {
  const indexedWorks = works
    .map((work) => ({
      ...work,
      normalizedTitle: normalizeForMatch(work.title)
    }))
    .sort((left, right) => right.normalizedTitle.length - left.normalizedTitle.length);

  return releases.map((release) => {
    const normalizedReleaseTitle = normalizeForMatch(release.title);
    const matchedWork = indexedWorks.find((work) => {
      if (release.workCanonicalUrl && release.workCanonicalUrl === work.canonicalUrl) {
        return true;
      }
      if (release.canonicalUrl === work.canonicalUrl || release.canonicalUrl.startsWith(work.canonicalUrl)) {
        return true;
      }
      if (!normalizedReleaseTitle || !work.normalizedTitle || work.normalizedTitle.length < 3) {
        return false;
      }
      return (
        normalizedReleaseTitle.includes(work.normalizedTitle) ||
        work.normalizedTitle.includes(normalizedReleaseTitle)
      );
    });
    return matchedWork ? { ...release, workCanonicalUrl: matchedWork.canonicalUrl } : release;
  });
}

export function extractJsonScript<T>(html: string, id: string) {
  const match = html.match(new RegExp(`<script[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)</script>`));
  if (!match) {
    return null;
  }
  try {
    return JSON.parse(match[1]) as T;
  } catch {
    return null;
  }
}

type SitemapEntry = {
  loc: string;
  lastmod?: string;
};

export function parseSitemapEntries(xml: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true
  });
  const parsed = parser.parse(xml) as {
    urlset?: { url?: SitemapEntry | SitemapEntry[] };
    sitemapindex?: { sitemap?: SitemapEntry | SitemapEntry[] };
  };
  const entries = parsed.urlset?.url ?? parsed.sitemapindex?.sitemap ?? [];
  return Array.isArray(entries) ? entries : [entries];
}

export function parseRssItems(xml: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
    parseTagValue: false
  });
  const parsed = parser.parse(xml) as {
    rss?: {
      channel?: {
        item?: Record<string, unknown> | Array<Record<string, unknown>>;
      };
    };
  };
  const items = parsed.rss?.channel?.item ?? [];
  return Array.isArray(items) ? items : [items];
}

export function normalizeRssPubDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

export function currentJstDateStartIso(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return `${formatter.format(now)}T00:00:00+09:00`;
}

export function collectComicWalkerWorks(nextData: unknown) {
  const found: Array<{
    code: string;
    title: string;
    labelName?: string;
    labelDescription?: string;
    episodeTitle?: string;
    episodeUpdatedAt?: string;
    isNewSerialization?: boolean;
    serializationStatus?: string;
  }> = [];

  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }

    const record = value as Record<string, unknown>;
    if (typeof record.code === "string" && record.code.endsWith("_S") && typeof record.title === "string") {
      found.push({
        code: record.code,
        title: record.title,
        labelName:
          typeof record.labelInfo === "object" && record.labelInfo && typeof (record.labelInfo as Record<string, unknown>).name === "string"
            ? ((record.labelInfo as Record<string, unknown>).name as string)
            : undefined,
        labelDescription:
          typeof record.labelInfo === "object" && record.labelInfo && typeof (record.labelInfo as Record<string, unknown>).description === "string"
            ? ((record.labelInfo as Record<string, unknown>).description as string)
            : undefined,
        episodeTitle:
          typeof record.episode === "object" && record.episode && typeof (record.episode as Record<string, unknown>).title === "string"
            ? ((record.episode as Record<string, unknown>).title as string)
            : undefined,
        episodeUpdatedAt:
          typeof record.episode === "object" &&
          record.episode &&
          typeof (record.episode as Record<string, unknown>).updateDate === "string"
            ? ((record.episode as Record<string, unknown>).updateDate as string)
            : undefined,
        isNewSerialization: record.isNewSerialization === true,
        serializationStatus: typeof record.serializationStatus === "string" ? record.serializationStatus : undefined
      });
    }

    for (const nested of Object.values(record)) {
      visit(nested);
    }
  };

  visit(nextData);
  return uniqBy(found, (work) => work.code);
}
