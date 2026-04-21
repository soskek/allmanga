import { NextResponse } from "next/server";
import { createSession, ensureBootstrapOwnerUser, verifyPassword } from "@/lib/auth/session";
import { env } from "@/lib/env";

async function readPassword(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    return String(body.password ?? "");
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    return new URLSearchParams(text).get("password") ?? "";
  }

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    return String(formData?.get("password") ?? "");
  }

  const fallbackText = await request.text().catch(() => "");
  return new URLSearchParams(fallbackText).get("password") ?? fallbackText;
}

export async function POST(request: Request) {
  if (!env.PASSWORD_LOGIN_ENABLED) {
    return NextResponse.redirect(new URL("/login", env.BASE_URL));
  }
  const password = await readPassword(request);
  const valid = await verifyPassword(password);
  if (!valid) {
    return NextResponse.redirect(new URL("/login", env.BASE_URL));
  }
  const owner = await ensureBootstrapOwnerUser();
  await createSession(owner.id);
  return NextResponse.redirect(new URL("/", env.BASE_URL));
}
