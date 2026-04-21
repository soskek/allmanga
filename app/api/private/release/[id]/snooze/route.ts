import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { updateReleaseState } from "@/lib/actions";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) {
    return unauthorized;
  }
  const { id } = await params;
  await updateReleaseState(id, "snooze");
  return NextResponse.json({ ok: true });
}
