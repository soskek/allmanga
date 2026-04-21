import { canonicalizeUrl, isExcludedUrl } from "@/lib/utils";

describe("URL canonicalization", () => {
  it("removes tracking query and trailing slash", () => {
    expect(canonicalizeUrl("https://example.com/path/?utm_source=x&ref=y")).toBe("https://example.com/path");
  });

  it("excludes gravure and commerce paths", () => {
    expect(isExcludedUrl("https://ynjn.jp/gravure/123")).toBe(true);
    expect(isExcludedUrl("https://example.com/cart")).toBe(true);
  });
});
