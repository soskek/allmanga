import { ReleaseRow } from "@/components/release-row";
import { requireSession } from "@/lib/auth/session";
import { resolvePrivateImageMode } from "@/lib/image-policy";
import { getDiscoverView } from "@/lib/queries/private";
import { getSettings } from "@/lib/settings";
import { getMetadataTileGridClass, getTileGridClass } from "@/lib/ui-layout";
import { extractPreviewThumbnailUrl, extractThumbnailUrl, extractWorkMeta, isGenericContentTitle, pickThumbnailUrl } from "@/lib/utils";

function resolveDisplayWork(item: {
  title: string | null;
  extraJson?: string | null;
  work?: { title: string; authors: string; releases?: Array<{ extraJson?: string | null }> } | null;
}) {
  const fallback = extractWorkMeta(item.extraJson);
  const resolvedTitle = item.work && !isGenericContentTitle(item.work.title) ? item.work.title : fallback.workTitle;

  return {
    title: resolvedTitle ?? item.title ?? item.work?.title ?? "タイトル不明",
    authors: item.work?.authors ?? JSON.stringify(fallback.authors),
    previewThumbnailUrl: pickThumbnailUrl(
      extractPreviewThumbnailUrl(item.extraJson),
      extractPreviewThumbnailUrl(item.work?.releases?.[0]?.extraJson)
    ),
    thumbnailUrl: pickThumbnailUrl(
      (item as { resolvedThumbnailUrl?: string | null }).resolvedThumbnailUrl,
      extractThumbnailUrl(item.extraJson),
      extractThumbnailUrl(item.work?.releases?.[0]?.extraJson)
    ),
    secondaryThumbnailUrl: pickThumbnailUrl((item as { resolvedSecondaryThumbnailUrl?: string | null }).resolvedSecondaryThumbnailUrl)
  };
}

export default async function DiscoverPage() {
  const session = await requireSession();
  const [items, settings] = await Promise.all([getDiscoverView(), getSettings(session.userId)]);
  const imageMode = resolvePrivateImageMode(settings);
  const tileGridClass = imageMode.hideAllImages ? getMetadataTileGridClass(settings.tileDensity) : getTileGridClass(settings.tileDensity);

  return (
    <div className="space-y-2">
      <section className="flex items-center justify-between gap-2">
        <h1 className="text-[12px] font-semibold text-ink">発見</h1>
        <p className="text-[10px] text-ink/46">{items.length}件</p>
      </section>

      <div className={tileGridClass}>
        {items.map((item) => {
          const display = resolveDisplayWork(item);
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
                thumbnailUrl: imageMode.hideAllImages ? null : imageMode.preferPreviewSingle ? display.previewThumbnailUrl : display.thumbnailUrl,
                secondaryThumbnailUrl: imageMode.allowSecondary && !imageMode.hideAllImages ? display.secondaryThumbnailUrl : null,
                work: {
                  title: display.title,
                  authors: display.authors
                }
              }}
              timezone={settings.timezone}
              tileAspect={settings.tileAspect}
              showStateActions={false}
              showOverride={false}
              hideImages={imageMode.hideAllImages}
              showDateBadge
              followWorkId={item.work && !item.work.prefs?.[0]?.follow ? item.work.id : null}
              followReleaseId={!item.work ? item.id : null}
            />
          );
        })}
      </div>
    </div>
  );
}
