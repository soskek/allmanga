import { Pin as PinIcon, VolumeX } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { CoverThumb } from "@/components/cover-thumb";
import { MetadataBadge, MetadataTile } from "@/components/metadata-tile";
import { SitePill } from "@/components/site-pill";
import { WorkPrefEditor } from "@/components/work-pref-editor";
import {
  compactTileOverlayBandClass,
  compactTileOverlayInsetClass,
  compactTileTitleClass
} from "@/lib/ui-layout";
import type { AppSettings } from "@/lib/settings";
import { extractPreviewThumbnailUrl, extractThumbnailUrl, extractWorkMeta, isGenericContentTitle, pickThumbnailUrl } from "@/lib/utils";

export function LibraryCard({
  item,
  tileAspect = "wide",
  hideImages = false,
  preferPreviewSingle = false
}: {
  tileAspect?: AppSettings["tileAspect"];
  hideImages?: boolean;
  preferPreviewSingle?: boolean;
  item: {
    follow: boolean;
    mute: boolean;
    pin: boolean;
    priority: number;
    showSideStory: string;
    showIllustration: string;
    showPromotion: string;
    work: {
      id: string;
      title: string;
      canonicalUrl: string;
      siteId: string;
      site: { name: string };
      releases: Array<{ id: string; title: string | null; canonicalUrl: string; extraJson?: string | null }>;
    };
  };
}) {
  const firstThumbRelease = item.work.releases.find((release) => extractThumbnailUrl(release.extraJson));
  const firstMetaRelease = item.work.releases.find((release) => extractWorkMeta(release.extraJson).workTitle);
  const fallbackMeta = extractWorkMeta(firstMetaRelease?.extraJson);
  const displayTitle = !isGenericContentTitle(item.work.title) ? item.work.title : fallbackMeta.workTitle ?? item.work.title;
  const openUrl = item.work.releases[0]?.canonicalUrl || item.work.canonicalUrl;
  const thumbnailUrl = pickThumbnailUrl(
    extractThumbnailUrl(firstThumbRelease?.extraJson),
    extractThumbnailUrl(item.work.releases[0]?.extraJson)
  );
  const previewThumbnailUrl = pickThumbnailUrl(
    extractPreviewThumbnailUrl(firstThumbRelease?.extraJson),
    extractPreviewThumbnailUrl(item.work.releases[0]?.extraJson)
  );
  const topActions = (
    <>
      <ActionButton endpoint={`/api/private/work/${item.work.id}/pin`} label={item.pin ? "ピン解除" : "ピン"} body={{ pin: !item.pin }} icon="pin" hideLabel className="h-4 w-4 border-ink/8 bg-white/70 text-ink/62 [&_svg]:h-2.5 [&_svg]:w-2.5" successMessage={item.pin ? "ピンを外しました" : "ピン留めしました"} />
      <ActionButton endpoint={`/api/private/work/${item.work.id}/mute`} label={item.mute ? "ミュート解除" : "ミュート"} body={{ mute: !item.mute }} icon="volume-x" hideLabel className="h-4 w-4 border-ink/8 bg-white/70 text-ink/62 [&_svg]:h-2.5 [&_svg]:w-2.5" successMessage={item.mute ? "ミュートを解除しました" : "ミュートしました"} />
      {item.follow ? (
        <ActionButton
          endpoint={`/api/private/work/${item.work.id}/unfollow`}
          label="フォロー解除"
          icon="user-minus"
          hideLabel
          undoEndpoint={`/api/private/work/${item.work.id}/follow`}
          successMessage="フォローを解除しました"
          className="h-4 w-4 border-ink/8 bg-white/70 text-ink/62 [&_svg]:h-2.5 [&_svg]:w-2.5"
        />
      ) : null}
    </>
  );

  const cardFace = hideImages ? (
    <MetadataTile
      title={displayTitle}
      href={openUrl}
      siteId={item.work.siteId}
      actions={topActions}
      badges={
        <>
          {item.pin ? <MetadataBadge>ピン</MetadataBadge> : null}
          {item.mute ? <MetadataBadge>ミュート</MetadataBadge> : null}
        </>
      }
    />
  ) : (
    <div className="overflow-hidden rounded-[9px] border border-ink/10 bg-white shadow-sm">
      <div className={`relative ${tileAspect === "poster" ? "aspect-[2/3]" : tileAspect === "square" ? "aspect-square" : "aspect-[3/2]"}`}>
        <a
          href={openUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`${displayTitle} を公式で開く`}
          className="absolute inset-0 z-10"
        />
        <CoverThumb
          src={preferPreviewSingle ? previewThumbnailUrl : thumbnailUrl}
          alt={displayTitle}
          siteId={item.work.siteId}
          showSiteFallback
          className="absolute inset-0 h-full w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/96 via-ink/38 via-28% to-transparent" />

        <div className="absolute left-1 top-1 flex items-center gap-1">
          <SitePill siteId={item.work.siteId} compact />
          {item.pin ? (
            <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-[6px] bg-white/92 text-ink/78 shadow-sm">
              <PinIcon className="h-2.5 w-2.5" />
            </span>
          ) : null}
          {item.mute ? (
            <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-[6px] bg-white/92 text-ink/78 shadow-sm">
              <VolumeX className="h-2.5 w-2.5" />
            </span>
          ) : null}
        </div>

        <div className="absolute right-1 top-1 z-20 flex flex-col gap-1">{topActions}</div>

        <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 ${compactTileOverlayInsetClass}`}>
          <div className={compactTileOverlayBandClass}>
            <h3 className={compactTileTitleClass}>
              {displayTitle}
            </h3>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <article className="space-y-0.5">
      {cardFace}

      <details className="surface-muted group">
        <summary className="cursor-pointer list-none px-1.5 py-1 text-[10px] font-medium text-ink/58">
          操作・表示設定
        </summary>
        <div className="space-y-1 px-1 py-1 pb-1.5">
          <div className="grid grid-cols-3 gap-1">
            {item.follow ? (
              <ActionButton
                endpoint={`/api/private/work/${item.work.id}/unfollow`}
                label="フォロー解除"
                icon="user-minus"
                variant="danger"
                undoEndpoint={`/api/private/work/${item.work.id}/follow`}
                successMessage="フォローを解除しました"
              />
            ) : (
              <ActionButton
                endpoint={`/api/private/work/${item.work.id}/follow`}
                label="フォロー"
                icon="plus"
                variant="solid"
                successMessage="フォローしました"
              />
            )}
            <ActionButton
              endpoint={`/api/private/work/${item.work.id}/pin`}
              label={item.pin ? "ピン解除" : "ピン"}
              body={{ pin: !item.pin }}
              icon="pin"
              successMessage={item.pin ? "ピンを外しました" : "ピン留めしました"}
            />
            <ActionButton
              endpoint={`/api/private/work/${item.work.id}/mute`}
              label={item.mute ? "ミュート解除" : "ミュート"}
              body={{ mute: !item.mute }}
              icon="volume-x"
              successMessage={item.mute ? "ミュートを解除しました" : "ミュートしました"}
            />
          </div>
          <p className="text-[10px] leading-snug text-ink/50">
            フォローは未読管理、ピンは上位固定、ミュートは発見・新着で控えめにする設定です。
          </p>
          <WorkPrefEditor
            workId={item.work.id}
            priority={item.priority}
            showSideStory={item.showSideStory}
            showIllustration={item.showIllustration}
            showPromotion={item.showPromotion}
          />
        </div>
      </details>
    </article>
  );
}
