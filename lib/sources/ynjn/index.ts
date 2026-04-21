import type { NormalizedRelease, SourceAdapter } from "@/lib/types";
import { fetchJson, fetchText } from "@/lib/sources/http";
import { env } from "@/lib/env";
import { canonicalizeUrl, isExcludedUrl, normalizeWhitespace, uniqBy } from "@/lib/utils";

const baseUrl = "https://ynjn.jp";
const apiBaseUrl = "https://webapi.ynjn.jp";
const sort = "POPULARITY";
const episodeBatchSize = 4;
const thumbnailBatchSize = 4;

type YnjnLabelResponse = {
  data?: {
    labels?: Array<{ id: number; name: string; description?: string }>;
  };
};

type YnjnValueResponse = {
  data?: {
    values?: Array<{ id: number; value: string; value_tint?: string | null }>;
  };
};

type YnjnTitleListResponse = {
  data?: {
    info?: {
      id: number;
      value: string;
      value_tint?: string | null;
      is_show_more?: boolean;
    };
    titles?: Array<{
      id: number;
      name: string;
      lead_text?: {
        body?: string;
        style?: string;
      } | null;
    }>;
  };
};

type YnjnEpisodeResponse = {
  data?: {
    all_count?: number;
    episodes?: Array<{
      id: number;
      name: string;
      image_url?: string;
      lead_text?: string;
      reading_condition?: string;
      is_viewer_transition?: boolean;
    }>;
  };
};

type YnjnEpisode = NonNullable<NonNullable<YnjnEpisodeResponse["data"]>["episodes"]>[number];

type YnjnTitleSeed = {
  id: number;
  title: string;
  kind: "serial" | "oneshot";
  sourceType: "label_list" | "category_list";
  sourceName: string;
  sourceId: number;
  leadText?: string;
};

export const ynjnAdapter: SourceAdapter = {
  siteId: "ynjn",
  enabledByDefault: true,
  async sync() {
    const [labelsResponse, freeValuesResponse] = await Promise.all([
      fetchJson<YnjnLabelResponse>(`${apiBaseUrl}/labels`),
      fetchJson<YnjnValueResponse>(`${apiBaseUrl}/title/value/FREE`)
    ]);

    const labels = labelsResponse.data?.labels ?? [];
    const oneshotValues = (freeValuesResponse.data?.values ?? []).filter((value) => value.value.includes("読切"));

    const seeds = new Map<number, YnjnTitleSeed>();
    const logs: string[] = [`ynjn labels=${labels.length}`, `ynjn oneshotCategories=${oneshotValues.length}`, "ynjn excludes /gravure/"];

    const labelLists = await Promise.all(
      labels.map(async (label) => {
        const response = await fetchJson<YnjnTitleListResponse>(
          `${apiBaseUrl}/title/category/LABEL?category=LABEL&id=${label.id}&page=1&sort=${sort}`
        );
        return {
          label,
          response
        };
      })
    );

    for (const { label, response } of labelLists) {
      const titles = response.data?.titles ?? [];
      logs.push(`ynjn label:${label.id} titles=${titles.length}`);
      for (const title of titles) {
        upsertSeed(seeds, {
          id: title.id,
          title: title.name,
          kind: "serial",
          sourceType: "label_list",
          sourceName: label.name,
          sourceId: label.id,
          leadText: title.lead_text?.body ?? ""
        });
      }
    }

    const oneshotLists = await Promise.all(
      oneshotValues.map(async (value) => {
        const response = await fetchJson<YnjnTitleListResponse>(
          `${apiBaseUrl}/title/category/FREE?category=FREE&id=${value.id}&page=1&sort=${sort}`
        );
        return {
          value,
          response
        };
      })
    );

    for (const { value, response } of oneshotLists) {
      const titles = response.data?.titles ?? [];
      logs.push(`ynjn free:${value.id} titles=${titles.length}`);
      for (const title of titles) {
        upsertSeed(seeds, {
          id: title.id,
          title: title.name,
          kind: "oneshot",
          sourceType: "category_list",
          sourceName: value.value,
          sourceId: value.id,
          leadText: title.lead_text?.body ?? ""
        });
      }
    }

    const seedList = [...seeds.values()].filter(
      (seed) => !isExcludedUrl(workUrl(seed.id)) && !isNonMangaYnjnTitle(seed.title, seed.leadText)
    );
    const thumbnailMap = await collectYnjnThumbnails(seedList, logs);

    const works = seedList.map((seed) => ({
      siteId: "ynjn" as const,
      canonicalUrl: workUrl(seed.id),
      title: normalizeWhitespace(seed.title),
      authors: [],
      kind: seed.kind,
      status: "unknown" as const
    }));

    const discoveryReleases: NormalizedRelease[] = seedList.map((seed) => ({
      siteId: "ynjn" as const,
      canonicalUrl: workUrl(seed.id),
      workCanonicalUrl: workUrl(seed.id),
      title: normalizeWhitespace(seed.title),
      rawTitle: normalizeWhitespace(seed.title),
      sourceType: seed.sourceType,
      contentKind: "work" as const,
      extra: {
        thumbnailUrl: thumbnailMap.get(seed.id) ?? null,
        workThumbnailUrl: thumbnailMap.get(seed.id) ?? null,
        previewThumbnailUrl: thumbnailMap.get(seed.id) ?? null,
        categoryId: seed.sourceId,
        categoryName: seed.sourceName,
        leadText: seed.leadText ?? ""
      }
    }));

    const episodeResponses = await collectEpisodes(seedList, logs);
    const episodeReleases: NormalizedRelease[] = episodeResponses.flatMap(({ seed, episodes }) =>
      episodes
        .filter((episode) => episode.is_viewer_transition !== false)
        .map((episode) => ({
          siteId: "ynjn" as const,
          canonicalUrl: releaseUrl(seed.id, episode.id),
          workCanonicalUrl: workUrl(seed.id),
          title: normalizeWhitespace(episode.name),
          rawTitle: normalizeWhitespace(episode.name),
          sourceType: "work_page" as const,
          contentKind: "episode" as const,
          extra: {
            thumbnailUrl: episode.image_url ? canonicalizeUrl(episode.image_url) : null,
            workThumbnailUrl: thumbnailMap.get(seed.id) ?? null,
            previewThumbnailUrl: episode.image_url ? canonicalizeUrl(episode.image_url) : thumbnailMap.get(seed.id) ?? null,
            readingCondition: episode.reading_condition ?? null,
            leadText: episode.lead_text ?? "",
            workTitle: seed.title
          }
        }))
    );

    const releases = uniqBy(
      discoveryReleases.concat(episodeReleases).filter((release) => !isExcludedUrl(release.canonicalUrl)),
      (release) => release.canonicalUrl
    );

    logs.push(`ynjn works=${works.length}`);
    logs.push(`ynjn releases=${releases.length}`);

    return {
      works: uniqBy(works, (work) => work.canonicalUrl),
      releases,
      logs
    };
  }
};

