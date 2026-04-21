export function QuickAddPanel({
  compact = false
}: {
  compact?: boolean;
}) {
  return (
    <section className={compact ? "surface space-y-2 p-2" : "surface space-y-2.5 p-2.5"}>
      <div className="space-y-0.5">
        <h2 className="text-[12px] font-semibold text-ink">作品を追加</h2>
        <p className="text-[10px] text-ink/56">作品 URL を貼るか、作品名・作者名で探してフォローします。</p>
      </div>

      <form className="flex gap-1.5" action="/search" method="get">
        <input
          name="q"
          placeholder="作品URLを貼る"
          className="form-input min-w-0 flex-1"
        />
        <button className="h-8 rounded-md bg-ink px-3 text-[11px] font-medium text-white">開く</button>
      </form>

      <form className="flex gap-1.5" action="/search" method="get">
        <input
          name="q"
          placeholder="作品名・作者名で検索"
          className="form-input min-w-0 flex-1"
        />
        <button className="h-8 rounded-md border border-ink/10 bg-white px-3 text-[11px] font-medium text-ink">検索</button>
      </form>

      <div className="flex flex-wrap gap-1.5 text-[10px] text-ink/58">
        <a href="/discover" className="rounded-md border border-ink/10 bg-white px-2 py-1 font-medium text-ink/72">
          新作・読切を見る
        </a>
        <a href="/settings" className="rounded-md border border-ink/10 bg-white px-2 py-1 font-medium text-ink/72">
          追い方を調整
        </a>
      </div>
    </section>
  );
}
