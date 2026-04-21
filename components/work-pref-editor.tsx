"use client";

import { useRouter } from "next/navigation";

export function WorkPrefEditor({
  workId,
  priority,
  showSideStory,
  showIllustration,
  showPromotion
}: {
  workId: string;
  priority: number;
  showSideStory: string;
  showIllustration: string;
  showPromotion: string;
}) {
  const router = useRouter();

  async function update(body: Record<string, unknown>) {
    await fetch(`/api/private/work/${workId}/prefs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    router.refresh();
  }

  return (
    <div className="grid gap-1 sm:grid-cols-2">
      <label className="space-y-1 text-[11px] text-ink/70">
        <span>優先度</span>
        <select defaultValue={priority} className="form-select h-8 px-2 pr-7 text-[11px]" onChange={(event) => update({ priority: Number(event.target.value) })}>
          <option value={0}>標準</option>
          <option value={1}>高め</option>
          <option value={2}>最優先</option>
        </select>
      </label>
      <label className="space-y-1 text-[11px] text-ink/70">
        <span>番外編</span>
        <select defaultValue={showSideStory} className="form-select h-8 px-2 pr-7 text-[11px]" onChange={(event) => update({ showSideStory: event.target.value })}>
          <option value="stack">未読に出す</option>
          <option value="collapsed">折りたたむ</option>
          <option value="hidden">隠す</option>
        </select>
      </label>
      <label className="space-y-1 text-[11px] text-ink/70">
        <span>イラスト</span>
        <select defaultValue={showIllustration} className="form-select h-8 px-2 pr-7 text-[11px]" onChange={(event) => update({ showIllustration: event.target.value })}>
          <option value="stack">未読に出す</option>
          <option value="collapsed">折りたたむ</option>
          <option value="hidden">隠す</option>
        </select>
      </label>
      <label className="space-y-1 text-[11px] text-ink/70">
        <span>PR / 告知</span>
        <select defaultValue={showPromotion} className="form-select h-8 px-2 pr-7 text-[11px]" onChange={(event) => update({ showPromotion: event.target.value })}>
          <option value="stack">未読に出す</option>
          <option value="collapsed">折りたたむ</option>
          <option value="hidden">隠す</option>
        </select>
      </label>
    </div>
  );
}
