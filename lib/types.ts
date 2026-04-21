import type { DefaultVisibility, SemanticKind } from "@/lib/domain";

export type NormalizedWork = {
  siteId: string;
  canonicalUrl: string;
  title: string;
  authors: string[];
  kind: "serial" | "oneshot" | "unknown";
  status?: "active" | "ended" | "unknown";
  descriptionText?: string | null;
};

export type NormalizedRelease = {
  siteId: string;
  canonicalUrl: string;
  workCanonicalUrl?: string;
  title?: string;
  publishedAt?: string;
  sourceType:
    | "rss"
    | "series_list"
    | "oneshot_list"
    | "label_list"
    | "category_list"
    | "news"
    | "work_page"
    | "unknown";
  contentKind: "episode" | "news" | "article" | "work" | "unknown";
  rawBadgeText?: string;
  rawTitle?: string;
  extra?: Record<string, unknown>;
};

export interface SourceAdapter {
  siteId: string;
  enabledByDefault: boolean;
  sync(): Promise<{
    works: NormalizedWork[];
    releases: NormalizedRelease[];
    logs: string[];
  }>;
}

export type ClassificationInput = {
  release: NormalizedRelease;
  work?: {
    id: string;
    siteId: string;
    canonicalUrl: string;
    title: string;
    authors: string[];
    kind: "serial" | "oneshot" | "unknown";
    status?: "active" | "ended" | "unknown";
  };
  manualOverrideKind?: SemanticKind | null;
  workDisplayOverride?: Partial<Record<SemanticKind, DefaultVisibility>>;
};

export type HomeFeedWorkItem = {
  workKey: string;
  workId: string | null;
  openReleaseId: string;
  openUrl: string;
  siteId: string;
  title: string;
  authors: string;
  semanticKind: string;
  publishedAt: Date | null;
  firstSeenAt: Date;
  previewThumbnailUrl: string | null;
  thumbnailUrl: string | null;
  secondaryThumbnailUrl: string | null;
  followed: boolean;
  isPaidOnly: boolean;
  followWorkId: string | null;
  followReleaseId: string | null;
};

export type SharedHomeFeedItem = Omit<HomeFeedWorkItem, "followed" | "followWorkId" | "followReleaseId">;

export type SharedHomeDiscoverItem = {
  id: string;
  workId: string | null;
  canonicalUrl: string;
  siteId: string;
  title: string;
  authors: string;
  semanticKind: string;
  publishedAt: Date | null;
  firstSeenAt: Date;
  previewThumbnailUrl: string | null;
  thumbnailUrl: string | null;
  isPaidOnly: boolean;
};

export type SharedHomeSnapshot = {
  timezone: string;
  builtAt: Date;
  lastSyncedAt: Date | null;
  hiddenCount: number;
  hiddenBreakdown: {
    promotion: number;
    announcement: number;
  };
  todayFeed: SharedHomeFeedItem[];
  recentMainFeed: SharedHomeFeedItem[];
  discover: SharedHomeDiscoverItem[];
};
