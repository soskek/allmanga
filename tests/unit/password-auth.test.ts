import { afterEach, describe, expect, it, vi } from "vitest";

describe("password auth fallback", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("allows the implicit dev password only outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_PASSWORD_HASH", "");
    vi.stubEnv("APP_DEV_PASSWORD", "");
    const { verifyPassword } = await import("@/lib/auth/session");

    await expect(verifyPassword("dev-password")).resolves.toBe(true);
  });

  it("rejects the implicit dev password in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_PASSWORD_HASH", "");
    vi.stubEnv("APP_DEV_PASSWORD", "");
    const { verifyPassword } = await import("@/lib/auth/session");

    await expect(verifyPassword("dev-password")).resolves.toBe(false);
  });
});
