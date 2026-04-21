"use client";

import { useState } from "react";
import { siteIconUrls, siteMarks, siteTextColorClasses } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function SiteIcon({
  siteId,
  className,
  image = true
}: {
  siteId: string;
  className?: string;
  image?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const cacheKey = siteIconUrls[siteId] ?? siteId;
  const src = `/api/site-icon?siteId=${encodeURIComponent(siteId)}&v=${encodeURIComponent(cacheKey)}`;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-4.5 w-4.5 items-center justify-center overflow-hidden rounded-[5px] bg-transparent text-[9px] font-black tracking-[-0.04em]",
        siteTextColorClasses[siteId] ?? "text-ink/65",
        className
      )}
    >
      {src && !broken && image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          className="h-full w-full object-contain"
          onError={() => setBroken(true)}
        />
      ) : (
        siteMarks[siteId] ?? siteId.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}
