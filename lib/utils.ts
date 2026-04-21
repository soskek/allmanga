import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const TRACKING_QUERY_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "ref",
  "source",
  "from",
  "fbclid",
  "gclid"
]);

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function canonicalizeUrl(input: string, baseUrl?: string) {
  const url = new URL(input, baseUrl);
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_QUERY_KEYS.has(key)) {
      url.searchParams.delete(key);
    }
  }
  if (!url.searchParams.size) {
    url.search = "";
  }
  url.hash = "";
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function uniqBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function isExcludedUrl(url: string) {
  const lower = url.toLowerCase();
  return [
    "/gravure/",
    "/video/",
    "/movie/",
    "/goods/",
    "/cart",
    "/membership",
    "/support",
    "/legal",
    "/privacy",
    "/terms",
    "/help",
    "/contest",
    "/award",
    "/app",
    "/contact",
    "/inquiry"
  ].some((part) => lower.includes(part));
}

export function coerceDate(value?: string | Date | null) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(date?: Date | string | null, timezone = "Asia/Tokyo") {
  if (!date) {
    return "日時不明";
  }
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone
  }).format(new Date(date));
}

export function titleLooksLikeEpisode(title?: string | null) {
  if (!title) {
    return false;
  }
  return /(第\s?\d+話|#\d+|Episode\s?\d+|ep\.?\s?\d+|\d+話)/i.test(title);
}

export function normalizeWhitespace(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

export function normalizeForMatch(value?: string | null) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[【】\[\]()（）・\/\-_—:：!！?？'"“”‘’\s]/g, "");
}

const GENERIC_TITLES = new Set([
  "cookie設定",
  "ヘルプ／使い方",
  "ヘルプ",
  "アプリ",
  "履歴",
  "ランキング",
  "連載作品",
  "連載終了作品",
  "オリジナル連載",
  "週マガ連載",
  "別マガ連載",
  "最新話を読む",
  "最新話へ",
  "新人賞",
  "作品を探す",
  "シリーズ一覧",
  "シリーズ",
  "読切",
  "新連載",
  "お問い合わせ",
  "利用規約",
  "プライバシーポリシー",
  "特定商取引法および資金決済法に基づく表示",
  "はじめから読む",
  "作品を読む"
]);

export function isGenericContentTitle(value?: string | null) {
  const title = normalizeWhitespace(value);
  return !title || GENERIC_TITLES.has(title);
}

export function buildSearchableText(parts: Array<string | string[] | undefined | null>) {
  return parts
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function extractThumbnailUrl(extraJson?: string | null) {
  const extra = safeJsonParse<Record<string, unknown>>(extraJson, {});
  const candidates = [
    extra.thumbnailUrl,
    extra.imageUrl,
    extra.originalThumbnail,
    extra.bookCover,
    extra.thumbnail,
    extra.coverUrl
  ];

  return candidates.find((value) => typeof value === "string" && /^https?:\/\//.test(value)) as string | undefined;
}

export function extractPreviewThumbnailUrl(extraJson?: string | null) {
  const extra = safeJsonParse<Record<string, unknown>>(extraJson, {});
  const candidates = [
    extra.previewThumbnailUrl,
    extra.ogImageUrl,
    extra.twitterImageUrl
  ];

  return candidates.find((value) => typeof value === "string" && /^https?:\/\//.test(value)) as string | undefined;
}

export function extractWorkThumbnailUrl(extraJson?: string | null) {
  const extra = safeJsonParse<Record<string, unknown>>(extraJson, {});
  const candidates = [extra.workThumbnailUrl, extra.seriesThumbnailUrl, extra.secondaryThumbnailUrl];

  return candidates.find((value) => typeof value === "string" && /^https?:\/\//.test(value)) as string | undefined;
}

export function pickThumbnailUrl(...candidates: Array<string | null | undefined>) {
  return candidates.find((value) => typeof value === "string" && /^https?:\/\//.test(value)) ?? undefined;
}

export function normalizeThumbnailUrl(url?: string | null) {
  if (!url) {
    return undefined;
  }

  return url
    .replaceAll("{height}", "320")
    .replaceAll("{width}", "320")
    .replaceAll("%7Bheight%7D", "320")
    .replaceAll("%7Bwidth%7D", "320");
}

export function extractWorkMeta(extraJson?: string | null) {
  const extra = safeJsonParse<Record<string, unknown>>(extraJson, {});
  const workTitle = typeof extra.workTitle === "string" ? normalizeWhitespace(extra.workTitle) : null;
  const authors = Array.isArray(extra.authors)
    ? extra.authors.filter((value): value is string => typeof value === "string").map((value) => normalizeWhitespace(value)).filter(Boolean)
    : typeof extra.authorName === "string"
      ? [normalizeWhitespace(extra.authorName)].filter(Boolean)
      : [];

  return {
    workTitle,
    authors
  };
}

export function extractAccessMeta(extraJson?: string | null) {
  const extra = safeJsonParse<Record<string, unknown>>(extraJson, {});
  const readingCondition = typeof extra.readingCondition === "string" ? extra.readingCondition : null;
  const leadText = typeof extra.leadText === "string" ? normalizeWhitespace(extra.leadText) : null;
  const isPaidOnly =
    readingCondition === "EPISODE_READ_CONDITION_GOLD" ||
    readingCondition === "EPISODE_READ_CONDITION_PURCHASE" ||
    Boolean(leadText && /(メンバーシップ|ポイント|コイン|購入|有料|レンタル)/.test(leadText) && !/無料/.test(leadText));

  return {
    readingCondition,
    leadText,
    isPaidOnly
  };
}
