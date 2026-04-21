import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiRole } from "@/lib/api";

export async function POST(request: Request) {
  const unauthorized = await requireApiRole(["owner", "admin"]);
  if (unauthorized) {
    return unauthorized;
  }
  const body = await request.json();
  await prisma.site.update({
    where: { id: String(body.siteId) },
    data: { enabled: Boolean(body.enabled) }
  });
  return NextResponse.json({ ok: true });
}
