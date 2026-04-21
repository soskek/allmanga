import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { defaultSites } from "@/lib/sources/registry";
import { runAllEnabledSyncs, runSiteSync } from "@/lib/sync";

function isAuthorized(request: Request) {
  if (!env.INTERNAL_SYNC_TOKEN) {
    return false;
  }
  const authorization = request.headers.get("authorization") ?? "";
  return authorization === `Bearer ${env.INTERNAL_SYNC_TOKEN}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  if (siteId) {
    if (!defaultSites.some((site) => site.id === siteId)) {
      return NextResponse.json({ error: "Unknown siteId" }, { status: 400 });
    }
    const result = await runSiteSync(siteId);
    return NextResponse.json({ ok: true, mode: "site", siteId, result });
  }

  const result = await runAllEnabledSyncs();
  return NextResponse.json({
    ok: true,
    mode: "all",
    results: result.map((item) => (item.status === "fulfilled" ? { status: "fulfilled" } : { status: "rejected" }))
  });
}
