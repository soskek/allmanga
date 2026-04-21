import { prisma } from "../lib/db/prisma";
import { ensureSitesSeeded } from "../lib/sync";

type Expectation = {
  minWorks: number;
  minReleases: number;
  minReleaseCoverage?: number;
  requiredSourceTypes?: string[];
  minSourceTypeCounts?: Record<string, number>;
  severity: "fail" | "warn";
  note?: string;
};

const expectations: Record<string, Expectation> = {
  jumpplus: { minWorks: 80, minReleases: 20, minReleaseCoverage: 0.2, severity: "fail" },
  tonarinoyj: { minWorks: 100, minReleases: 20, minReleaseCoverage: 0.1, severity: "fail" },
  comicdays: { minWorks: 100, minReleases: 50, minReleaseCoverage: 0.2, severity: "fail" },
  sundaywebry: {
    minWorks: 200,
    minReleases: 200,
    minReleaseCoverage: 0.2,
    requiredSourceTypes: ["rss"],
    minSourceTypeCounts: { rss: 50 },
    severity: "fail"
  },
  magapoke: {
    minWorks: 200,
    minReleases: 50,
    minReleaseCoverage: 0.2,
    requiredSourceTypes: ["work_page"],
    minSourceTypeCounts: { work_page: 20 },
    severity: "fail"
  },
  ynjn: {
    minWorks: 100,
    minReleases: 100,
    minReleaseCoverage: 0.2,
    requiredSourceTypes: ["work_page"],
    minSourceTypeCounts: { work_page: 1000 },
    severity: "fail"
  },
  comicwalker: {
    minWorks: 100,
    minReleases: 300,
    minReleaseCoverage: 0.5,
    requiredSourceTypes: ["work_page"],
    minSourceTypeCounts: { work_page: 500 },
    severity: "fail"
  },
  younganimal: {
    minWorks: 100,
    minReleases: 100,
    minReleaseCoverage: 0.2,
    requiredSourceTypes: ["rss", "work_page"],
    minSourceTypeCounts: { rss: 100, work_page: 4 },
    severity: "fail"
  },
  yanmaga: {
    minWorks: 20,
    minReleases: 20,
    minReleaseCoverage: 0.2,
    requiredSourceTypes: ["work_page"],
    minSourceTypeCounts: { work_page: 10 },
    severity: "fail"
  },
  mangaone: {
    minWorks: 100,
    minReleases: 300,
    minReleaseCoverage: 1.2,
    requiredSourceTypes: ["work_page"],
    minSourceTypeCounts: { work_page: 1000 },
    severity: "fail"
  }
};

async function main() {
  await ensureSitesSeeded();

  const [sites, workCounts, releaseCounts, sourceTypeCounts, latestRuns] = await Promise.all([
    prisma.site.findMany({ orderBy: { id: "asc" } }),
    prisma.work.groupBy({ by: ["siteId"], _count: { _all: true } }),
    prisma.release.groupBy({ by: ["siteId"], _count: { _all: true } }),
    prisma.release.groupBy({ by: ["siteId", "sourceType"], _count: { _all: true } }),
    prisma.syncRun.findMany({
      orderBy: { startedAt: "desc" },
      distinct: ["siteId"]
    })
  ]);

  const workMap = new Map(workCounts.map((row) => [row.siteId, row._count._all]));
  const releaseMap = new Map(releaseCounts.map((row) => [row.siteId, row._count._all]));
  const sourceTypesBySite = new Map<string, Set<string>>();
  const sourceTypeCountBySite = new Map<string, Map<string, number>>();
  for (const row of sourceTypeCounts) {
    const bucket = sourceTypesBySite.get(row.siteId) ?? new Set<string>();
    bucket.add(row.sourceType);
    sourceTypesBySite.set(row.siteId, bucket);

    const countBucket = sourceTypeCountBySite.get(row.siteId) ?? new Map<string, number>();
    countBucket.set(row.sourceType, row._count._all);
    sourceTypeCountBySite.set(row.siteId, countBucket);
  }
  const runMap = new Map(latestRuns.map((row) => [row.siteId, row]));

  let hasFailures = false;

  for (const site of sites) {
    const expectation = expectations[site.id] ?? { minWorks: 1, minReleases: 1, severity: "warn" };
    const works = workMap.get(site.id) ?? 0;
    const releases = releaseMap.get(site.id) ?? 0;
    const releaseCoverage = works > 0 ? releases / works : 0;
    const run = runMap.get(site.id);
    const sourceTypes = sourceTypesBySite.get(site.id) ?? new Set<string>();
    const sourceTypeCountsForSite = sourceTypeCountBySite.get(site.id) ?? new Map<string, number>();
    const stats = run?.statsJson ? JSON.parse(run.statsJson) as Record<string, unknown> : {};
    const hasCoverageFailure = expectation.minReleaseCoverage !== undefined && releaseCoverage < expectation.minReleaseCoverage;
    const missingSourceTypes = (expectation.requiredSourceTypes ?? []).filter((sourceType) => !sourceTypes.has(sourceType));
    const sourceTypeCountFailures = Object.entries(expectation.minSourceTypeCounts ?? {}).filter(
      ([sourceType, minimum]) => (sourceTypeCountsForSite.get(sourceType) ?? 0) < minimum
    );
    const status =
      !run
        ? "missing_sync"
        : run.status !== "success"
          ? "sync_failed"
          : expectation.note
            ? "warn"
            : works < expectation.minWorks ||
                releases < expectation.minReleases ||
                hasCoverageFailure ||
                missingSourceTypes.length > 0 ||
                sourceTypeCountFailures.length > 0
            ? expectation.severity === "fail"
              ? "fail"
              : "warn"
            : "ok";

    if (status === "fail" || status === "sync_failed" || status === "missing_sync") {
      hasFailures = true;
    }

    console.log(
      JSON.stringify({
        siteId: site.id,
        enabled: site.enabled,
        status,
        works,
        releases,
        releaseCoverage: Number(releaseCoverage.toFixed(3)),
        minWorks: expectation.minWorks,
        minReleases: expectation.minReleases,
        minReleaseCoverage: expectation.minReleaseCoverage ?? null,
        sourceTypes: [...sourceTypes].sort(),
        sourceTypeCounts: Object.fromEntries([...sourceTypeCountsForSite.entries()].sort(([left], [right]) => left.localeCompare(right))),
        missingSourceTypes: missingSourceTypes.length > 0 ? missingSourceTypes : null,
        sourceTypeCountFailures:
          sourceTypeCountFailures.length > 0
            ? sourceTypeCountFailures.map(([sourceType, minimum]) => ({
                sourceType,
                minimum,
                actual: sourceTypeCountsForSite.get(sourceType) ?? 0
              }))
            : null,
        lastRunStatus: run?.status ?? null,
        insufficientData: stats.insufficientData ?? null,
        note: expectation.note ?? null
      })
    );
  }

  await prisma.$disconnect();

  if (hasFailures) {
    process.exit(1);
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
