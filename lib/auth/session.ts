import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { BOOTSTRAP_OWNER_USER_ID } from "@/lib/domain";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";

const COOKIE_NAME = "allmanga_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export type SessionUser = {
  userId: string;
  role?: string;
};

function sign(value: string) {
  return createHmac("sha256", env.SESSION_SECRET).update(value).digest("hex");
}

function hashSessionToken(token: string) {
  return createHmac("sha256", env.SESSION_SECRET).update(`session:${token}`).digest("hex");
}

function encodeSession(payload: string) {
  return `${payload}.${sign(payload)}`;
}

function decodeSignedValue(cookieValue?: string) {
  if (!cookieValue) {
    return null;
  }
  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) {
    return null;
  }
  const expected = sign(payload);
  const matches =
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!matches) {
    return null;
  }
  return payload;
}

function decodeSession(cookieValue?: string) {
  const payload = decodeSignedValue(cookieValue);
  if (!payload) {
    return null;
  }
  if (payload === BOOTSTRAP_OWNER_USER_ID) {
    return { userId: BOOTSTRAP_OWNER_USER_ID };
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser;
    if (decoded?.userId) {
      return decoded;
    }
  } catch {
    return null;
  }
  return null;
}

export async function verifyPassword(password: string) {
  if (env.APP_DEV_PASSWORD && password === env.APP_DEV_PASSWORD) {
    return true;
  }
  if (!env.APP_PASSWORD_HASH) {
    return process.env.NODE_ENV !== "production" && password === "dev-password";
  }
  return compare(password, env.APP_PASSWORD_HASH);
}

export async function createSession(userId: string) {
  const store = await cookies();
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS)
    }
  });
  store.set(COOKIE_NAME, encodeSession(token), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.BASE_URL.startsWith("https://"),
    path: "/",
    maxAge: SESSION_TTL_MS / 1000
  });
}

export async function clearSession() {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  const sessionToken = decodeSignedValue(raw);
  if (sessionToken) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashSessionToken(sessionToken) }
    });
  }
  store.delete(COOKIE_NAME);
}

export async function getSessionUser() {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  const sessionToken = decodeSignedValue(raw);
  if (sessionToken) {
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(sessionToken) },
      select: { userId: true, expiresAt: true }
    });
    if (session) {
      if (session.expiresAt <= new Date()) {
        await clearSession();
        return null;
      }
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { role: true }
      });
      return { userId: session.userId, role: user?.role };
    }
  }
  return decodeSession(raw);
}

export async function getSessionUserId() {
  const session = await getSessionUser();
  return session?.userId ?? null;
}

export async function ensureBootstrapOwnerUser() {
  return prisma.user.upsert({
    where: { id: BOOTSTRAP_OWNER_USER_ID },
    update: {
      email: env.APP_OWNER_EMAIL,
      displayName: env.APP_OWNER_NAME,
      role: "owner"
    },
    create: {
      id: BOOTSTRAP_OWNER_USER_ID,
      email: env.APP_OWNER_EMAIL,
      displayName: env.APP_OWNER_NAME,
      role: "owner"
    }
  });
}

export async function requireSession() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true }
  });
  if (!user) {
    await clearSession();
    redirect("/login");
  }
  return { ...session, role: user.role };
}

export async function requireSessionUserId() {
  const session = await requireSession();
  return session.userId;
}
