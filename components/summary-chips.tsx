const items = [
  { key: "unreadMain", label: "未読本編", accent: true },
  { key: "today", label: "今日の新着", accent: false },
  { key: "announcement", label: "新連載", accent: false },
  { key: "oneshot", label: "読切", accent: false },
  { key: "sideStory", label: "番外編", accent: false },
  { key: "illustration", label: "イラスト", accent: false },
  { key: "promotion", label: "PR/告知", accent: false }
] as const satisfies ReadonlyArray<{
  key: "unreadMain" | "today" | "announcement" | "oneshot" | "sideStory" | "illustration" | "promotion";
  label: string;
  accent?: boolean;
}>;

export function SummaryChips({
  summary
}: {
  summary: Record<(typeof items)[number]["key"], number>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <div
          key={item.key}
          className={`rounded-md border px-2 py-1 ${item.accent ? "border-ember/20 bg-ember/6" : "border-ink/10 bg-white/72"}`}
        >
          <p className="text-[9px] font-medium tracking-tight text-ink/50">{item.label}</p>
          <p className="text-[13px] font-semibold leading-tight text-ink">{summary[item.key]}</p>
        </div>
      ))}
    </div>
  );
}
