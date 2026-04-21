import { sourceAdapters } from "@/lib/sources/registry";
import { calendarDayStartDate } from "@/lib/state";

const siteIds = process.argv.slice(2);
const targetAdapters = siteIds.length > 0
  ? sourceAdapters.filter((adapter) => siteIds.includes(adapter.siteId))
  : sourceAdapters;

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    })
  ]);
}

async function main() {
  const today = calendarDayStartDate(new Date(), "Asia/Tokyo");
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  for (const adapter of targetAdapters) {
    const startedAt = Date.now();
    try {
      const result = await withTimeout(adapter.sync(), 120_000);
      const feedCandidates = result.releases.filter(
        (release) => release.contentKind === "episode" && ["rss", "work_page"].includes(release.sourceType)
      );
      const withPublishedAt = feedCandidates.filter((release) => release.publishedAt);
      const todayRows = withPublishedAt.filter((release) => {
        const date = new Date(release.publishedAt!);
        return date >= today && date < tomorrow;
      });
      const futureRows = withPublishedAt.filter((release) => new Date(release.publishedAt!).getTime() >= tomorrow.getTime());

      console.log(
        JSON.stringify({
          siteId: adapter.siteId,
          works: result.works.length,
          releases: result.releases.length,
          feedCandidates: feedCandidates.length,
          withPublishedAt: withPublishedAt.length,
          withoutPublishedAt: feedCandidates.length - withPublishedAt.length,
          today: todayRows.length,
          future: futureRows.length,
          elapsedMs: Date.now() - startedAt,
          todaySamples: todayRows.slice(0, 5).map((release) => ({
            title: release.title,
            publishedAt: release.publishedAt,
            sourceType: release.sourceType
          })),
          futureSamples: futureRows.slice(0, 3).map((release) => ({
            title: release.title,
            publishedAt: release.publishedAt,
            sourceType: release.sourceType
          }))
        })
      );
    } catch (error) {
      console.log(
        JSON.stringify({
          siteId: adapter.siteId,
          error: error instanceof Error ? error.message : String(error),
          elapsedMs: Date.now() - startedAt
        })
      );
    }
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
