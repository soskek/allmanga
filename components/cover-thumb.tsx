import { siteIconUrls } from "@/lib/domain";
import { cn, normalizeThumbnailUrl } from "@/lib/utils";

export function CoverThumb({
  src,
  secondarySrc,
  alt,
  siteId,
  showSiteFallback = true,
  className
}: {
  src?: string | null;
  secondarySrc?: string | null;
  alt: string;
  siteId: string;
  showSiteFallback?: boolean;
  className?: string;
}) {
  const resolvedSrc = src ? `/api/private/thumb?siteId=${encodeURIComponent(siteId)}&url=${encodeURIComponent(normalizeThumbnailUrl(src) ?? src)}` : null;
  const resolvedSecondarySrc = secondarySrc
    ? `/api/private/thumb?siteId=${encodeURIComponent(siteId)}&url=${encodeURIComponent(normalizeThumbnailUrl(secondarySrc) ?? secondarySrc)}`
    : null;
  const fallbackIconSrc = `/api/site-icon?siteId=${encodeURIComponent(siteId)}&v=${encodeURIComponent(siteIconUrls[siteId] ?? siteId)}`;

  return (
    <div className={cn("overflow-hidden bg-sand/70", className)}>
      {resolvedSrc ? (
        <div className="relative h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolvedSrc} alt={alt} loading="lazy" className="h-full w-full object-cover" />
          {resolvedSecondarySrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedSecondarySrc}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                clipPath: "polygon(40% 0%, 100% 0%, 100% 100%, 90% 100%)",
                maskImage: "linear-gradient(90deg, transparent 0%, transparent 40%, rgba(0,0,0,0.25) 58%, rgba(0,0,0,0.78) 74%, rgba(0,0,0,1) 90%)",
                WebkitMaskImage:
                  "linear-gradient(90deg, transparent 0%, transparent 40%, rgba(0,0,0,0.25) 58%, rgba(0,0,0,0.78) 74%, rgba(0,0,0,1) 90%)"
              }}
            />
          ) : null}
        </div>
      ) : (
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-white via-sand/80 to-clay/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.7),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.18),rgba(0,0,0,0.08))]" />
          {showSiteFallback ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fallbackIconSrc}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="relative h-14 w-14 object-contain opacity-90 drop-shadow-sm"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
