import type { NormalizedRelease, NormalizedWork, SourceAdapter } from "@/lib/types";
import { fetchJson, fetchText } from "@/lib/sources/http";
import { collectComicWalkerWorks, extractJsonScript } from "@/lib/sources/helpers";
import { canonicalizeUrl, normalizeWhitespace, uniqBy } from "@/lib/utils";

const searchUrl = "https://comic-walker.com/search/content";
const detailBatchSize = 24;

type SearchWork = {
  code: string;
  title: string;
  labelName?: string;
  labelDescription?: string;
  episodeTitle?: string;
  episodeUpdatedAt?: string;
  isNewSerialization?: boolean;
  serializationStatus?: string;
};

type ComicWalkerAuthor = {
  name?: string;
};

type ComicWalkerWorkPayload = {
  work?: {
    code?: string;
    title?: string;
    summary?: string;
    authors?: ComicWalkerAuthor[];
    isOneShot?: boolean;
    serializationStatus?: string;
    thumbnail?: string;
    originalThumbnail?: string;
    bookCover?: string;
  };
  firstComic?: {
    title?: string;
    release?: string;
    episodes?: ComicWalkerEpisodeSummary[];
  };
  latestComic?: {
    title?: string;
    release?: string;
    episodes?: ComicWalkerEpisodeSummary[];
  };
  firstEpisodes?: ComicWalkerEpisodeSummary[] | null;
  latestEpisodes?: ComicWalkerEpisodeSummary[] | null;
  latestEpisodeId?: string;
};

type ComicWalkerEpisodePayload = {
  episode?: ComicWalkerEpisodeSummary | null;
};

type ComicWalkerEpisodeSummary = {
  code?: string;
  title?: string;
  subTitle?: string;
  updateDate?: string;
  serviceId?: string;
  internal?: {
    episodetype?: string;
  };
};

type ComicWalkerDetail = {
  work: SearchWork;
  payload?: ComicWalkerWorkPayload;
  latestEpisode?: ComicWalkerEpisodeSummary | null;
};

export const comicwalkerAdapter: SourceAdapter = {
  siteId: "comicwalker",
  enabledByDefault: true,
  async sync() {
    const html = await fetchText(searchUrl);
    const nextData = extractJsonScript<unknown>(html, "__NEXT_DATA__");
    const extractedWorks = collectComicWalkerWorks(nextData);
    const details = await fetchComicWalkerDetails(extractedWorks);

    const works = uniqBy(
      extractedWorks.map((work) => toNormalizedWork(work, details.get(work.code))),
      (work) => work.canonicalUrl
    );

    const releases = uniqBy(
      extractedWorks.flatMap<NormalizedRelease>((work) => {
        const detail = details.get(work.code);
        const release = toNormalizedRelease(work, detail);
        return release ? [release] : [];
      }),
      (release) => release.canonicalUrl
    );

    const workPageReleases = releases.filter((release) => release.sourceType === "work_page").length;

    return {
      works,
      releases,
      logs: [
        `comicwalker searchWorks=${extractedWorks.length}`,
        `comicwalker detailWorks=${details.size}`,
        `comicwalker works=${works.length}`,
        `comicwalker releases=${releases.length}`,
        `comicwalker workPageReleases=${workPageReleases}`
      ]
    };
  }
};

function toNormalizedWork(work: SearchWork, detail?: ComicWalkerDetail): NormalizedWork {
  const payload = detail?.payload?.work;
  const title = normalizeWhitespace(payload?.title || work.title);
  const authors = uniqBy(
    (payload?.authors ?? [])
      .map((author) => normalizeWhitespace(author.name ?? ""))
      .filter((author) => author.length > 0),
    (author) => author
  );

  return {
    siteId: "comicwalker",
    canonicalUrl: workUrl(work.code),
    title,
    authors,
    kind: payload?.isOneShot === true ? "oneshot" : "serial",
    status: normalizeStatus(payload?.serializationStatus || work.serializationStatus),
    descriptionText: normalizeDescription(payload?.summary || work.labelDescription)
  };
}

