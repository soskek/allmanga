import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import { SettingsForms } from "@/components/settings-forms";
import { QuickAddPanel } from "@/components/quick-add-panel";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getSettings } from "@/lib/settings";

export default async function SettingsPage() {
  const session = await requireSession();
  const settings = await getSettings(session.userId);
  const canManageApp = session.role === "owner" || session.role === "admin";
  const sites = await prisma.site.findMany({
    orderBy: { name: "asc" }
  });

  return (
    <div className="space-y-3">
      <section className="surface flex flex-wrap items-center justify-between gap-2 p-2.5">
        <div className="space-y-0.5">
          <h1 className="text-[13px] font-semibold text-ink">設定</h1>
          <p className="text-[10px] text-ink/55">追い方やホームの見え方を整える場所です。迷ったら、まずは「使い方」を見るのがおすすめです。</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href="/guide" className="h-8 rounded-md border border-ink/10 bg-white px-3 text-[11px] font-medium text-ink/75">
            使い方
          </Link>
          {canManageApp ? (
            <ActionButton
              endpoint="/api/private/sync/run"
              label="同期"
              successMessage="同期を開始しました"
              icon="rotate-ccw"
              className="h-8 rounded-md bg-ink px-3 text-[11px] font-medium text-white"
            />
          ) : null}
        </div>
      </section>
      <QuickAddPanel />
      <SettingsForms
        timezone={settings.timezone}
        dayBoundaryHour={settings.dayBoundaryHour}
        discoverWindowDays={settings.discoverWindowDays}
        tileDensity={settings.tileDensity}
        tileAspect={settings.tileAspect}
        imagePolicy={settings.imagePolicy}
        siteOrder={settings.siteOrder}
        semanticDefaults={settings.semanticDefaults}
        canManageApp={canManageApp}
        siteRows={sites.map((site) => ({
          id: site.id,
          siteId: site.id,
          name: site.name,
          enabled: site.enabled
        }))}
      />
    </div>
  );
}
