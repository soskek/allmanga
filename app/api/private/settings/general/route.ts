import { NextResponse } from "next/server";
import { getApiSessionUserId, requireApiSession } from "@/lib/api";
import { updateSettings } from "@/lib/settings";

export async function POST(request: Request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) {
    return unauthorized;
  }
  const userId = await getApiSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  await updateSettings(userId, body);
  return NextResponse.json({ ok: true });
}
