import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { normalizeThumbnailUrl } from "@/lib/utils";

const siteReferers: Record<string, string> = {
  jumpplus: "https://shonenjumpplus.com/",
  tonarinoyj: "https://tonarinoyj.jp/",
  comicdays: "https://comic-days.com/",
  sundaywebry: "https://www.sunday-webry.com/",
  magapoke: "https://pocket.shonenmagazine.com/",
  ynjn: "https://ynjn.jp/",
  mangaone: "https://manga-one.com/",
  yanmaga: "https://yanmaga.jp/",
  younganimal: "https://younganimal.com/",
  comicwalker: "https://comic-walker.com/"
};

export async function GET(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rawUrl = request.nextUrl.searchParams.get("url");
  const siteId = request.nextUrl.searchParams.get("siteId") ?? "";
  const url = normalizeThumbnailUrl(rawUrl);
  if (!url) {
    return NextResponse.json({ error: "missing url" }, { status: 400 });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        "user-agent": "AllMangaInboxBot/1.0 (+self-hosted private dashboard)",
        ...(siteReferers[siteId]
          ? {
              referer: siteReferers[siteId],
              origin: new URL(siteReferers[siteId]).origin
            }
          : {})
      },
      next: { revalidate: 60 * 60 }
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: `upstream ${upstream.status}` }, { status: upstream.status });
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "private, max-age=3600"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "thumbnail fetch failed"
      },
      { status: 502 }
    );
  }
}