function upsertSeed(map: Map<number, YnjnTitleSeed>, seed: YnjnTitleSeed) {
  const existing = map.get(seed.id);
  if (!existing) {
    map.set(seed.id, {
      ...seed,
      title: normalizeWhitespace(seed.title)
    });
    return;
  }

  map.set(seed.id, {
    ...existing,
    title: existing.title || normalizeWhitespace(seed.title),
    kind: existing.kind === "oneshot" || seed.kind === "oneshot" ? "oneshot" : "serial",
    sourceType: existing.sourceType === "category_list" ? existing.sourceType : seed.sourceType,
    sourceName: existing.sourceName || seed.sourceName,
    sourceId: existing.sourceId || seed.sourceId,
    leadText: existing.leadText || seed.leadText
  });
}

async function collectYnjnThumbnails(seeds: YnjnTitleSeed[], logs: string[]) {
  const thumbnails = new Map<number, string>();
  const targets = env.YNJN_THUMBNAIL_SYNC_LIMIT > 0 ? seeds.slice(0, env.YNJN_THUMBNAIL_SYNC_LIMIT) : [];
  if (targets.length < seeds.length) {
    logs.push(`ynjn thumbnails limited=${targets.length}/${seeds.length}`);
  }

  for (let index = 0; index < targets.length; index += thumbnailBatchSize) {
    const batch = targets.slice(index, index + thumbnailBatchSize);
    const results = await Promise.all(
      batch.map(async (seed) => {
        try {
          const html = await fetchText(workUrl(seed.id));
          const match =
            html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) ??
            html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i);
          const thumbnailUrl = match?.[1] ? canonicalizeUrl(match[1]) : null;
          if (thumbnailUrl) {
            logs.push(`ynjn thumbnail:${seed.id} ok`);
          }
          return {
            id: seed.id,
            thumbnailUrl
          };
        } catch (error) {
          logs.push(`ynjn thumbnail:${seed.id} failed=${error instanceof Error ? error.message : String(error)}`);
          return {
            id: seed.id,
            thumbnailUrl: null
          };
        }
      })
    );

    for (const result of results) {
      if (result.thumbnailUrl) {
        thumbnails.set(result.id, result.thumbnailUrl);
      }
    }
  }

  return thumbnails;
}

async function collectEpisodes(
  seeds: YnjnTitleSeed[],
  logs: string[]
): Promise<Array<{ seed: YnjnTitleSeed; episodes: YnjnEpisode[] }>> {
  const results: Array<{ seed: YnjnTitleSeed; episodes: YnjnEpisode[] }> = [];
  const targets = env.YNJN_EPISODE_SYNC_LIMIT > 0 ? seeds.slice(0, env.YNJN_EPISODE_SYNC_LIMIT) : [];
  if (targets.length < seeds.length) {
    logs.push(`ynjn episodes limited=${targets.length}/${seeds.length}`);
  }

  for (let index = 0; index < targets.length; index += episodeBatchSize) {
    const batch = targets.slice(index, index + episodeBatchSize);
    const batchResults = await Promise.all(
      batch.map(async (seed) => {
        try {
          const response = await fetchJson<YnjnEpisodeResponse>(`${apiBaseUrl}/title/${seed.id}/episode?isGetAll=true`);
          const allEpisodes = response.data?.episodes ?? [];
          const episodes = allEpisodes.slice(0, env.YNJN_EPISODES_PER_TITLE_LIMIT);
          logs.push(`ynjn episodes:${seed.id} count=${episodes.length}/${allEpisodes.length}`);
          return {
            seed,
            episodes
          };
        } catch (error) {
          logs.push(`ynjn episodes:${seed.id} failed=${error instanceof Error ? error.message : String(error)}`);
          return {
            seed,
            episodes: []
          };
        }
      })
    );

    results.push(...batchResults);
  }

  return results;
}

function workUrl(titleId: number) {
  return canonicalizeUrl(`${baseUrl}/title/${titleId}`);
}

function releaseUrl(titleId: number, episodeId: number) {
  return canonicalizeUrl(`${baseUrl}/title/${titleId}/${episodeId}`);
}

function isNonMangaYnjnTitle(title: string, leadText?: string) {
  const combined = `${normalizeWhitespace(title)} ${normalizeWhitespace(leadText ?? "")}`;
  return /(グラビア|WEB限定グラビア|写真集|デジタル限定|水着)/i.test(combined);
}
