import type { CSSProperties, ReactNode } from "react";
import { siteAccentColors, siteLabels, siteMarks } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function MetadataTile({
  title,
  href,
  siteId,
  badges,
  actions,
  className,
  deemphasized = false
}: {
  title: string;
  href: string;
  siteId: string;
  badges?: ReactNode;
  actions?: ReactNode;
  className?: string;
  deemphasized?: boolean;
}) {
  const accentColor = siteAccentColors[siteId] ?? "#475569";
  const tileStyle = {
    "--site-accent": accentColor,
    background: deemphasized
      ? undefined
      : `linear-gradient(135deg, #ffffff 0%, #ffffff 68%, ${hexToRgba(accentColor, 0.12)} 100%)`
  } as CSSProperties;

  return (
    <article
      style={tileStyle}
      className={cn(
        "group relative min-h-[42px] overflow-hidden rounded-br-[9px] rounded-tl-[13px] rounded-tr-[5px] rounded-bl-[5px] border bg-white shadow-sm transition-[border-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:border-[var(--site-accent)] hover:shadow-[0_0_0_1px_var(--site-accent),0_5px_14px_rgba(15,23,42,0.10)]",
        deemphasized ? "border-slate-300 bg-slate-50 text-ink/55" : "border-ink/10",
        className
      )}
    >
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={`${title} を公式で開く`}
        className="absolute inset-0 z-30"
      />
      {deemphasized ? (
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-45deg,rgba(148,163,184,0.26)_0,rgba(148,163,184,0.26)_6px,rgba(255,255,255,0.18)_6px,rgba(255,255,255,0.18)_12px)]" />
      ) : null}
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        style={{ background: `linear-gradient(135deg, ${hexToRgba(accentColor, 0.08)} 0%, transparent 42%, ${hexToRgba(accentColor, 0.07)} 100%)` }}
      />
      <div className="absolute inset-x-0 top-0 z-20 h-[2px]" style={{ backgroundColor: accentColor }} />
      <div className="absolute inset-y-0 left-0 z-20 w-[3px]" style={{ backgroundColor: accentColor }} />
      <div className="absolute inset-x-0 bottom-0 z-20 flex min-h-[42px] items-center px-1.5 py-1">
        <div className="min-w-0 flex-1 pr-0">
          <h3 className="line-clamp-2 text-[12px] font-semibold leading-[1.05] text-ink/86 sm:text-[12.5px]">
            <span
              className="mr-0.5 inline text-[7px] font-black leading-none tracking-[-0.04em]"
              style={{ color: accentColor }}
              title={siteLabels[siteId] ?? siteId}
              aria-label={siteLabels[siteId] ?? siteId}
            >
              {siteMarks[siteId] ?? siteId.slice(0, 2).toUpperCase()}
            </span>
            {title}
          </h3>
        </div>
      </div>
      {badges ? (
        <div
          className={cn(
            "pointer-events-none absolute bottom-0.5 z-40 flex max-w-[55%] flex-wrap gap-0.5",
            actions ? "left-0.5 justify-start" : "right-0.5 justify-end"
          )}
        >
          {badges}
        </div>
      ) : null}
      {actions ? <div className="absolute bottom-0.5 right-0.5 z-50 flex gap-0.5 opacity-42">{actions}</div> : null}
    </article>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const bigint = Number.parseInt(value, 16);
  const red = (bigint >> 16) & 255;
  const green = (bigint >> 8) & 255;
  const blue = bigint & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function MetadataBadge({
  children,
  variant = "neutral"
}: {
  children: ReactNode;
  variant?: "neutral" | "paid" | "semantic" | "date";
}) {
  return (
    <span
      className={cn(
        "rounded-[3px] px-1 py-0.5 text-[7px] font-semibold leading-none",
        variant === "paid" && "bg-slate-800/8 text-slate-700",
        variant === "semantic" && "bg-ink/8 text-ink/62",
        variant === "date" && "bg-ink/6 text-ink/52",
        variant === "neutral" && "bg-ink/6 text-ink/52"
      )}
    >
      {children}
    </span>
  );
}
