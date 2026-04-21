import { Pin as PinIcon } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { CoverThumb } from "@/components/cover-thumb";
import { MetadataBadge, MetadataTile } from "@/components/metadata-tile";
import { SitePill } from "@/components/site-pill";
import {
  compactTileOverlayBandClass,
  compactTileOverlayInsetClass,
  compactTileTitleClass
} from "@/lib/ui-layout";
import type { AppSettings } from "@/lib/settings";

type Card = {
  workId: string;
  title: string;
  canonicalUrl: string;
  openUrl: string;
  openReleaseId?: string | null;
  siteId: string;
  authors: string[];
  thumbnailUrl?: string | null;
  secondaryThumbnailUrl?: string | null;
  pin: boolean;
  priority: number;
  counts: Record<string, number>;
  unreadMainCount: number;
  newestUnreadAt?: Date | null;
};

export function WorkStackCard({
  card,
  tileAspect = "wide",
  hideImages = false,
  allowSecondary = true
}: {
  card: Card;
  tileAspect?: AppSettings["tileAspect"];
  hideImages?: boolean;
  allowSecondary?: boolean;
}) {
  const openHref = `/api/private/open?url=${encodeURIComponent(card.openUrl || card.canonicalUrl)}${card.openReleaseId ? `&releaseId=${encodeURIComponent(card.openReleaseId)}` : ""}`;
  const actions = (
    <>
      <ActionButton
        endpoint={`/api/private/work/${card.workId}/mark-latest-read`}
        label="最新本編を既読"
        undoEndpoint={`/api/private/work/${card.workId}/mark-latest-unread`}
        icon="check"
        hideLabel
        className="h-4 w-4 border-ink/8 bg-white/70 text-ink/62 [&_svg]:h-2.5 [&_svg]:w-2.5"
      />
      <ActionButton
        endpoint={`/api/private/work/${card.workId}/mark-visible-read`}
        label="可視本編を全部既読"
        undoEndpoint={`/api/private/work/${card.workId}/mark-visible-unread`}
        icon="check-double"
        hideLabel
        className="h-4 w-4 border-ink/8 bg-white/70 text-ink/62 [&_svg]:h-2.5 [&_svg]:w-2.5"
      />
      <ActionButton
        endpoint={`/api/private/work/${card.workId}/snooze-visible`}
        label="週末に回す"
        undoEndpoint={`/api/private/work/${card.workId}/mark-visible-unread`}
        icon="clock"
        hideLabel
        className="h-4 w-4 border-ink/8 bg-white/70 text-ink/62 [&_svg]:h-2.5 [&_svg]:w-2.5"
      />
    </>
  );

  if (hideImages) {
    return (
      <MetadataTile
        title={card.title}
        href={openHref}
        siteId={card.siteId}
        actions={actions}
        badges={
          <>
            {card.pin ? <MetadataBadge>ピン</MetadataBadge> : null}
            {card.priority > 0 ? <MetadataBadge variant="semantic">P{card.priority}</MetadataBadge> : null}
          </>
        }
      />
    );
  }

  return (
    <article className="overflow-hidden rounded-[9px] border border-ink/10 bg-white shadow-sm">
      <div className={`relative ${tileAspect === "poster" ? "aspect-[2/3]" : tileAspect === "square" ? "aspect-square" : "aspect-[3/2]"}`}>
        <a
          href={openHref}
          target="_blank"
          rel="noreferrer"
          aria-label={`${card.title} を公式で開く`}
          className="absolute inset-0 z-10"
        />
        <CoverThumb
          src={hideImages ? null : card.thumbnailUrl}
          secondarySrc={!hideImages && allowSecondary ? card.secondaryThumbnailUrl : null}
          alt={card.title}
          siteId={card.siteId}
          showSiteFallback={!hideImages}
          className="absolute inset-0 h-full w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/96 via-ink/38 via-28% to-transparent" />

        <div className="absolute left-1 top-1 flex items-center gap-1">
          <SitePill siteId={card.siteId} compact />
          {card.pin ? (
            <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-[6px] bg-white/92 text-ink/78 shadow-sm">
              <PinIcon className="h-2.5 w-2.5" />
            </span>
          ) : null}
          {card.priority > 0 ? <span className="rounded bg-ember/92 px-1 py-0.5 text-[8px] font-semibold text-white">P{card.priority}</span> : null}
        </div>

        <div className="absolute right-1 top-1 z-20 flex flex-col gap-1">
          {actions}
        </div>

        <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 ${compactTileOverlayInsetClass}`}>
          <div className={compactTileOverlayBandClass}>
            <h3 className={compactTileTitleClass}>
              {card.title}
            </h3>
          </div>
        </div>
      </div>
    </article>
  );
}
