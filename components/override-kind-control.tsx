"use client";

import { useRouter } from "next/navigation";
import { semanticLabels } from "@/lib/domain";

const options = [
  "main_episode",
  "side_story",
  "illustration",
  "hiatus_illustration",
  "promotion",
  "announcement",
  "oneshot_discovery",
  "unknown"
] as const;

export function OverrideKindControl({
  releaseId,
  value
}: {
  releaseId: string;
  value: string;
}) {
  const router = useRouter();

  return (
    <label className="inline-flex items-center gap-1 text-[11px] text-ink/65">
      <span className="sr-only">分類上書き</span>
      <select
        defaultValue={value}
        aria-label="分類上書き"
        className="form-select h-8 min-w-[8.5rem] px-2 pr-7 text-[11px]"
        onChange={async (event) => {
          await fetch(`/api/private/release/${releaseId}/override-kind`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ overrideKind: event.target.value })
          });
          router.refresh();
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {semanticLabels[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
