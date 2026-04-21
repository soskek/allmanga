import { prisma } from "../lib/db/prisma";
import { getSharedHomeSnapshot, rebuildSharedHomeSnapshot } from "../lib/home-snapshot";
import { siteDisplayOrder } from "../lib/domain";
import { calendarDayStartDate } from "../lib/state";

const shouldRebuild = process.argv.includes("--rebuild");

async function main() {
  const today = calendarDayStartDate(new Date(), "Asia/Tokyo");
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  if (shouldRebuild) {
    await rebuildSharedHomeSnapshot();
  }

  const [rawRows, snapshot] = await Promise.all([
    prisma.release.findMany({
      where: {
        contentKind: "episode",
        sourceType: { in: ["rss", "work_page"] },
        publishedAt: { gte: today, lt: tomorrow }
      },
      select: {
        id: true,
        siteId: true,
        title: true,
        semanticKind: true,
        sourceType: true,
        publishedAt: true,
        work: {
          select: {
            title: true
          }
        }
      },
      orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }]
    }),
    getSharedHomeSnapshot()
  ]);

  console.log(
    JSON.stringify(
      {
        window: {
          start: today.toISOString(),
          end: tomorrow.toISOString()
        },
        rawTodayBySite: countBySite(rawRows),
        rawTodayTotal: rawRows.length,
        snapshotTodayBySite: countBySite(snapshot.todayFeed),
        snapshotTodayTotal: snapshot.todayFeed.length,
        snapshotBuiltAt: snapshot.builtAt.toISOString(),
        snapshotLastSyncedAt: snapshot.lastSyncedAt?.toISOString() ?? null,
        rawSamples: sampleBySite(rawRows),
        snapshotSamples: sampleBySite(snapshot.todayFeed)
      },
      null,
      2
    )
  );
}

function countBySite(rows: Array<{ siteId: string }>) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.siteId, (counts.get(row.siteId) ?? 0) + 1);
  }
  return Object.fromEntries(siteDisplayOrder.map((siteId) => [siteId, counts.get(siteId) ?? 0]));
}

function sampleBySite(rows: Array<{ siteId: string; title: string | null; work?: { title: string | null } | null }>) {
  return Object.fromEntries(
    siteDisplayOrder.map((siteId) => [
      siteId,
      rows
        .filter((row) => row.siteId === siteId)
        .slice(0, 3)
        .map((row) => row.work?.title ?? row.title)
    ])
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
