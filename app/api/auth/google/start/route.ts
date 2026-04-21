import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { buildGoogleAuthUrl, isGoogleAuthConfigured } from "@/lib/auth/google";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/auth/oauth-state";
import { env } from "@/lib/env";

export async function GET() {
  if (!isGoogleAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google_not_configured", env.BASE_URL));
  }

  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(buildGoogleAuthUrl(state));
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.BASE_URL.startsWith("https://"),
    path: "/",
    maxAge: 60 * 10
  });
  return response;
}
