import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { updateReleaseOverrideKind } from "@/lib/actions";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) {
    return unauthorized;
  }
  const { id } = await params;
  const body = await request.json();
  await updateReleaseOverrideKind(id, body.overrideKind ?? null);
  return NextResponse.json({ ok: true });
}
