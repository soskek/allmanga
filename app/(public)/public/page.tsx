import { PublicReleaseRow } from "@/components/public-release-row";
import { getPublicDiscover, getPublicRecent, toPublicRelease } from "@/lib/queries/public";
import { getDefaultSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function PublicPage() {
  const settings = getDefaultSettings();
  const [recent, discover] = await Promise.all([
    getPublicRecent(),
    getPublicDiscover()
  ]);

  return (
    <main className="page-shell space-y-4">
      <section className="surface flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.22em] text-ink/40">Public-safe metadata</p>
          <h1 className="text-base font-semibold text-ink">最近の更新と発見</h1>
          <p className="text-[11px] text-ink/55">作品名・作者名・サイト名・種別・日時・公式 URL のみを公開しています。</p>
        </div>
        <div className="text-[11px] text-ink/50">最近 {recent.length}件 / 発見 {discover.length}件</div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">最近の更新</h2>
          <p className="text-[11px] text-ink/50">metadata only</p>
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          {recent.map((item: Awaited<ReturnType<typeof getPublicRecent>>[number]) => (
            <PublicReleaseRow key={item.id} item={toPublicRelease(item)} timezone={settings.timezone} />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">新連載 / 読切</h2>
          <p className="text-[11px] text-ink/50">public-safe discovery</p>
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          {discover.map((item: Awaited<ReturnType<typeof getPublicDiscover>>[number]) => (
            <PublicReleaseRow key={item.id} item={toPublicRelease(item)} timezone={settings.timezone} />
          ))}
        </div>
      </section>
    </main>
  );
}
