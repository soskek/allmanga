"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { SitePill } from "@/components/site-pill";
import { semanticLabels } from "@/lib/domain";

export function SettingsForms({
  timezone,
  dayBoundaryHour,
  discoverWindowDays,
  tileDensity,
  tileAspect,
  imagePolicy,
  siteOrder,
  siteRows,
  semanticDefaults,
  canManageApp = false
}: {
  timezone: string;
  dayBoundaryHour: number;
  discoverWindowDays: number;
  tileDensity: "denser" | "compact" | "roomy";
  tileAspect: "wide" | "poster" | "square";
  imagePolicy: "strict_metadata" | "preview_safe" | "private_rich";
  siteOrder: string[];
  siteRows: Array<{ id: string; siteId: string; name: string; enabled: boolean }>;
  semanticDefaults: Record<string, string>;
  canManageApp?: boolean;
}) {
  const router = useRouter();
  const [importText, setImportText] = useState("");
  const [orderedSiteIds, setOrderedSiteIds] = useState(siteOrder);
  const siteOrderIndex = new Map(orderedSiteIds.map((siteId, index) => [siteId, index]));
  const orderedSiteRows = [...siteRows].sort((left, right) => {
    const leftIndex = siteOrderIndex.get(left.siteId) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = siteOrderIndex.get(right.siteId) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });

  async function saveSiteOrder(nextSiteIds: string[]) {
    setOrderedSiteIds(nextSiteIds);
    await fetch("/api/private/settings/general", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ siteOrder: nextSiteIds })
    });
    router.refresh();
  }

  function moveSite(siteId: string, direction: -1 | 1) {
    const index = orderedSiteIds.indexOf(siteId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= orderedSiteIds.length) {
      return;
    }
    const nextSiteIds = [...orderedSiteIds];
    [nextSiteIds[index], nextSiteIds[nextIndex]] = [nextSiteIds[nextIndex], nextSiteIds[index]];
    void saveSiteOrder(nextSiteIds);
  }

  return (
    <div className="space-y-3">
      <section className="surface space-y-3 p-2.5">
        <div className="space-y-0.5">
          <h2 className="text-[12px] font-semibold text-ink">更新の扱い</h2>
          <p className="text-[10px] text-ink/56">ホームで「今日の更新」と「未読スタック」をどう分けるかを決めます。</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-[12px] text-ink/72">
            <span>時間の基準</span>
            <input
              defaultValue={timezone}
              className="form-input"
              onBlur={async (event) => {
                await fetch("/api/private/settings/general", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ timezone: event.target.value })
                });
                router.refresh();
              }}
            />
            <span className="block text-[10px] text-ink/50">通常はそのままで大丈夫です。日本なら `Asia/Tokyo` です。</span>
          </label>
          <label className="space-y-1 text-[12px] text-ink/72">
            <span>今日からスタックへ切り替える時刻</span>
            <input
              type="number"
              min={0}
              max={23}
              defaultValue={dayBoundaryHour}
              className="form-input"
              onBlur={async (event) => {
                await fetch("/api/private/settings/general", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ dayBoundaryHour: Number(event.target.value) })
                });
                router.refresh();
              }}
            />
            <span className="block text-[10px] text-ink/50">例: `4` にすると、朝4:00までは前日の続きとして扱います。</span>
          </label>
          <label className="space-y-1 text-[12px] text-ink/72">
            <span>発見を残す日数</span>
            <input
              type="number"
              min={1}
              max={30}
              defaultValue={discoverWindowDays}
              className="form-input"
              onBlur={async (event) => {
                await fetch("/api/private/settings/general", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ discoverWindowDays: Number(event.target.value) })
                });
                router.refresh();
              }}
            />
            <span className="block text-[10px] text-ink/50">読切や新作をホームの「発見」に何日残すかです。標準は7日です。</span>
          </label>
        </div>
      </section>

      <section className="surface space-y-3 p-2.5">
        <div className="space-y-0.5">
          <h2 className="text-[12px] font-semibold text-ink">一覧の見た目</h2>
          <p className="text-[10px] text-ink/56">ホームや発見で出る作品カードの見え方を変えます。</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-[12px] text-ink/72">
            <span>カード密度</span>
            <select
              defaultValue={tileDensity}
              className="form-select"
              onChange={async (event) => {
                await fetch("/api/private/settings/general", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ tileDensity: event.target.value })
                });
                router.refresh();
              }}
            >
              <option value="denser">小さめ</option>
              <option value="compact">標準</option>
              <option value="roomy">大きめ</option>
            </select>
            <span className="block text-[10px] text-ink/50">1画面にたくさん出したいなら「小さめ」、見やすさ優先なら「大きめ」です。</span>
          </label>
          <label className="space-y-1 text-[12px] text-ink/72">
            <span>カード比率</span>
            <select
              defaultValue={tileAspect}
              className="form-select"
              onChange={async (event) => {
                await fetch("/api/private/settings/general", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ tileAspect: event.target.value })
                });
                router.refresh();
              }}
            >
              <option value="wide">横長</option>
              <option value="poster">縦長</option>
              <option value="square">正方形</option>
            </select>
            <span className="block text-[10px] text-ink/50">サムネを広く見たいなら横長、表紙感を出すなら縦長です。</span>
          </label>
          <label className="space-y-1 text-[12px] text-ink/72 sm:col-span-2">
            <span>画像の扱い</span>
            <select
              defaultValue={imagePolicy}
              className="form-select"
              onChange={async (event) => {
                await fetch("/api/private/settings/general", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ imagePolicy: event.target.value })
                });
                router.refresh();
              }}
            >
              <option value="strict_metadata">画像なし（文字とリンクだけ）</option>
              <option value="preview_safe">プレビュー画像のみ（おすすめ）</option>
              <option value="private_rich">作品画像と回画像も使う</option>
            </select>
            <span className="block text-[10px] text-ink/50">「プレビュー画像のみ」は、各サイトが一覧・OGP・Card 用に公開している代表画像を 1 枚だけ使います。一般向けに近い運用なら「画像なし」かこれがおすすめです。</span>
          </label>
        </div>
      </section>

      <section className="surface space-y-3 p-2.5">
        <div className="space-y-0.5">
          <h2 className="text-[12px] font-semibold text-ink">ノイズの扱い</h2>
          <p className="text-[10px] text-ink/56">番外編・イラスト・PR などを、ホームでどれくらい目立たせるかを決めます。</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(semanticDefaults).map(([key, value]) => (
            <label key={key} className="space-y-1 text-[12px] text-ink/72">
              <span>{semanticLabels[key as keyof typeof semanticLabels] ?? key}</span>
              <select
                defaultValue={value}
                className="form-select"
                onChange={async (event) => {
                  await fetch("/api/private/settings/general", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      semanticDefaults: {
                        ...semanticDefaults,
                        [key]: event.target.value
                      }
                    })
                  });
                  router.refresh();
                }}
              >
                <option value="stack">ホームに出す</option>
                <option value="collapsed">たたむ</option>
                <option value="hidden">隠す</option>
              </select>
            </label>
          ))}
        </div>
      </section>

      <section className="surface space-y-3 p-2.5">
        <div className="space-y-0.5">
          <h2 className="text-[12px] font-semibold text-ink">取り込みサイト</h2>
          <p className="text-[10px] text-ink/56">
            上下ボタンで「今日の更新」の並び順を変えられます。サイト全体の同期 ON/OFF は管理者だけが変更できます。
          </p>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {orderedSiteRows.map((site, index) => (
            <div key={site.id} className="flex items-center justify-between gap-2 rounded-md border border-ink/8 bg-white/80 px-2 py-1.5">
              <span className="flex min-w-0 items-center gap-1.5">
                <SitePill siteId={site.siteId} compact />
                <span className="inline-flex gap-1">
                  <button
                    type="button"
                    aria-label={`${site.name} を上へ`}
                    disabled={index === 0}
                    className="inline-flex h-5 w-5 items-center justify-center rounded border border-ink/10 text-ink/55 disabled:opacity-30"
                    onClick={() => moveSite(site.siteId, -1)}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label={`${site.name} を下へ`}
                    disabled={index === orderedSiteRows.length - 1}
                    className="inline-flex h-5 w-5 items-center justify-center rounded border border-ink/10 text-ink/55 disabled:opacity-30"
                    onClick={() => moveSite(site.siteId, 1)}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </span>
              </span>
              {canManageApp ? (
                <label className="flex items-center gap-1.5 text-[11px] text-ink/62">
                  <span>有効</span>
                  <input
                    type="checkbox"
                    defaultChecked={site.enabled}
                    className="h-4 w-4"
                    onChange={async (event) => {
                      await fetch("/api/private/settings/site", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ siteId: site.id, enabled: event.target.checked })
                      });
                      router.refresh();
                    }}
                  />
                </label>
              ) : (
                <span className="text-[10px] text-ink/42">{site.enabled ? "同期中" : "停止中"}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="surface space-y-3 p-2.5">
        <div className="space-y-0.5">
          <h2 className="text-[12px] font-semibold text-ink">バックアップ</h2>
          <p className="text-[10px] text-ink/56">フォロー状態や既読状態を JSON で保存・復元します。引っ越しややり直し用です。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="h-8 rounded-md bg-ink px-3 text-[11px] font-medium text-white"
            onClick={() => {
              window.open("/api/private/settings/export", "_blank", "noopener,noreferrer");
            }}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="h-8 rounded-md border border-ink/10 px-3 text-[11px] font-medium text-ink"
            onClick={async () => {
              await fetch("/api/private/settings/import", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: importText
              });
              setImportText("");
              router.refresh();
            }}
          >
            Import JSON
          </button>
        </div>
        <textarea
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
          rows={8}
          placeholder='{"prefs":[],"states":[]}'
          className="w-full rounded-md border border-ink/10 bg-white px-2.5 py-2 text-[12px] text-ink shadow-sm placeholder:text-ink/35"
        />
      </section>
    </div>
  );
}
