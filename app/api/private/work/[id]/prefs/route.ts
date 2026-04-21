import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { updateWorkFlags } from "@/lib/actions";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) {
    return unauthorized;
  }
  const { id } = await params;
  const body = await request.json();
  await updateWorkFlags(id, body);
  return NextResponse.json({ ok: true });
}
