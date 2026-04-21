import { SiteIcon } from "@/components/site-icon";
import { siteLabels, siteShortLabels } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function SitePill({
  siteId,
  compact = false,
  imageIcon = true,
  className
}: {
  siteId: string;
  compact?: boolean;
  imageIcon?: boolean;
  className?: string;
}) {
  return (
    compact && !imageIcon ? (
      <span
        className={cn("inline text-[7px] font-black leading-none tracking-[-0.04em]", className)}
        title={siteLabels[siteId] ?? siteId}
        aria-label={siteLabels[siteId] ?? siteId}
      >
        <SiteIcon siteId={siteId} image={false} className="inline h-auto w-auto overflow-visible rounded-none text-[7px] text-current" />
      </span>
    ) : (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[10px] font-medium text-ink/75",
        compact ? "h-4.5 w-4.5 justify-center p-0" : "",
        className
      )}
      title={siteLabels[siteId] ?? siteId}
      aria-label={siteLabels[siteId] ?? siteId}
    >
      <SiteIcon siteId={siteId} image={imageIcon} className="h-4 w-4" />
      {compact ? null : siteShortLabels[siteId] ?? siteId}
    </span>
    )
  );
}
