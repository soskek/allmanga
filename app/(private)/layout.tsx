import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import { BottomNav } from "@/components/bottom-nav";
import { FocusRefresh } from "@/components/focus-refresh";
import { SiteIcon } from "@/components/site-icon";
import { ToastProvider } from "@/components/toast-provider";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const [latestSyncRun, settings, sites] = await Promise.all([
    prisma.syncRun.findFirst({
      orderBy: { startedAt: "desc" }
    }),
    getSettings(session.userId),
    prisma.site.findMany({
      where: { enabled: true },
      select: { id: true, name: true, baseUrl: true }
    })
  ]);
  const siteOrderIndex = new Map(settings.siteOrder.map((siteId, index) => [siteId, index]));
  const orderedSites = [...sites].sort((left, right) => {
    const leftIndex = siteOrderIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = siteOrderIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });

  return (
    <ToastProvider>
      <FocusRefresh />
      <main className="page-shell space-y-2.5">
        <header className="space-y-1 border-b border-ink/8 pb-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Link href="/" className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/58">
                AllManga
              </Link>
              <div className="hidden items-center gap-1 md:flex">
                {orderedSites.map((site) => (
                  <a
                    key={site.id}
                    href={site.baseUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={`${site.name} を開く`}
                    aria-label={`${site.name} を開く`}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-[6px] border border-ink/8 bg-white/76 text-ink/70 hover:bg-white"
                  >
                    <SiteIcon siteId={site.id} className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            </div>
            <div className="hidden items-center gap-1 lg:flex">
              <div className="text-[9px] text-ink/46">同期 {formatDateTime(latestSyncRun?.startedAt ?? null, settings.timezone)}</div>
              <ActionButton
                endpoint="/api/private/sync/run"
                label="同期"
                successMessage="同期を開始しました"
                icon="rotate-ccw"
                className="h-5 rounded bg-ink px-1.5 py-0.5 text-[10px] font-medium text-white"
              />
              <Link href="/" className="rounded px-1.5 py-0.5 text-[10px] font-medium text-ink/70 hover:bg-white/70">
                ホーム
              </Link>
              <Link href="/discover" className="rounded px-1.5 py-0.5 text-[10px] font-medium text-ink/70 hover:bg-white/70">
                発見
              </Link>
              <Link href="/followed" className="rounded px-1.5 py-0.5 text-[10px] font-medium text-ink/70 hover:bg-white/70">
                フォロー
              </Link>
              <Link href="/library" className="rounded px-1.5 py-0.5 text-[10px] font-medium text-ink/70 hover:bg-white/70">
                ライブラリ
              </Link>
              <Link href="/search" className="rounded px-1.5 py-0.5 text-[10px] font-medium text-ink/70 hover:bg-white/70">
                検索
              </Link>
              <Link href="/settings" className="rounded px-1.5 py-0.5 text-[10px] font-medium text-ink/70 hover:bg-white/70">
                設定
              </Link>
              <Link href="/guide" className="rounded px-1.5 py-0.5 text-[10px] font-medium text-ink/70 hover:bg-white/70">
                使い方
              </Link>
              <form action="/api/auth/logout" method="post">
                <button className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-medium text-white">ログアウト</button>
              </form>
            </div>
            <div className="flex items-center gap-1 lg:hidden">
              <div className="text-[9px] text-ink/46">同期 {formatDateTime(latestSyncRun?.startedAt ?? null, settings.timezone)}</div>
              <ActionButton
                endpoint="/api/private/sync/run"
                label="同期"
                successMessage="同期を開始しました"
                icon="rotate-ccw"
                hideLabel
                className="h-5 w-5 rounded bg-ink p-0 text-white"
              />
            </div>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 md:hidden">
            {orderedSites.map((site) => (
              <a
                key={site.id}
                href={site.baseUrl}
                target="_blank"
                rel="noreferrer"
                title={`${site.name} を開く`}
                aria-label={`${site.name} を開く`}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border border-ink/8 bg-white/76 text-ink/70 hover:bg-white"
              >
                <SiteIcon siteId={site.id} className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        </header>
        {children}
      </main>
      <BottomNav />
    </ToastProvider>
  );
}
