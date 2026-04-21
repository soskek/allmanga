import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { importUserData } from "@/lib/actions";

export async function POST(request: Request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) {
    return unauthorized;
  }
  const body = await request.json();
  await importUserData(body);
  return NextResponse.json({ ok: true });
}
