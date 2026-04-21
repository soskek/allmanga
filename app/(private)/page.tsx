import Link from "next/link";
import { ReleaseRow } from "@/components/release-row";
import { WorkStackCard } from "@/components/work-stack-card";
import { groupFeedByDate, sortFeedByDateThenSite, sortFeedByUserSiteOrder } from "@/lib/feed-order";
import { resolvePrivateImageMode } from "@/lib/image-policy";
import { getHomeView } from "@/lib/queries/private";
import { getMetadataTileGridClass, getTileGridClass } from "@/lib/ui-layout";

export default async function HomePage() {
  const data = await getHomeView();
  const imageMode = resolvePrivateImageMode(data.settings);
  const tileGridClass = imageMode.hideAllImages ? getMetadataTileGridClass(data.settings.tileDensity) : getTileGridClass(data.settings.tileDensity);
  const orderedTodayFeed = sortFeedByUserSiteOrder(data.todayFeed, data.settings.siteOrder);
  const recentGroups = groupFeedByDate(
    sortFeedByDateThenSite(data.recentMainFeed, data.settings.siteOrder, data.settings.timezone),
    data.settings.timezone
  );

  return (
    <div className="space-y-2">
      <section className="space-y-1">
        <div className="flex items-center justify-between">
          <h2 className="text-[12px] font-semibold text-ink">未読スタック</h2>
          <p className="text-[10px] text-ink/46">{data.unreadStack.length}</p>
        </div>
        <div className={tileGridClass}>
          {data.unreadStack.length ? (
            data.unreadStack.map((card) => (
              <WorkStackCard
                key={card.workId}
                card={card}
                tileAspect={data.settings.tileAspect}
                hideImages={imageMode.hideAllImages}
                allowSecondary={imageMode.allowSecondary}
              />
            ))
          ) : (
            <div className="surface col-span-full px-3 py-4 text-[11px] text-ink/60">未読スタックは空です。</div>
          )}
        </div>
      </section>

      {data.todayReadFeed.length ? (
        <section className="space-y-1">
          <div className="flex items-center justify-between">
            <h2 className="text-[12px] font-semibold text-ink">今日の読了</h2>
            <p className="text-[10px] text-ink/46">すぐ戻せます</p>
          </div>
          <div className={tileGridClass}>
            {data.todayReadFeed.map((item) => (
              <ReleaseRow
                key={`read-${item.openReleaseId}`}
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
                stateAction="unread"
                showOverride={false}
                hideImages={imageMode.hideAllImages}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-1">
        <div className="flex items-center justify-between">
          <h2 className="text-[12px] font-semibold text-ink">発見</h2>
          <p className="text-[10px] text-ink/46">{data.discover.length}件</p>
        </div>
        <div className={tileGridClass}>
          {data.discover.map((item) => {
            return (
              <ReleaseRow
                key={item.id}
                item={{
                  id: item.id,
                  title: item.title,
                  canonicalUrl: item.canonicalUrl,
                  semanticKind: item.semanticKind,
                  publishedAt: item.publishedAt,
                  firstSeenAt: item.firstSeenAt,
                  siteId: item.siteId,
                  thumbnailUrl: imageMode.hideAllImages ? null : imageMode.preferPreviewSingle ? item.previewThumbnailUrl : item.thumbnailUrl,
                  secondaryThumbnailUrl: null,
                  isDeemphasized: item.isPaidOnly,
                  work: {
                    title: item.title,
                    authors: item.authors
                  }
                }}
                timezone={data.settings.timezone}
                tileAspect={data.settings.tileAspect}
                showStateActions={false}
                showOverride={false}
                hideImages={imageMode.hideAllImages}
                showDateBadge
                followWorkId={item.followWorkId}
                followReleaseId={item.followReleaseId}
              />
            );
          })}
        </div>
      </section>

      <section className="space-y-1">
        <div className="flex items-center justify-between">
          <h2 className="text-[12px] font-semibold text-ink">今日の更新</h2>
          <p className="text-[10px] text-ink/46">サイト順</p>
        </div>
        <div className={tileGridClass}>
          {orderedTodayFeed.map((item) => {
            return (
              <ReleaseRow
                key={item.workKey}
                item={{
                  id: item.openReleaseId,
                  title: item.title,
                  canonicalUrl: item.openUrl,
                  semanticKind: item.semanticKind,
                  publishedAt: item.publishedAt,
                  firstSeenAt: item.firstSeenAt,
                  siteId: item.siteId,
                  thumbnailUrl: imageMode.hideAllImages ? null : imageMode.preferPreviewSingle ? item.previewThumbnailUrl : item.thumbnailUrl,
                  secondaryThumbnailUrl: null,
                  isDeemphasized: item.isPaidOnly,
                  work: {
                    title: item.title,
                    authors: item.authors
                  }
                }}
                timezone={data.settings.timezone}
                tileAspect={data.settings.tileAspect}
                showStateActions={item.followed}
                showOverride={false}
                hideImages={imageMode.hideAllImages}
                followWorkId={item.followWorkId}
                followReleaseId={item.followReleaseId}
              />
            );
          })}
        </div>
      </section>

      <section className="flex items-center justify-between gap-2 text-[10px] text-ink/42">
        <div>
          非表示 {data.hiddenCount}件
          <span className="ml-1">PR {data.hiddenBreakdown.promotion} / 告知 {data.hiddenBreakdown.announcement}</span>
        </div>
        <Link href="/settings" className="font-medium text-ink/56">
          表示設定
        </Link>
      </section>

      <section className="space-y-1">
        <div className="flex items-center justify-between">
          <h2 className="text-[12px] font-semibold text-ink">少し前の更新</h2>
          <p className="text-[10px] text-ink/46">日付順</p>
        </div>
        <div className={tileGridClass}>
          {recentGroups.map((group) => (
            <div key={group.key} className="contents">
              <div className="col-span-full mt-0.5 flex items-center gap-1.5 text-[9px] font-semibold text-ink/40">
                <span className="rounded bg-ink/[0.045] px-1.5 py-0.5 leading-none">{group.label}</span>
                <span className="h-px flex-1 bg-ink/[0.055]" />
              </div>
              {group.items.map((item) => {
                return (
                  <ReleaseRow
                    key={`recent-${item.workKey}`}
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
                      work: {
                        title: item.title,
                        authors: item.authors
                      }
                    }}
                    timezone={data.settings.timezone}
                    tileAspect={data.settings.tileAspect}
                    showStateActions={item.followed}
                    showOverride={false}
                    hideImages={imageMode.hideAllImages}
                    followWorkId={item.followWorkId}
                    followReleaseId={item.followReleaseId}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
