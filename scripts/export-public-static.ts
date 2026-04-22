import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PublicHomeDocument, safeJson } from "@/components/public-home";
import { prisma } from "@/lib/db/prisma";
import { siteDisplayOrder } from "@/lib/domain";
import { groupFeedByDate, sortFeedByDateThenSite } from "@/lib/feed-order";
import type { PublicHomeCard, PublicHomeView } from "@/lib/queries/public-home";
import { getPublicHomeView } from "@/lib/queries/public-home";
import { getDefaultSettings } from "@/lib/settings";
import { calendarDayStartDate } from "@/lib/state";

const outputDir = process.env.PUBLIC_STATIC_OUT_DIR ?? "public-out";
const RECENT_WINDOW_DAYS = 7;

async function main() {
  const currentData = await getPublicHomeView();
  const previousData = await fetchPreviousPublicHomeView();
  const data = previousData ? mergePublicHomeView(currentData, previousData) : currentData;

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeJson("home.json", data),
    writeJson("recent.json", {
      generatedAt: data.generatedAt,
      items: [...data.today, ...data.recentGroups.flatMap((group) => group.items)]
    }),
    writeJson("discover.json", { generatedAt: data.generatedAt, items: data.discover }),
    writeFile(path.join(outputDir, "site.webmanifest"), createManifest(), "utf8"),
    writeFile(path.join(outputDir, "index.html"), createHtml(data), "utf8")
  ]);

  console.log(
    JSON.stringify(
      {
        outputDir,
        generatedAt: data.generatedAt,
        today: data.today.length,
        recent: data.recentGroups.reduce((count, group) => count + group.items.length, 0),
        discover: data.discover.length
      },
      null,
      2
    )
  );
}

function writeJson(name: string, payload: unknown) {
  return writeFile(path.join(outputDir, name), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function createManifest() {
  return `${JSON.stringify(
    {
      name: "AllManga Public",
      short_name: "AllManga",
      start_url: ".",
      display: "standalone",
      background_color: "#faf7f2",
      theme_color: "#18212b",
      icons: []
    },
    null,
    2
  )}\n`;
}

export function createHtml(data: Parameters<typeof PublicHomeDocument>[0]["data"]) {
  return `<!doctype html>${renderToStaticMarkup(createElement(PublicHomeDocument, { data }))}`;
}

export { safeJson };

export function mergePublicHomeView(current: PublicHomeView, previous: PublicHomeView): PublicHomeView {
  const settings = getDefaultSettings();
  const generatedAt = new Date(current.generatedAt);
  const todayStart = calendarDayStartDate(generatedAt, settings.timezone);
  const recentStart = new Date(todayStart.getTime() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const mergedByKey = new Map<string, PublicHomeCard>();

  const candidates = [
    ...current.recentGroups.flatMap((group) => group.items),
    ...previous.today,
    ...previous.recentGroups.flatMap((group) => group.items)
  ];

  for (const item of candidates) {
    const publishedAt = item.publishedAt ? new Date(item.publishedAt) : null;
    if (!publishedAt || Number.isNaN(publishedAt.getTime())) {
      continue;
    }
    if (publishedAt < recentStart || publishedAt >= todayStart) {
      continue;
    }
    const key = item.officialUrl || item.key || item.id;
    if (!mergedByKey.has(key)) {
      mergedByKey.set(key, item);
    }
  }

  const sorted = sortFeedByDateThenSite(
    Array.from(mergedByKey.values()).map((item) => ({
      item,
      siteId: item.siteId,
      publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
      firstSeenAt: new Date(item.firstSeenAt),
      followed: false
    })),
    [...settings.siteOrder, ...siteDisplayOrder],
    settings.timezone
  );

  return {
    ...current,
    recentGroups: groupFeedByDate(sorted, settings.timezone).map((group) => ({
      key: group.key,
      label: group.label,
      items: group.items.map((entry) => entry.item)
    }))
  };
}

async function fetchPreviousPublicHomeView(): Promise<PublicHomeView | null> {
  const url = process.env.PUBLIC_STATIC_PREVIOUS_HOME_URL;
  if (!url) {
    return null;
  }

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      console.warn(`Previous public home fetch skipped: ${response.status} ${response.statusText}`);
      return null;
    }
    const payload = await response.json();
    return isPublicHomeView(payload) ? payload : null;
  } catch (error) {
    console.warn("Previous public home fetch skipped:", error);
    return null;
  }
}

function isPublicHomeView(value: unknown): value is PublicHomeView {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<PublicHomeView>;
  return (
    typeof candidate.generatedAt === "string" &&
    Array.isArray(candidate.today) &&
    Array.isArray(candidate.discover) &&
    Array.isArray(candidate.recentGroups)
  );
}

function isMainModule() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}

if (isMainModule()) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
