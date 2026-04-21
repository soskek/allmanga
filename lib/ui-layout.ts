import type { AppSettings } from "@/lib/settings";

export function getTileGridClass(tileDensity: AppSettings["tileDensity"]) {
  switch (tileDensity) {
    case "denser":
      return "grid grid-cols-5 gap-0.5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-11 xl:grid-cols-13 2xl:grid-cols-15";
    case "roomy":
      return "grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12";
    default:
      return "grid grid-cols-4 gap-0.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-14";
  }
}

export function getMetadataTileGridClass(tileDensity: AppSettings["tileDensity"]) {
  switch (tileDensity) {
    case "denser":
      return "grid grid-cols-3 gap-0.5 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-11 2xl:grid-cols-13";
    case "roomy":
      return "grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-11";
    default:
      return "grid grid-cols-3 gap-0.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12";
  }
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
