import { semanticKinds } from "@/lib/domain";
import { safeJsonParse } from "@/lib/utils";

type Row = {
  workId: string;
  title: string;
  canonicalUrl: string;
  releaseCanonicalUrl: string;
  siteId: string;
  authors: string;
  previewThumbnailUrl?: string | null;
  workThumbnailUrl?: string | null;
  releaseThumbnailUrl?: string | null;
  pin?: boolean;
  priority?: number;
  releaseId: string;
  semanticKind: string;
  state: string;
  lane: string;
  publishedAt?: Date | null;
  firstSeenAt: Date;
};

export function aggregateWorkCards(rows: Row[]) {
  const map = new Map<
    string,
    {
      workId: string;
      title: string;
      canonicalUrl: string;
      openUrl: string;
        siteId: string;
        authors: string[];
        thumbnailUrl: string | null;
        secondaryThumbnailUrl: string | null;
        pin: boolean;
      priority: number;
      counts: Record<string, number>;
      unreadMainCount: number;
      newestUnreadAt: Date | null;
      openReleaseId: string | null;
      releaseIds: string[];
    }
  >();

  for (const row of rows) {
    const current =
      map.get(row.workId) ??
      {
        workId: row.workId,
        title: row.title,
        canonicalUrl: row.canonicalUrl,
        openUrl: row.releaseCanonicalUrl,
        siteId: row.siteId,
        authors: safeJsonParse<string[]>(row.authors, []),
        thumbnailUrl: row.previewThumbnailUrl ?? row.workThumbnailUrl ?? row.releaseThumbnailUrl ?? null,
        secondaryThumbnailUrl: row.releaseThumbnailUrl ?? null,
        pin: Boolean(row.pin),
        priority: row.priority ?? 0,
        counts: Object.fromEntries(semanticKinds.map((kind) => [kind, 0])),
        unreadMainCount: 0,
        newestUnreadAt: null as Date | null,
        openReleaseId: row.releaseId,
        releaseIds: []
      };

    current.counts[row.semanticKind] = (current.counts[row.semanticKind] ?? 0) + 1;
    if (row.semanticKind === "main_episode" && row.state === "unread") {
      current.unreadMainCount += 1;
      const at = row.publishedAt ?? row.firstSeenAt;
      if (!current.newestUnreadAt || at > current.newestUnreadAt) {
        current.newestUnreadAt = at;
        current.openUrl = row.releaseCanonicalUrl;
        current.openReleaseId = row.releaseId;
        current.thumbnailUrl = row.previewThumbnailUrl ?? row.workThumbnailUrl ?? current.thumbnailUrl ?? row.releaseThumbnailUrl ?? null;
        current.secondaryThumbnailUrl = row.releaseThumbnailUrl ?? current.secondaryThumbnailUrl ?? null;
      }
    }
    if (!current.thumbnailUrl && (row.previewThumbnailUrl ?? row.workThumbnailUrl ?? row.releaseThumbnailUrl)) {
      current.thumbnailUrl = row.previewThumbnailUrl ?? row.workThumbnailUrl ?? row.releaseThumbnailUrl ?? null;
    }
    if (!current.secondaryThumbnailUrl && row.releaseThumbnailUrl) {
      current.secondaryThumbnailUrl = row.releaseThumbnailUrl;
    }
    current.releaseIds.push(row.releaseId);
    map.set(row.workId, current);
  }

  return [...map.values()].sort((a, b) => {
    if (a.pin !== b.pin) {
      return a.pin ? -1 : 1;
    }
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    if (a.unreadMainCount !== b.unreadMainCount) {
      return b.unreadMainCount - a.unreadMainCount;
    }
    if (a.newestUnreadAt && b.newestUnreadAt && a.newestUnreadAt.getTime() !== b.newestUnreadAt.getTime()) {
      return b.newestUnreadAt.getTime() - a.newestUnreadAt.getTime();
    }
    return a.title.localeCompare(b.title, "ja");
  });
}
