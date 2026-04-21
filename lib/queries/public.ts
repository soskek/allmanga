import { prisma } from "@/lib/db/prisma";
import { extractWorkMeta, isExcludedUrl, isGenericContentTitle, titleLooksLikeEpisode } from "@/lib/utils";

type PublicSourceItem = {
  id: string;
  title: string | null;
  semanticKind: string;
  sourceType: string;
  contentKind: string;
  publishedAt: Date | null;
  firstSeenAt: Date;
  canonicalUrl: string;
  extraJson?: string | null;
  work: {
    title: string;
    authors: string;
  } | null;
  site: {
    name: string;
  };
};

export async function getPublicRecent() {
  const items = await prisma.release.findMany({
    where: {
      semanticKind: { notIn: ["unknown"] }
    },
    include: {
      work: true,
      site: true
    },
    orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
    take: 120
  });
  return items
    .filter((item) => shouldDisplayPublicRelease(item))
    .slice(0, 50);
}

export async function getPublicDiscover() {
  const items = await prisma.release.findMany({
    where: {
      semanticKind: { in: ["oneshot_discovery", "announcement"] },
      OR: [
        {
          publishedAt: { not: null }
        },
        {
          publishedAt: null,
          semanticKind: "oneshot_discovery",
          contentKind: "work",
          sourceType: { in: ["oneshot_list", "category_list"] }
        }
      ]
    },
    include: {
      work: true,
      site: true
    },
    orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
    take: 80
  });
  return items
    .filter((item) => shouldDisplayPublicDiscoverRelease(item))
    .slice(0, 30);
}

export function toPublicRelease(item: PublicSourceItem) {
  const fallback = extractWorkMeta(item.extraJson);
  return {
    id: item.id,
    workTitle: item.work?.title ?? fallback.workTitle ?? null,
    authors: item.work?.authors ?? JSON.stringify(fallback.authors),
    siteName: item.site.name,
    semanticKind: item.semanticKind,
    title: item.title,
    publishedAt: item.publishedAt,
    officialUrl: item.canonicalUrl
  };
}

function shouldDisplayPublicRelease(item: PublicSourceItem) {
  if (isExcludedUrl(item.canonicalUrl)) {
    return false;
  }

  const workTitle = item.work?.title ?? "";
  const releaseTitle = item.title ?? "";
  if (workTitle && isGenericContentTitle(workTitle) && titleLooksLikeEpisode(releaseTitle)) {
    return false;
  }

  return Boolean(
    (workTitle && !isGenericContentTitle(workTitle)) ||
      (releaseTitle && !isGenericContentTitle(releaseTitle))
  );
}

function shouldDisplayPublicDiscoverRelease(item: PublicSourceItem) {
  if (!shouldDisplayPublicRelease(item)) {
    return false;
  }
  if (titleLooksLikeEpisode(item.title ?? "")) {
    return false;
  }
  if (item.publishedAt) {
    return true;
  }
  return (
    item.semanticKind === "oneshot_discovery" &&
    item.contentKind === "work" &&
    ["oneshot_list", "category_list"].includes(item.sourceType)
  );
}
