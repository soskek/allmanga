export type TileDensity = "roomy" | "default" | "denser";

export const designColors = {
  ink: "#101316",
  sand: "#f4efe8",
  pageBg: "#faf7f2",
  pageBgEnd: "#eef3f4",
  clay: "#d3b28d",
  moss: "#5f6d53",
  ember: "#b94d2f",
  sky: "#d9e8ee"
} as const;

export const fontFamilySans = ["'Noto Sans JP'", "system-ui", "sans-serif"] as const;
export const fontFamilySansCss = fontFamilySans.join(", ");

export const pageMaxWidthPx = 1800;

export const appBackgroundCss = [
  `radial-gradient(circle at top left, rgba(211, 178, 141, 0.35), transparent 30%)`,
  `linear-gradient(180deg, ${designColors.pageBg} 0%, ${designColors.sand} 40%, ${designColors.pageBgEnd} 100%)`
].join(",\n    ");

export const breakpointMinWidths = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536
} as const;

export const extendedGridTemplateColumns = {
  "13": "repeat(13, minmax(0, 1fr))",
  "14": "repeat(14, minmax(0, 1fr))",
  "15": "repeat(15, minmax(0, 1fr))"
} as const;

export const tileGridTailwindClassByDensity: Record<TileDensity, string> = {
  denser: "grid grid-cols-5 gap-0.5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-11 xl:grid-cols-13 2xl:grid-cols-15",
  default: "grid grid-cols-4 gap-0.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-14",
  roomy: "grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12"
};

export const metadataGridTailwindClassByDensity: Record<TileDensity, string> = {
  denser: "grid grid-cols-3 gap-0.5 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-11 2xl:grid-cols-13",
  default: "grid grid-cols-3 gap-0.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12",
  roomy: "grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-11"
};

export const metadataGridColumnsByDensity = {
  denser: { base: 3, sm: 5, md: 7, lg: 9, xl: 11, "2xl": 13 },
  default: { base: 3, sm: 4, md: 6, lg: 8, xl: 10, "2xl": 12 },
  roomy: { base: 2, sm: 3, md: 5, lg: 7, xl: 9, "2xl": 11 }
} as const satisfies Record<TileDensity, Record<"base" | keyof typeof breakpointMinWidths, number>>;

export function buildCssGridBreakpoints(selector: string, density: TileDensity = "default") {
  const columns = metadataGridColumnsByDensity[density];
  const breakpointCss = (Object.keys(breakpointMinWidths) as Array<keyof typeof breakpointMinWidths>)
    .map((breakpoint) => {
      return `@media (min-width: ${breakpointMinWidths[breakpoint]}px) {\n  ${selector} { grid-template-columns: repeat(${columns[breakpoint]}, minmax(0, 1fr)); }\n}`;
    })
    .join("\n");

  return `${selector} { grid-template-columns: repeat(${columns.base}, minmax(0, 1fr)); }\n${breakpointCss}`;
}
