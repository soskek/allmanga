import { currentJstDateStartIso, normalizeRssPubDate } from "@/lib/sources/helpers";

describe("source date normalization", () => {
  it("keeps RSS UTC timestamps as real instants", () => {
    expect(normalizeRssPubDate("Sat, 18 Apr 2026 15:00:00 +0000")).toBe("2026-04-18T15:00:00.000Z");
  });

  it("normalizes explicit today-list fallbacks to JST calendar start", () => {
    expect(currentJstDateStartIso(new Date("2026-04-18T22:30:00+09:00"))).toBe("2026-04-18T00:00:00+09:00");
    expect(currentJstDateStartIso(new Date("2026-04-19T00:30:00+09:00"))).toBe("2026-04-19T00:00:00+09:00");
  });
});
