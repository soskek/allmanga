import { NextResponse } from "next/server";
import { ensureWorkForRelease, toggleFollow } from "@/lib/actions";
import { requireApiSession } from "@/lib/api";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await params;
  const workId = await ensureWorkForRelease(id);
  await toggleFollow(workId, true);
  return NextResponse.json({ ok: true, workId });
}
