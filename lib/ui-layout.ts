import type { AppSettings } from "@/lib/settings";
import { metadataGridTailwindClassByDensity, tileGridTailwindClassByDensity, type TileDensity } from "@/lib/design-tokens";

function normalizeDensity(tileDensity: AppSettings["tileDensity"]): TileDensity {
  return tileDensity === "denser" || tileDensity === "roomy" ? tileDensity : "default";
}

export function getTileGridClass(tileDensity: AppSettings["tileDensity"]) {
  return tileGridTailwindClassByDensity[normalizeDensity(tileDensity)];
}

export function getMetadataTileGridClass(tileDensity: AppSettings["tileDensity"]) {
  return metadataGridTailwindClassByDensity[normalizeDensity(tileDensity)];
}

export function getTileAspectClass(tileAspect: AppSettings["tileAspect"]) {
  switch (tileAspect) {
    case "poster":
      return "aspect-[2/3]";
    case "square":
      return "aspect-square";
    default:
      return "aspect-[3/2]";
  }
}

export const compactTileOverlayInsetClass = "px-0 pb-0";

export const compactTileOverlayBandClass = "bg-[rgba(0,0,0,0.46)] px-1 py-1";

export const compactTileTitleClass =
  "line-clamp-2 text-[12px] font-semibold leading-[1.04] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)] sm:text-[12.5px]";