function toNormalizedRelease(work: SearchWork, detail?: ComicWalkerDetail): NormalizedRelease | null {
  const latestEpisode = detail?.latestEpisode;
  if (latestEpisode?.code) {
    const title = normalizeReleaseTitle(work.title, latestEpisode.title, latestEpisode.subTitle);
    return {
      siteId: "comicwalker",
      canonicalUrl: episodeUrl(work.code, latestEpisode.code),
      workCanonicalUrl: workUrl(work.code),
      title,
      rawTitle: title,
      publishedAt: latestEpisode.updateDate,
      sourceType: "work_page",
      contentKind: "episode",
      extra: {
        labelName: work.labelName,
        isNewSerialization: work.isNewSerialization ?? false,
        serviceId: latestEpisode.serviceId ?? null,
        episodeType: latestEpisode.internal?.episodetype ?? null,
        thumbnailUrl:
          detail?.payload?.work?.bookCover ??
          detail?.payload?.work?.thumbnail ??
          detail?.payload?.work?.originalThumbnail ??
          null,
        workThumbnailUrl:
          detail?.payload?.work?.originalThumbnail ??
          detail?.payload?.work?.thumbnail ??
          detail?.payload?.work?.bookCover ??
          null,
        previewThumbnailUrl:
          detail?.payload?.work?.thumbnail ??
          detail?.payload?.work?.originalThumbnail ??
          detail?.payload?.work?.bookCover ??
          null
      }
    };
  }

  const fallbackTitle = work.episodeTitle ? normalizeReleaseTitle(work.title, work.episodeTitle) : normalizeWhitespace(work.title);
  return {
    siteId: "comicwalker",
    canonicalUrl: workUrl(work.code),
    workCanonicalUrl: workUrl(work.code),
    title: fallbackTitle,
    rawTitle: fallbackTitle,
    publishedAt: work.episodeUpdatedAt,
    sourceType: "label_list",
    contentKind: "work",
      extra: {
        labelName: work.labelName,
        isNewSerialization: work.isNewSerialization ?? false,
        previewThumbnailUrl:
          detail?.payload?.work?.bookCover ??
          detail?.payload?.work?.originalThumbnail ??
          detail?.payload?.work?.thumbnail ??
          null
      }
    };
}

async function fetchComicWalkerDetails(works: SearchWork[]) {
  const detailMap = new Map<string, ComicWalkerDetail>();

  for (let index = 0; index < works.length; index += detailBatchSize) {
    const batch = works.slice(index, index + detailBatchSize);
    const results = await Promise.all(batch.map((work) => fetchComicWalkerDetail(work)));

    for (const detail of results) {
      detailMap.set(detail.work.code, detail);
    }
  }

  return detailMap;
}

async function fetchComicWalkerDetail(work: SearchWork): Promise<ComicWalkerDetail> {
  try {
    const payload = await fetchJson<ComicWalkerWorkPayload>(detailWorkUrl(work.code));
    const latestEpisode = await fetchLatestEpisode(work.code, payload);
    return {
      work,
      payload,
      latestEpisode
    };
  } catch {
    return { work };
  }
}

async function fetchLatestEpisode(workCode: string, payload: ComicWalkerWorkPayload) {
  if (payload.latestEpisodeId) {
    try {
      const response = await fetchJson<ComicWalkerEpisodePayload>(detailEpisodeUrl(workCode, payload.latestEpisodeId));
      if (response.episode?.code) {
        return response.episode;
      }
    } catch {
      // Fall through to list-based episode data below.
    }
  }

  return (
    payload.latestEpisodes?.find((episode) => Boolean(episode.code)) ??
    payload.latestComic?.episodes?.find((episode) => Boolean(episode.code)) ??
    payload.firstEpisodes?.find((episode) => Boolean(episode.code)) ??
    payload.firstComic?.episodes?.find((episode) => Boolean(episode.code)) ??
    null
  );
}

function workUrl(workCode: string) {
  return canonicalizeUrl(`https://comic-walker.com/detail/${workCode}`);
}

function episodeUrl(workCode: string, episodeCode: string) {
  return canonicalizeUrl(`https://comic-walker.com/detail/${workCode}/episodes/${episodeCode}`);
}

function detailWorkUrl(workCode: string) {
  return `https://comic-walker.com/api/contents/details/work?workCode=${encodeURIComponent(workCode)}`;
}

function detailEpisodeUrl(workCode: string, latestEpisodeId: string) {
  const params = new URLSearchParams({
    workCode,
    episodeType: "latest",
    latestEpisodeId
  });
  return `https://comic-walker.com/api/contents/details/episode?${params.toString()}`;
}

function normalizeStatus(status?: string): "active" | "ended" | "unknown" {
  if (status === "ongoing") {
    return "active";
  }
  if (status === "finished") {
    return "ended";
  }
  return "unknown";
}

function normalizeDescription(value?: string) {
  if (!value) {
    return null;
  }

  const normalized = normalizeWhitespace(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeReleaseTitle(workTitle: string, episodeTitle?: string, subTitle?: string) {
  const parts = [workTitle, episodeTitle, subTitle]
    .map((value) => normalizeWhitespace(value ?? ""))
    .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);
  return parts.join(" ");
}
