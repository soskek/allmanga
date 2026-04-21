import { ActionButton } from "@/components/action-button";
import { CoverThumb } from "@/components/cover-thumb";
import { MetadataBadge, MetadataTile } from "@/components/metadata-tile";
import { OverrideKindControl } from "@/components/override-kind-control";
import { SitePill } from "@/components/site-pill";
import { semanticLabels } from "@/lib/domain";
import { cn } from "@/lib/utils";
import {
  compactTileOverlayBandClass,
  compactTileOverlayInsetClass,
  compactTileTitleClass
} from "@/lib/ui-layout";
import type { AppSettings } from "@/lib/settings";
import { isGenericContentTitle } from "@/lib/utils";

export function ReleaseRow({
  item,
  timezone = "Asia/Tokyo",
  tileAspect = "wide",
  showStateActions = true,
  showOverride = false,
  hideImages = false,
  showDateBadge = false,
  stateAction = "read",
  followWorkId,
  followReleaseId
}: {
  item: {
    id: string;
    title: string | null;
    canonicalUrl: string;
    semanticKind: string;
    publishedAt: Date | null;
    firstSeenAt: Date;
    siteId: string;
    thumbnailUrl?: string | null;
    secondaryThumbnailUrl?: string | null;
    isDeemphasized?: boolean;
    userState?: string | null;
    work?: { title: string; authors: string } | null;
  };
  timezone: string;
  tileAspect?: AppSettings["tileAspect"];
  showStateActions?: boolean;
  showOverride?: boolean;
  hideImages?: boolean;
  showDateBadge?: boolean;
  stateAction?: "read" | "unread";
  followWorkId?: string | null;
  followReleaseId?: string | null;
}) {
  const workTitle = item.work?.title && !isGenericContentTitle(item.work.title) ? item.work.title : null;
  const displayTitle = workTitle ?? item.title ?? item.work?.title ?? "タイトル不明";
  const openHref = `/api/private/open?url=${encodeURIComponent(item.canonicalUrl)}&releaseId=${encodeURIComponent(item.id)}`;
  const dateBadge = showDateBadge && item.publishedAt ? formatTinyDate(item.publishedAt, timezone) : null;
  const semanticBadge =
    item.semanticKind !== "main_episode"
      ? semanticLabels[item.semanticKind as keyof typeof semanticLabels] ?? item.semanticKind
      : null;
  const stateClass =
    item.userState === "unread"
      ? "border-ember/60 ring-1 ring-ember/20"
      : item.userState === "read"
        ? "border-emerald-600/24"
        : "";
  const actionButtons = (
    <>
      {showStateActions ? (
        <ActionButton
          endpoint={
            stateAction === "unread"
              ? `/api/private/release/${item.id}/unread`
              : `/api/private/release/${item.id}/read`
          }
          label={stateAction === "unread" ? "未読に戻す" : "読了"}
          undoEndpoint={
            stateAction === "unread"
              ? `/api/private/release/${item.id}/read`
              : `/api/private/release/${item.id}/unread`
          }
          icon={stateAction === "unread" ? "rotate-ccw" : "check"}
          hideLabel
          className="h-4 w-4 border-ink/8 bg-white/70 text-ink/62 [&_svg]:h-2.5 [&_svg]:w-2.5"
        />
      ) : null}
      {followWorkId || followReleaseId ? (
        <ActionButton
          endpoint={followWorkId ? `/api/private/work/${followWorkId}/follow` : `/api/private/release/${followReleaseId}/follow-work`}
          label="フォロー"
          icon="plus"
          hideLabel
          variant="solid"
          className="h-4 w-4 border-ink/8 bg-white/70 text-ink/62 [&_svg]:h-2.5 [&_svg]:w-2.5"
        />
      ) : null}
    </>
  );

  if (hideImages) {
    return (
      <MetadataTile
        title={displayTitle}
        href={openHref}
        siteId={item.siteId}
        deemphasized={item.isDeemphasized}
        className={stateClass}
        actions={showStateActions || followWorkId || followReleaseId ? actionButtons : null}
        badges={
          <>
            {item.isDeemphasized ? <MetadataBadge variant="paid">有料</MetadataBadge> : null}
            {semanticBadge ? <MetadataBadge variant="semantic">{semanticBadge}</MetadataBadge> : null}
            {dateBadge ? <MetadataBadge variant="date">{dateBadge}</MetadataBadge> : null}
          </>
        }
      />
    );
  }

  return (
    <article
      className={cn(
        "overflow-hidden rounded-[9px] border bg-white shadow-sm",
        stateClass || "border-ink/10"
      )}
    >
      <div className={`relative ${tileAspect === "poster" ? "aspect-[2/3]" : tileAspect === "square" ? "aspect-square" : "aspect-[3/2]"}`}>
        <a
          href={openHref}
          target="_blank"
          rel="noreferrer"
          aria-label={`${displayTitle} を公式で開く`}
          className="absolute inset-0 z-10"
        />
        <CoverThumb
          src={hideImages ? null : item.thumbnailUrl}
          secondarySrc={hideImages ? null : item.secondaryThumbnailUrl}
          alt={displayTitle}
          siteId={item.siteId}
          showSiteFallback={!hideImages}
          className="absolute inset-0 h-full w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/96 via-ink/38 via-28% to-transparent" />
        {item.isDeemphasized ? (
          <>
            <div className="absolute inset-0 bg-[rgba(15,23,42,0.34)]" />
            <div className="absolute inset-0 bg-[repeating-linear-gradient(-45deg,rgba(148,163,184,0.48)_0,rgba(148,163,184,0.48)_7px,rgba(30,41,59,0.34)_7px,rgba(30,41,59,0.34)_14px)]" />
          </>
        ) : null}

        <div className="absolute left-1 top-1 flex items-center gap-1">
          <SitePill siteId={item.siteId} compact />
          {item.isDeemphasized ? (
            <span className="rounded bg-white/92 px-1 py-0.5 text-[8px] font-semibold leading-none text-ink/72">有料</span>
          ) : null}
        </div>

        <div className="absolute right-1 top-1 z-20 flex flex-col gap-1">
          {actionButtons}
        </div>

        <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 ${compactTileOverlayInsetClass}`}>
          <div className={compactTileOverlayBandClass}>
            <h3 className={item.isDeemphasized ? `${compactTileTitleClass} text-white/88` : compactTileTitleClass}>
              {displayTitle}
            </h3>
          </div>
        </div>
        {semanticBadge || dateBadge ? (
          <div className="pointer-events-none absolute bottom-0.5 right-0.5 z-30 flex flex-col items-end gap-0.5">
            {semanticBadge ? (
              <span className="rounded-[3px] bg-black/52 px-1 py-0.5 text-[7px] font-semibold leading-none text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.65)]">
                {semanticBadge}
              </span>
            ) : null}
            {dateBadge ? (
              <span className="rounded-[3px] bg-black/32 px-0.5 text-[6px] font-semibold leading-[1.05] text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.65)]">
                {dateBadge}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {showOverride ? (
        <div className="border-t border-ink/8 bg-white/96 px-1 py-0.5">
          <OverrideKindControl releaseId={item.id} value={item.semanticKind} />
        </div>
      ) : null}
    </article>
  );
}

function formatTinyDate(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: timezone,
    month: "numeric",
    day: "numeric"
  }).format(date);
}
