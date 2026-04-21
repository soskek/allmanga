import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";

const port = 3101;
const baseUrl = `http://127.0.0.1:${port}`;
const password = process.env.APP_DEV_PASSWORD ?? "changeme";
const prisma = new PrismaClient();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) {
        return;
      }
    } catch {
      // wait until the server is ready
    }
    await delay(500);
  }
  throw new Error("Smoke server did not start in time");
}

function extractThumbnailUrl(extraJson?: string | null) {
  if (!extraJson) {
    return null;
  }

  try {
    const extra = JSON.parse(extraJson) as Record<string, unknown>;
    const value = extra.thumbnailUrl ?? extra.imageUrl ?? extra.coverUrl ?? extra.thumbnail;
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

function normalizeThumbnailUrl(url: string) {
  return url
    .replaceAll("{height}", "320")
    .replaceAll("{width}", "320")
    .replaceAll("%7Bheight%7D", "320")
    .replaceAll("%7Bwidth%7D", "320");
}

function getCalendarDayStart(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getUnreadBoundary(now: Date) {
  const boundary = new Date(now);
  boundary.setHours(4, 0, 0, 0);
  if (now < boundary) {
    boundary.setDate(boundary.getDate() - 1);
  }
  return boundary;
}

async function fetchYoungAnimalOfficialTodayEpisodeCount(todayIsoDate: string) {
  const response = await fetch("https://younganimal.com/sitemap.xml");
  if (!response.ok) {
    throw new Error(`Failed to fetch younganimal sitemap: ${response.status}`);
  }

  const xml = await response.text();
  const matches = [...xml.matchAll(/<url><loc>https:\/\/younganimal\.com\/episodes\/[^<]+<\/loc><lastmod>([^<]+)<\/lastmod>/g)];
  return matches.filter((match) => match[1] === todayIsoDate).length;
}

async function main() {
  const child = spawn(process.execPath, ["./node_modules/next/dist/bin/next", "start", "-p", String(port)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe"
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForServer();

    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ password }),
      redirect: "manual"
    });
    assert(
      loginResponse.status === 200 || (loginResponse.status >= 300 && loginResponse.status < 400),
      `Login failed with status ${loginResponse.status}`
    );

    const cookie = loginResponse.headers.get("set-cookie");
    assert(cookie, "Login did not return a session cookie");

    const [homeResponse, publicResponse, privateApiResponse, publicApiResponse] = await Promise.all([
      fetch(`${baseUrl}/`, {
        headers: { cookie }
      }),
      fetch(`${baseUrl}/public`),
      fetch(`${baseUrl}/api/private/home`, {
        headers: { cookie }
      }),
      fetch(`${baseUrl}/api/public/recent`)
    ]);

    const homeHtml = await homeResponse.text();
    const publicHtml = await publicResponse.text();
    const privateApi = (await privateApiResponse.json()) as Record<string, unknown>;
    const publicApi = (await publicApiResponse.json()) as Array<Record<string, unknown>>;

    assert(homeResponse.ok, `Home route failed with status ${homeResponse.status}`);
    assert(homeHtml.includes("未読スタック"), "Unread stack section is missing");
    assert(homeHtml.includes("今日の新着"), "Today feed section is missing");
    assert(homeHtml.includes("最近の本編"), "Recent main section is missing");
    assert(homeHtml.includes("発見"), "Discover section is missing");
    assert(!homeHtml.includes("現在時刻"), "Old oversized current-time block is still rendered");

    const dbThumbnailRows = await Promise.all(
      ["jumpplus", "sundaywebry", "comicdays"].map((siteId) =>
        prisma.release.findFirst({
          where: {
            siteId,
            extraJson: {
              contains: "thumbnailUrl"
            }
          },
          orderBy: [{ updatedAt: "desc" }],
          select: {
            siteId: true,
            extraJson: true
          }
        })
      )
    );

    const thumbnailTargets = dbThumbnailRows
      .filter((row): row is NonNullable<(typeof dbThumbnailRows)[number]> => Boolean(row))
      .map((row) => ({
        siteId: row.siteId,
        thumbnailUrl: extractThumbnailUrl(row.extraJson)
      }))
      .filter((row): row is { siteId: string; thumbnailUrl: string } => Boolean(row.siteId && row.thumbnailUrl))
      .slice(0, 3);

    assert(thumbnailTargets.length >= 3, "Expected thumbnail candidates for jumpplus/sundaywebry/comicdays");

    for (const target of thumbnailTargets) {
      const thumbUrl = `/api/private/thumb?siteId=${encodeURIComponent(target.siteId)}&url=${encodeURIComponent(normalizeThumbnailUrl(target.thumbnailUrl))}`;
      const thumbnailResponse = await fetch(`${baseUrl}${thumbUrl}`, {
        headers: { cookie }
      });
      const contentType = thumbnailResponse.headers.get("content-type") ?? "";
      assert(thumbnailResponse.ok, `Thumbnail proxy failed with status ${thumbnailResponse.status}`);
      assert(contentType.startsWith("image/"), `Thumbnail proxy did not return an image: ${contentType}`);
    }

    for (const siteId of [
      "jumpplus",
      "tonarinoyj",
      "comicdays",
      "sundaywebry",
      "magapoke",
      "ynjn",
      "mangaone",
      "yanmaga",
      "younganimal",
      "comicwalker"
    ]) {
      const iconResponse = await fetch(`${baseUrl}/api/site-icon?siteId=${siteId}`);
      const contentType = iconResponse.headers.get("content-type") ?? "";
      assert(iconResponse.ok, `Site icon proxy failed for ${siteId} with status ${iconResponse.status}`);
      assert(contentType.startsWith("image/"), `Site icon proxy did not return an image for ${siteId}: ${contentType}`);
    }

    assert(publicResponse.ok, `Public route failed with status ${publicResponse.status}`);
    assert(publicHtml.includes("Public-safe metadata"), "Public-safe header was not rendered");
    assert(!publicHtml.includes("読了"), "Public-safe page leaked private actions");
    assert(!publicHtml.includes("フォロー"), "Public-safe page leaked follow controls");

    assert(Array.isArray(privateApi.unreadStack), "Private home API unreadStack is missing");
    assert(Array.isArray(privateApi.recentMainFeed), "Private home API recentMainFeed is missing");
    assert(Array.isArray(privateApi.todayFeed), "Private home API todayFeed is missing");
    const todayFeed = (privateApi.todayFeed as Array<Record<string, unknown>> | undefined) ?? [];
    assert(
      todayFeed.every((row) => row.sourceType === "rss" || row.sourceType === "work_page"),
      "Today feed leaked non-update source types"
    );
    assert(todayFeed.every((row) => row.contentKind === "episode"), "Today feed leaked non-episode content");
    const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
    assert(
      todayFeed.every((row) => !row.publishedAt || new Date(String(row.publishedAt)).getTime() <= tomorrow),
      "Today feed still contains implausible future-dated releases"
    );
    assert(
      todayFeed.every(
        (row) => typeof row.title !== "string" || !/^20\d{2}\/\d{2}\/\d{2}\s/.test(row.title)
      ),
      "Today feed still contains raw date-prefixed titles"
    );

    const representativeSites = ["jumpplus", "comicdays", "sundaywebry"];
    for (const siteId of representativeSites) {
      const representative = todayFeed.find(
        (row) => row.siteId === siteId && typeof row.title === "string" && row.title.length > 0
      );
      if (!representative) {
        continue;
      }
      assert(
        homeHtml.includes(String(representative.title)),
        `Rendered home HTML is missing visible today card text for ${siteId}: ${String(representative.title)}`
      );
    }

    const thumbProxyHits = (homeHtml.match(/\/api\/private\/thumb\?/g) ?? []).length;
    assert(thumbProxyHits >= 12, `Rendered home HTML has too few thumbnail proxy images: ${thumbProxyHits}`);

    const calendarDayStart = getCalendarDayStart(new Date());
    const unreadBoundary = getUnreadBoundary(new Date());
    const dbTodayRows = await prisma.release.findMany({
      where: {
        contentKind: "episode",
        sourceType: { in: ["rss", "work_page"] },
        OR: [
          { publishedAt: { gte: calendarDayStart } },
          { publishedAt: null, sourceType: "work_page", firstSeenAt: { gte: unreadBoundary } }
        ]
      },
      select: {
        siteId: true,
        extraJson: true
      }
    });
    const todaySites = new Set(todayFeed.map((row) => (typeof row.siteId === "string" ? row.siteId : "")).filter(Boolean));
    assert(todaySites.size >= 8, `Today feed is not diverse enough: ${[...todaySites].join(", ")}`);
    const dbTodaySitesWithThumbnails = new Set(
      dbTodayRows
        .filter((row) => Boolean(extractThumbnailUrl(row.extraJson)))
        .map((row) => row.siteId)
    );
    const missingTodaySites = [...dbTodaySitesWithThumbnails].filter((siteId) => !todaySites.has(siteId));
    assert(
      missingTodaySites.length === 0,
      `Today feed is missing thumbnail-backed sites with eligible updates: ${missingTodaySites.join(", ")}`
    );
    const dbTodaySites = new Set(dbTodayRows.map((row) => row.siteId));
    const missingEligibleTodaySites = [...dbTodaySites].filter((siteId) => !todaySites.has(siteId));
    assert(
      missingEligibleTodaySites.length === 0,
      `Today feed is missing eligible updated sites: ${missingEligibleTodaySites.join(", ")}`
    );
    const todayIsoDate = new Date().toISOString().slice(0, 10);
    const youngAnimalOfficialTodayCount = await fetchYoungAnimalOfficialTodayEpisodeCount(todayIsoDate);
    if (youngAnimalOfficialTodayCount > 0) {
      assert(todaySites.has("younganimal"), "Today feed is missing younganimal despite official today episodes");
    }

    const thumbCount = todayFeed.reduce((count, row) => {
      const direct = typeof row.extraJson === "string" ? extractThumbnailUrl(row.extraJson) : null;
      const nestedRelease = Array.isArray((row.work as { releases?: Array<{ extraJson?: string | null }> } | undefined)?.releases)
        ? (row.work as { releases?: Array<{ extraJson?: string | null }> }).releases?.[0]?.extraJson
        : null;
      const nested = typeof nestedRelease === "string" ? extractThumbnailUrl(nestedRelease) : null;
      return count + (Boolean(direct || nested) ? 1 : 0);
    }, 0);
    if (todayFeed.length > 0) {
      assert(thumbCount / todayFeed.length >= 0.6, `Today feed thumbnail coverage is too low: ${thumbCount}/${todayFeed.length}`);
    }
    for (const siteId of ["sundaywebry", "ynjn"]) {
      const siteRows = todayFeed.filter((row) => row.siteId === siteId);
      if (siteRows.length === 0) {
        continue;
      }
      const siteThumbCount = siteRows.filter((row) => {
        const direct = typeof row.extraJson === "string" ? extractThumbnailUrl(row.extraJson) : null;
        const nestedRelease = Array.isArray((row.work as { releases?: Array<{ extraJson?: string | null }> } | undefined)?.releases)
          ? (row.work as { releases?: Array<{ extraJson?: string | null }> }).releases?.[0]?.extraJson
          : null;
        const nested = typeof nestedRelease === "string" ? extractThumbnailUrl(nestedRelease) : null;
        return Boolean(direct || nested);
      }).length;
      assert(siteThumbCount > 0, `Today feed has no thumbnails for ${siteId}`);
    }

    const recentSites = new Set(
      ((privateApi.recentMainFeed as Array<Record<string, unknown>> | undefined) ?? [])
        .map((row) => (typeof row.siteId === "string" ? row.siteId : ""))
        .filter(Boolean)
    );
    assert(recentSites.size >= 5, `Recent main feed is not diverse enough: ${[...recentSites].join(", ")}`);
    assert(Array.isArray(publicApi), "Public recent API did not return an array");
    assert(
      publicApi.every((row) => !("follow" in row) && !("priority" in row) && !("state" in row)),
      "Public recent API leaked private fields"
    );

    console.log("Smoke verification passed");
  } catch (error) {
    child.kill("SIGTERM");
    await delay(500);
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n--- next stdout ---\n${stdout}\n--- next stderr ---\n${stderr}`
    );
  }

  child.kill("SIGTERM");
  await prisma.$disconnect();
}

main().catch((error) => {
  prisma.$disconnect().catch(() => {});
  console.error(error);
  process.exit(1);
});
