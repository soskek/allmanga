import { siteAccentColors, siteLabels, siteMarks } from "@/lib/domain";
import { sortFeedByDateThenSite, groupFeedByDate, sortFeedByUserSiteOrder } from "@/lib/feed-order";
import { getSharedHomeSnapshot } from "@/lib/home-snapshot";
import { getDefaultSettings } from "@/lib/settings";
import type { SharedHomeDiscoverItem, SharedHomeFeedItem } from "@/lib/types";

export type PublicHomeCard = {
  id: string;
  key: string;
  siteId: string;
  siteName: string;
  siteMark: string;
  siteAccent: string;
  title: string;
  authors: string;
  semanticKind: string;
  publishedAt: string | null;
  firstSeenAt: string;
  officialUrl: string;
  isPaidOnly?: boolean;
};

export type PublicHomeView = {
  generatedAt: string;
  lastSyncedAt: string | null;
  hiddenCount: number;
  hiddenBreakdown: {
    promotion: number;
    announcement: number;
  };
  discover: PublicHomeCard[];
  today: PublicHomeCard[];
  recentGroups: Array<{
    key: string;
    label: string;
    items: PublicHomeCard[];
  }>;
};

export async function getPublicHomeView(): Promise<PublicHomeView> {
  const settings = getDefaultSettings();
  const snapshot = await getSharedHomeSnapshot();
  const today = sortFeedByUserSiteOrder(
    snapshot.todayFeed.map((item) => ({ ...item, followed: false })),
    settings.siteOrder
  ).map(feedToPublicCard);
  const recentGroups = groupFeedByDate(
    sortFeedByDateThenSite(
      snapshot.recentMainFeed.map((item) => ({ ...item, followed: false })),
      settings.siteOrder,
      settings.timezone
    ),
    settings.timezone
  ).map((group) => ({
    key: group.key,
    label: group.label,
    items: group.items.map(feedToPublicCard)
  }));

  return {
    generatedAt: new Date().toISOString(),
    lastSyncedAt: snapshot.lastSyncedAt?.toISOString() ?? null,
    hiddenCount: snapshot.hiddenCount,
    hiddenBreakdown: snapshot.hiddenBreakdown,
    discover: snapshot.discover.map(discoverToPublicCard),
    today,
    recentGroups
  };
}

function feedToPublicCard(item: SharedHomeFeedItem): PublicHomeCard {
  return {
    ...basePublicCardFields(item.siteId, item.title, item.authors, item.semanticKind, item.publishedAt, item.firstSeenAt),
    id: item.openReleaseId,
    key: item.workKey,
    officialUrl: item.openUrl,
    isPaidOnly: item.isPaidOnly
  };
}

function discoverToPublicCard(item: SharedHomeDiscoverItem): PublicHomeCard {
  return {
    ...basePublicCardFields(item.siteId, item.title, item.authors, item.semanticKind, item.publishedAt, item.firstSeenAt),
    id: item.id,
    key: item.workId ? `${item.siteId}::${item.workId}` : `${item.siteId}::${item.title}`,
    officialUrl: item.canonicalUrl,
    isPaidOnly: item.isPaidOnly
  };
}

function basePublicCardFields(
  siteId: string,
  title: string,
  authors: string,
  semanticKind: string,
  publishedAt: Date | null,
  firstSeenAt: Date
) {
  return {
    siteId,
    siteName: siteLabels[siteId] ?? siteId,
    siteMark: siteMarks[siteId] ?? siteId.slice(0, 2).toUpperCase(),
    siteAccent: siteAccentColors[siteId] ?? "#475569",
    title,
    authors,
    semanticKind,
    publishedAt: publishedAt?.toISOString() ?? null,
    firstSeenAt: firstSeenAt.toISOString()
  };
}
