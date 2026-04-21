import { ActionButton } from "@/components/action-button";
import { CoverThumb } from "@/components/cover-thumb";
import { MetadataBadge, MetadataTile } from "@/components/metadata-tile";
import { QuickAddPanel } from "@/components/quick-add-panel";
import { SitePill } from "@/components/site-pill";
import { requireSession } from "@/lib/auth/session";
import { resolvePrivateImageMode } from "@/lib/image-policy";
import { searchLibrary } from "@/lib/queries/private";
import {
  compactTileOverlayBandClass,
  compactTileOverlayInsetClass,
  compactTileTitleClass,
  getTileAspectClass,
  getMetadataTileGridClass,
  getTileGridClass
} from "@/lib/ui-layout";
import { getSettings } from "@/lib/settings";
import { extractPreviewThumbnailUrl, extractThumbnailUrl, extractWorkMeta, isGenericContentTitle, pickThumbnailUrl } from "@/lib/utils";

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";
  const session = await requireSession();
  const [results, settings] = await Promise.all([
    query ? searchLibrary(query) : Promise.resolve([]),
    getSettings(session.userId)
  ]);
  const tileAspectClass = getTileAspectClass(settings.tileAspect);
  const imageMode = resolvePrivateImageMode(settings);
  const tileGridClass = imageMode.hideAllImages ? getMetadataTileGridClass(settings.tileDensity) : getTileGridClass(settings.tileDensity);

  return (
    <div className="space-y-2">
      <section className="surface space-y-2 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h1 className="text-[13px] font-semibold text-ink">作品を探して追加</h1>
            <p className="text-[10px] text-ink/56">作品 URL をそのまま貼るか、作品名・作者名で検索します。</p>
          </div>
          <p className="text-[10px] text-ink/50">{query ? `${results.length}件` : "入力待ち"}</p>
        </div>
        <QuickAddPanel compact />
      </section>

      <div className={tileGridClass}>
        {results.map((item) => {
          const metaRelease = item.releases.find((release) => extractWorkMeta(release.extraJson).workTitle);
          const fallback = extractWorkMeta(metaRelease?.extraJson);
          const displayTitle = !isGenericContentTitle(item.title) ? item.title : fallback.workTitle ?? item.title;
          const thumbnailUrl = pickThumbnailUrl(
            ...item.releases.map((release) => extractThumbnailUrl(release.extraJson))
          );
          const previewThumbnailUrl = pickThumbnailUrl(
            ...item.releases.map((release) => extractPreviewThumbnailUrl(release.extraJson))
          );
          const followAction = (
            <ActionButton
              endpoint={`/api/private/work/${item.id}/${item.prefs[0]?.follow ? "unfollow" : "follow"}`}
              label={item.prefs[0]?.follow ? "フォロー解除" : "フォロー"}
              icon={item.prefs[0]?.follow ? "user-minus" : "plus"}
              hideLabel
              variant={item.prefs[0]?.follow ? "danger" : "solid"}
              className={item.prefs[0]?.follow ? "h-4 w-4 border-ink/8 bg-white/70 text-rose-700 [&_svg]:h-2.5 [&_svg]:w-2.5" : "h-4 w-4 border-ink/8 bg-white/70 text-ink/62 [&_svg]:h-2.5 [&_svg]:w-2.5"}
            />
          );

          if (imageMode.hideAllImages) {
            return (
              <MetadataTile
                key={item.id}
                title={displayTitle}
                href={item.releases[0]?.canonicalUrl || item.canonicalUrl}
                siteId={item.siteId}
                actions={followAction}
                badges={item.prefs[0]?.follow ? <MetadataBadge>フォロー中</MetadataBadge> : null}
              />
            );
          }

          return (
            <article key={item.id} className="overflow-hidden rounded-[9px] border border-ink/10 bg-white shadow-sm">
              <div className={`relative ${tileAspectClass}`}>
                <a
                  href={item.releases[0]?.canonicalUrl || item.canonicalUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${displayTitle} を公式で開く`}
                  className="absolute inset-0 z-10"
                />
                <CoverThumb
                  src={imageMode.hideAllImages ? null : imageMode.preferPreviewSingle ? previewThumbnailUrl : thumbnailUrl}
                  alt={displayTitle}
                  siteId={item.siteId}
                  showSiteFallback={!imageMode.hideAllImages}
                  className="absolute inset-0 h-full w-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/95 via-ink/34 via-28% to-transparent" />

                <div className="absolute left-1 top-1 flex items-center gap-1">
                  <SitePill siteId={item.siteId} compact />
                  {item.prefs[0]?.follow ? <span className="rounded bg-white/92 px-1 py-0.5 text-[9px] font-semibold text-ink/72">F</span> : null}
                </div>

                <div className="absolute right-1 top-1 z-20 flex flex-col gap-1">
                  {followAction}
                </div>

                <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 ${compactTileOverlayInsetClass}`}>
                  <div className={compactTileOverlayBandClass}>
                    <h2 className={compactTileTitleClass}>
                      {displayTitle}
                    </h2>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
