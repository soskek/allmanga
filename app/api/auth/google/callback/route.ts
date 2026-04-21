import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth/session";
import { exchangeGoogleCode, upsertGoogleUser } from "@/lib/auth/google";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/auth/oauth-state";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${GOOGLE_OAUTH_STATE_COOKIE}=`))
    ?.slice(GOOGLE_OAUTH_STATE_COOKIE.length + 1);

  const loginUrl = new URL("/login", env.BASE_URL);
  const clearState = (response: NextResponse) => {
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return response;
  };

  if (!code || !state || !cookieState || state !== decodeURIComponent(cookieState)) {
    loginUrl.searchParams.set("error", "oauth_state");
    return clearState(NextResponse.redirect(loginUrl));
  }

  try {
    const userInfo = await exchangeGoogleCode(code);
    const user = await upsertGoogleUser(userInfo);
    await createSession(user.id);
    return clearState(NextResponse.redirect(new URL("/", env.BASE_URL)));
  } catch (error) {
    console.error(error);
    loginUrl.searchParams.set("error", "oauth_failed");
    return clearState(NextResponse.redirect(loginUrl));
  }
}
