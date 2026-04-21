import { semanticLabels } from "@/lib/domain";
import { formatDateTime, safeJsonParse } from "@/lib/utils";

export function PublicReleaseRow({
  item,
  timezone
}: {
  item: {
    workTitle: string | null;
    authors: string;
    siteName: string;
    semanticKind: string;
    title: string | null;
    publishedAt: Date | null;
    officialUrl: string;
  };
  timezone: string;
}) {
  return (
    <article className="surface-muted grid gap-1.5 p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-md border border-ink/10 bg-white px-1.5 py-0.5 text-[10px] font-medium text-ink/75">{item.siteName}</span>
        <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-ink/70">
          {semanticLabels[item.semanticKind as keyof typeof semanticLabels] ?? item.semanticKind}
        </span>
        <span className="ml-auto text-[10px] text-ink/45">
          {item.publishedAt ? formatDateTime(item.publishedAt, timezone) : "日時不明"}
        </span>
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-[12px] font-semibold text-ink">{item.workTitle ?? item.title ?? "タイトル不明"}</h3>
        <p className="truncate text-[10px] text-ink/55">{safeJsonParse<string[]>(item.authors, []).join(" / ")}</p>
      </div>
      <a href={item.officialUrl} target="_blank" rel="noreferrer" className="inline-flex h-7 rounded-md bg-white px-2 text-[11px] font-medium text-ink">
        公式サイトへ
      </a>
    </article>
  );
}
