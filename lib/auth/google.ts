import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export function isGoogleAuthConfigured() {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function buildGoogleAuthUrl(state: string) {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "select_account");
  return url;
}

export async function exchangeGoogleCode(code: string) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth is not configured");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: googleRedirectUri()
    })
  });
  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${response.status}`);
  }
  const token = (await response.json()) as { access_token?: string };
  if (!token.access_token) {
    throw new Error("Google token response did not include access_token");
  }

  const userResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${token.access_token}` }
  });
  if (!userResponse.ok) {
    throw new Error(`Google userinfo failed: ${userResponse.status}`);
  }
  return userResponse.json() as Promise<GoogleUserInfo>;
}

export function assertGoogleUserAllowed(userInfo: GoogleUserInfo) {
  const email = userInfo.email?.trim().toLowerCase();
  if (!userInfo.sub || !email || !userInfo.email_verified) {
    throw new Error("Google account email is not verified");
  }

  const allowedEmails = parseCsv(env.GOOGLE_AUTH_ALLOWED_EMAILS).map((item) => item.toLowerCase());
  const allowedDomains = parseCsv(env.GOOGLE_AUTH_ALLOWED_DOMAINS).map((item) => item.toLowerCase().replace(/^@/, ""));
  const domain = email.split("@")[1] ?? "";

  const emailAllowed =
    allowedEmails.includes("*") ||
    allowedEmails.includes(email) ||
    allowedDomains.includes("*") ||
    allowedDomains.includes(domain);

  if (emailAllowed || email === env.APP_OWNER_EMAIL.toLowerCase()) {
    return { sub: userInfo.sub, email };
  }

  throw new Error("Google account is not allowed");
}

export async function upsertGoogleUser(userInfo: GoogleUserInfo) {
  const { sub, email } = assertGoogleUserAllowed(userInfo);
  const displayName = userInfo.name?.trim() || null;
  const avatarUrl = userInfo.picture?.trim() || null;
  const role = email === env.APP_OWNER_EMAIL.toLowerCase() ? "owner" : "member";

  const existingIdentity = await prisma.authIdentity.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "google",
        providerAccountId: sub
      }
    },
    include: { user: true }
  });

  if (existingIdentity) {
    await prisma.authIdentity.update({
      where: { id: existingIdentity.id },
      data: { email, displayName, avatarUrl }
    });
    await prisma.user.update({
      where: { id: existingIdentity.userId },
      data: {
        email,
        displayName,
        role: existingIdentity.user.role === "owner" ? "owner" : role
      }
    });
    return { id: existingIdentity.userId };
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      displayName,
      role
    },
    create: {
      email,
      displayName,
      role
    }
  });

  await prisma.authIdentity.create({
    data: {
      userId: user.id,
      provider: "google",
      providerAccountId: sub,
      email,
      displayName,
      avatarUrl
    }
  });

  return user;
}

function googleRedirectUri() {
  return new URL("/api/auth/google/callback", env.BASE_URL).toString();
}

function parseCsv(value?: string) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
