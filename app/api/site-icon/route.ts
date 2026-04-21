import { NextRequest, NextResponse } from "next/server";
import { siteIconUrls } from "@/lib/domain";

export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get("siteId") ?? "";
  const iconUrl = siteIconUrls[siteId];
  if (!iconUrl) {
    return NextResponse.json({ error: "unknown site" }, { status: 404 });
  }

  try {
    const upstream = await fetch(iconUrl, {
      headers: {
        "user-agent": "AllMangaInboxBot/1.0 (+self-hosted dashboard)"
      },
      next: { revalidate: 60 * 60 * 24 }
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: `upstream ${upstream.status}` }, { status: upstream.status });
    }

    const contentType = upstream.headers.get("content-type") ?? "image/x-icon";
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=86400"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "icon fetch failed"
      },
      { status: 502 }
    );
  }
}
