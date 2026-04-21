import { ReleaseRow } from "@/components/release-row";
import { groupFeedByDate, sortFeedByDateThenSite } from "@/lib/feed-order";
import { resolvePrivateImageMode } from "@/lib/image-policy";
import { getFollowedTimelineView } from "@/lib/queries/private";
import { getMetadataTileGridClass, getTileGridClass } from "@/lib/ui-layout";

export default async function FollowedPage() {
  const data = await getFollowedTimelineView();
  const imageMode = resolvePrivateImageMode(data.settings);
  const tileGridClass = imageMode.hideAllImages ? getMetadataTileGridClass(data.settings.tileDensity) : getTileGridClass(data.settings.tileDensity);
  const groups = groupFeedByDate(
    sortFeedByDateThenSite(data.items, data.settings.siteOrder, data.settings.timezone),
    data.settings.timezone
  );

  return (
    <div className="space-y-2">
      <section className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-[13px] font-semibold text-ink">フォロー更新</h1>
          <p className="text-[10px] text-ink/48">フォロー中作品だけ。未読は強めの枠、読了は薄い緑枠です。</p>
        </div>
        <p className="text-[10px] text-ink/46">{data.items.length}件</p>
      </section>

      <section className="space-y-1">
        <div className={tileGridClass}>
          {groups.length ? (
            groups.map((group) => (
              <div key={group.key} className="contents">
                <div className="col-span-full mt-0.5 flex items-center gap-1.5 text-[9px] font-semibold text-ink/40">
                  <span className="rounded bg-ink/[0.045] px-1.5 py-0.5 leading-none">{group.label}</span>
                  <span className="h-px flex-1 bg-ink/[0.055]" />
                </div>
                {group.items.map((item) => (
                  <ReleaseRow
                    key={item.openReleaseId}
                    item={{
                      id: item.openReleaseId,
                      title: item.title,
                      canonicalUrl: item.openUrl,
                      semanticKind: item.semanticKind,
                      publishedAt: item.publishedAt,
                      firstSeenAt: item.firstSeenAt,
                      siteId: item.siteId,
                      thumbnailUrl: imageMode.hideAllImages ? null : imageMode.preferPreviewSingle ? item.previewThumbnailUrl : item.thumbnailUrl,
                      secondaryThumbnailUrl: imageMode.allowSecondary && !imageMode.hideAllImages ? item.secondaryThumbnailUrl : null,
                      isDeemphasized: item.isPaidOnly,
                      userState: item.userState,
                      work: {
                        title: item.title,
                        authors: item.authors
                      }
                    }}
                    timezone={data.settings.timezone}
                    tileAspect={data.settings.tileAspect}
                    showStateActions
                    stateAction={item.userState === "read" ? "unread" : "read"}
                    showOverride={false}
                    hideImages={imageMode.hideAllImages}
                  />
                ))}
              </div>
            ))
          ) : (
            <div className="surface col-span-full px-3 py-4 text-[11px] text-ink/60">フォロー中の更新はまだありません。</div>
          )}
        </div>
      </section>
    </div>
  );
}
