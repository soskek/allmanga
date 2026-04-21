import { afterEach, describe, expect, it, vi } from "vitest";

describe("google auth allowlist", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("allows the owner email even without an explicit allowlist", async () => {
    vi.stubEnv("APP_OWNER_EMAIL", "owner@example.com");
    const { assertGoogleUserAllowed } = await import("@/lib/auth/google");

    expect(
      assertGoogleUserAllowed({
        sub: "google-sub",
        email: "owner@example.com",
        email_verified: true
      })
    ).toEqual({ sub: "google-sub", email: "owner@example.com" });
  });

  it("rejects non-owner emails when no allowlist is configured", async () => {
    vi.stubEnv("APP_OWNER_EMAIL", "owner@example.com");
    const { assertGoogleUserAllowed } = await import("@/lib/auth/google");

    expect(() =>
      assertGoogleUserAllowed({
        sub: "google-sub",
        email: "guest@example.com",
        email_verified: true
      })
    ).toThrow("not allowed");
  });

  it("allows configured domains", async () => {
    vi.stubEnv("APP_OWNER_EMAIL", "owner@example.com");
    vi.stubEnv("GOOGLE_AUTH_ALLOWED_DOMAINS", "example.org,@example.net");
    const { assertGoogleUserAllowed } = await import("@/lib/auth/google");

    expect(
      assertGoogleUserAllowed({
        sub: "google-sub",
        email: "reader@example.net",
        email_verified: true
      })
    ).toEqual({ sub: "google-sub", email: "reader@example.net" });
  });
});
