import { describe, expect, it } from "vitest";

import { metadataGridTailwindClassByDensity, tileGridTailwindClassByDensity } from "@/lib/design-tokens";
import { getMetadataTileGridClass, getTileGridClass } from "@/lib/ui-layout";

describe("ui layout density", () => {
  it("keeps private tile grids backed by shared design tokens", () => {
    expect(getTileGridClass("compact")).toBe(tileGridTailwindClassByDensity.default);
    expect(getTileGridClass("roomy")).toBe(tileGridTailwindClassByDensity.roomy);
    expect(getTileGridClass("denser")).toBe(tileGridTailwindClassByDensity.denser);
  });

  it("keeps metadata-only grids aligned with the public static card grid", () => {
    expect(getMetadataTileGridClass("compact")).toBe(metadataGridTailwindClassByDensity.default);
    expect(getMetadataTileGridClass("roomy")).toBe(metadataGridTailwindClassByDensity.roomy);
    expect(getMetadataTileGridClass("denser")).toBe(metadataGridTailwindClassByDensity.denser);
  });
});
