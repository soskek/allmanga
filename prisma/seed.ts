import { PrismaClient } from "@prisma/client";
import { BOOTSTRAP_OWNER_USER_ID } from "../lib/domain";
import { env } from "../lib/env";
import { createIdFromUrl } from "../lib/server/ids";
import { defaultSites } from "../lib/sources/registry";
import { classifyRelease } from "../lib/classifier";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { id: BOOTSTRAP_OWNER_USER_ID },
    update: {
      email: env.APP_OWNER_EMAIL,
      displayName: env.APP_OWNER_NAME,
      role: "owner"
    },
    create: {
      id: BOOTSTRAP_OWNER_USER_ID,
      email: env.APP_OWNER_EMAIL,
      displayName: env.APP_OWNER_NAME,
      role: "owner"
    }
  });

  for (const site of defaultSites) {
    await prisma.site.upsert({
      where: { id: site.id },
      update: {
        name: site.name,
        baseUrl: site.baseUrl,
        syncStrategy: site.syncStrategy,
        enabled: true
      },
      create: {
        id: site.id,
        name: site.name,
        baseUrl: site.baseUrl,
        syncStrategy: site.syncStrategy,
        enabled: true
      }
    });
  }

  const works = [
    {
      siteId: "jumpplus",
      canonicalUrl: "https://shonenjumpplus.com/series/dandadan",
      title: "ダンダダン",
      authors: ["龍幸伸"],
      kind: "serial"
    },
    {
      siteId: "tonarinoyj",
      canonicalUrl: "https://tonarinoyj.jp/episode/spy-family",
      title: "SPY×FAMILY",
      authors: ["遠藤達哉"],
      kind: "serial"
    },
    {
      siteId: "comicdays",
      canonicalUrl: "https://comic-days.com/episode/sample-days",
      title: "放課後コミックDAYS",
      authors: ["作家A", "作家B"],
      kind: "serial"
    },
    {
      siteId: "sundaywebry",
      canonicalUrl: "https://www.sunday-webry.com/episode/special-read",
      title: "サンデーうぇぶり特別読切",
      authors: ["作家C"],
      kind: "oneshot"
    },
    {
      siteId: "magapoke",
      canonicalUrl: "https://pocket.shonenmagazine.com/episode/sample-pocket",
      title: "マガポケ連載サンプル",
      authors: ["作家D"],
      kind: "serial"
    }
  ];

  for (const work of works) {
    const workId = createIdFromUrl(work.siteId, work.canonicalUrl);
    await prisma.work.upsert({
      where: { id: workId },
      update: {
        title: work.title,
        authors: JSON.stringify(work.authors),
        kind: work.kind,
        status: "active",
        lastSeenAt: new Date()
      },
      create: {
        id: workId,
        siteId: work.siteId,
        canonicalUrl: work.canonicalUrl,
        title: work.title,
        authors: JSON.stringify(work.authors),
        kind: work.kind,
        status: "active",
        firstSeenAt: new Date(),
        lastSeenAt: new Date()
      }
    });

    await prisma.userWorkPref.upsert({
      where: {
        userId_workId: {
          userId: BOOTSTRAP_OWNER_USER_ID,
          workId
        }
      },
      update: {
        follow: true
      },
      create: {
        userId: BOOTSTRAP_OWNER_USER_ID,
        workId,
        follow: true,
        priority: work.title === "ダンダダン" ? 2 : 0,
        pin: work.title === "ダンダダン"
      }
    });
  }

  const releases = [
    {
      siteId: "jumpplus",
      workCanonicalUrl: "https://shonenjumpplus.com/series/dandadan",
      canonicalUrl: "https://shonenjumpplus.com/episode/dandadan-173",
      title: "第173話",
      rawBadgeText: undefined,
      sourceType: "work_page",
      contentKind: "episode"
    },
    {
      siteId: "jumpplus",
      workCanonicalUrl: "https://shonenjumpplus.com/series/dandadan",
      canonicalUrl: "https://shonenjumpplus.com/episode/dandadan-illust",
      title: "おまけイラスト",
      rawBadgeText: "イラスト",
      sourceType: "series_list",
      contentKind: "episode"
    },
    {
      siteId: "tonarinoyj",
      workCanonicalUrl: "https://tonarinoyj.jp/episode/spy-family",
      canonicalUrl: "https://tonarinoyj.jp/episode/spy-family-pr",
      title: "PR番外編 コミックス発売記念",
      rawBadgeText: undefined,
      sourceType: "news",
      contentKind: "article"
    },
    {
      siteId: "sundaywebry",
      workCanonicalUrl: "https://www.sunday-webry.com/episode/special-read",
      canonicalUrl: "https://www.sunday-webry.com/episode/special-read-1",
      title: "サンデーうぇぶり オリジナル読切",
      rawBadgeText: undefined,
      sourceType: "oneshot_list",
      contentKind: "work"
    }
  ];

  for (const release of releases) {
    const workId = createIdFromUrl(release.siteId, release.workCanonicalUrl);
    const classification = classifyRelease({
      release: {
        siteId: release.siteId,
        canonicalUrl: release.canonicalUrl,
        workCanonicalUrl: release.workCanonicalUrl,
        title: release.title,
        rawTitle: release.title,
        rawBadgeText: release.rawBadgeText,
        sourceType: release.sourceType as never,
        contentKind: release.contentKind as never
      },
      work: {
        id: workId,
        siteId: release.siteId,
        canonicalUrl: release.workCanonicalUrl,
        title: "",
        authors: [],
        kind: release.sourceType === "oneshot_list" ? "oneshot" : "serial",
        status: "active"
      }
    });
    const releaseId = createIdFromUrl(release.siteId, release.canonicalUrl);
    await prisma.release.upsert({
      where: { id: releaseId },
      update: {
        workId,
        title: release.title,
        publishedAt: new Date(),
        sourceType: release.sourceType,
        rawBadgeText: release.rawBadgeText,
        semanticKind: classification.semanticKind,
        semanticConfidence: classification.semanticConfidence,
        semanticSignals: JSON.stringify(classification.semanticSignals),
        defaultVisibility: classification.defaultVisibility,
        contentKind: release.contentKind
      },
      create: {
        id: releaseId,
        siteId: release.siteId,
        workId,
        canonicalUrl: release.canonicalUrl,
        title: release.title,
        publishedAt: new Date(),
        firstSeenAt: new Date(),
        sourceType: release.sourceType,
        rawBadgeText: release.rawBadgeText,
        semanticKind: classification.semanticKind,
        semanticConfidence: classification.semanticConfidence,
        semanticSignals: JSON.stringify(classification.semanticSignals),
        defaultVisibility: classification.defaultVisibility,
        contentKind: release.contentKind
      }
    });
  }

  const allReleases = await prisma.release.findMany();
  for (const release of allReleases) {
    await prisma.userReleaseState.upsert({
      where: {
        userId_releaseId: {
          userId: BOOTSTRAP_OWNER_USER_ID,
          releaseId: release.id
        }
      },
      update: {
        state: release.semanticKind === "main_episode" ? "unread" : "opened",
        lane: release.semanticKind === "main_episode" ? "today" : "archived"
      },
      create: {
        userId: BOOTSTRAP_OWNER_USER_ID,
        releaseId: release.id,
        state: release.semanticKind === "main_episode" ? "unread" : "opened",
        lane: release.semanticKind === "main_episode" ? "today" : "archived"
      }
    });
  }

}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
