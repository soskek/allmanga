import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api";
import { triggerSyncJobs, canTriggerCloudRunJobs } from "@/lib/cloud-run/jobs";
import { prisma } from "@/lib/db/prisma";
import { runAllEnabledSyncs } from "@/lib/sync";

export async function POST(request: Request) {
  const unauthorized = await requireApiRole(["owner", "admin"]);
  if (unauthorized) {
    return unauthorized;
  }

  if (canTriggerCloudRunJobs()) {
    const enabledSites = await prisma.site.findMany({
      where: { enabled: true },
      select: { id: true }
    });
    const results = await triggerSyncJobs(enabledSites.map((site) => site.id));
    const failed = results.filter((result) => !result.ok);
    if (failed.length > 0) {
      return NextResponse.json({ ok: false, mode: "cloud-run-jobs", failed }, { status: 502 });
    }

    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("text/html")) {
      return NextResponse.redirect(new URL("/", request.url), { status: 303 });
    }
    return NextResponse.json({ ok: true, mode: "cloud-run-jobs", triggered: results.length }, { status: 202 });
  }

  await runAllEnabledSyncs();
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/", request.url), { status: 303 });
  }
  return NextResponse.json({ ok: true });
}
