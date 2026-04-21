import { LibraryCard } from "@/components/library-card";
import { QuickAddPanel } from "@/components/quick-add-panel";
import { requireSession } from "@/lib/auth/session";
import { resolvePrivateImageMode } from "@/lib/image-policy";
import { getLibraryView } from "@/lib/queries/private";
import { getSettings } from "@/lib/settings";
import { getMetadataTileGridClass, getTileGridClass } from "@/lib/ui-layout";

export default async function LibraryPage() {
  const session = await requireSession();
  const [items, settings] = await Promise.all([getLibraryView(), getSettings(session.userId)]);
  const imageMode = resolvePrivateImageMode(settings);
  const tileGridClass = imageMode.hideAllImages ? getMetadataTileGridClass(settings.tileDensity) : getTileGridClass(settings.tileDensity);
  const followed = items.filter((item) => item.follow && !item.mute);
  const pinned = items.filter((item) => item.pin);
  const muted = items.filter((item) => item.mute);

  return (
    <div className="space-y-2.5">
      <section className="surface space-y-2 p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <h1 className="text-[13px] font-semibold text-ink">追う作品を管理</h1>
            <p className="text-[10px] text-ink/56">フォローした作品だけ未読管理します。不要ならフォロー解除、見たくない作品はミュートで発見・新着から抑えます。</p>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-1 text-center text-[10px] text-ink/56">
            <div className="rounded-md bg-white px-2 py-1">
              <div className="text-[11px] font-semibold text-ink">{followed.length}</div>
              <div>追う</div>
            </div>
            <div className="rounded-md bg-white px-2 py-1">
              <div className="text-[11px] font-semibold text-ink">{pinned.length}</div>
              <div>ピン</div>
            </div>
            <div className="rounded-md bg-white px-2 py-1">
              <div className="text-[11px] font-semibold text-ink">{muted.length}</div>
              <div>ミュート</div>
            </div>
          </div>
        </div>
        <div className="grid gap-1 text-[10px] text-ink/58 sm:grid-cols-3">
          <p className="rounded-md bg-white/72 px-2 py-1"><span className="font-semibold text-ink/82">フォロー</span> 未読スタックの対象</p>
          <p className="rounded-md bg-white/72 px-2 py-1"><span className="font-semibold text-ink/82">ピン</span> ホームや一覧で上位へ</p>
          <p className="rounded-md bg-white/72 px-2 py-1"><span className="font-semibold text-ink/82">ミュート</span> 興味ない作品を控えめに</p>
        </div>
        <QuickAddPanel compact />
      </section>

      <section className="flex items-center justify-between gap-2">
        <h2 className="text-[12px] font-semibold text-ink">ライブラリ</h2>
        <p className="text-[10px] text-ink/50">{items.length}作品</p>
      </section>

      <div className={tileGridClass}>
        {items.map((item) => (
          <LibraryCard
            key={item.workId}
            item={item}
            tileAspect={settings.tileAspect}
            hideImages={imageMode.hideAllImages}
            preferPreviewSingle={imageMode.preferPreviewSingle}
          />
        ))}
      </div>
    </div>
  );
}
