import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { recordReleaseOpened } from "@/lib/actions";

export async function GET(request: Request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const releaseId = searchParams.get("releaseId");

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  if (releaseId) {
    await recordReleaseOpened(releaseId);
  }

  return NextResponse.redirect(url);
}
