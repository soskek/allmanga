import type { NormalizedRelease, SourceAdapter } from "@/lib/types";
import { fetchBytes } from "@/lib/sources/http";
import { canonicalizeUrl, normalizeWhitespace, uniqBy } from "@/lib/utils";

const apiUrl = "https://manga-one.com/api/client?rq=rensai";
const baseUrl = "https://manga-one.com";
const chapterListBatchSize = 6;
const chapterListLimit = 10;

type MangaOneTitle = {
  titleId: number;
  titleName: string;
  description: string;
  authorName: string;
  updateInfo: string;
  latestUpdateDate: string;
  nextUpdateDate: string;
  isCompleted: boolean;
  firstChapterId?: number;
  titleListSingleUrl?: string;
  titleVerticalThumbUrl?: string;
};

type MangaOneDay = {
  year?: number;
  month?: number;
  day?: number;
};

type MangaOneRensaiItem = {
  title: MangaOneTitle;
  openChapterId?: number;
  updatedDay?: MangaOneDay;
};

type MangaOneChapter = {
  chapterId: number;
  chapterName: string;
  description: string;
  thumbnailUrl?: string;
  publishedDate?: string;
  endOfRentalPeriod?: string;
  numberOfComments?: number;
};

export const mangaoneAdapter: SourceAdapter = {
  siteId: "mangaone",
  enabledByDefault: true,
  async sync() {
    const bytes = await fetchBytes(apiUrl);
    const items = decodeWebRensaiListResponse(bytes);
    const chapterMap = await fetchChapterLists(items);

    const works = uniqBy(
      items
        .filter((item) => item.title.titleId > 0)
        .map((item) => ({
          siteId: "mangaone" as const,
          canonicalUrl: workUrl(item.title.titleId),
          title: normalizeWhitespace(item.title.titleName),
          authors: item.title.authorName ? [normalizeWhitespace(item.title.authorName)] : [],
          kind: "serial" as const,
          status: item.title.isCompleted ? ("ended" as const) : ("active" as const),
          descriptionText: item.title.description ? normalizeWhitespace(item.title.description) : null
        })),
      (work) => work.canonicalUrl
    );

    const releases = uniqBy(
      items.flatMap<NormalizedRelease>((item) => {
        if (item.title.titleId <= 0) {
          return [];
        }

        const chapters = chapterMap.get(item.title.titleId) ?? [];
        const currentChapterId = resolveCurrentChapterId(chapters, item);
        const updatedAt = formatUpdatedDay(item.updatedDay);
        if (chapters.length > 0) {
          return chapters.map((chapter) => ({
            siteId: "mangaone" as const,
            canonicalUrl: releaseUrl(item.title.titleId, chapter.chapterId),
            workCanonicalUrl: workUrl(item.title.titleId),
            title: normalizeWhitespace(chapter.chapterName || item.title.updateInfo || `${item.title.titleName} 更新`),
            rawTitle: normalizeWhitespace(chapter.chapterName || item.title.updateInfo || item.title.titleName),
            publishedAt: resolveChapterPublishedAt({
              chapterId: chapter.chapterId,
              currentChapterId,
              chapterPublishedDate: chapter.publishedDate,
              updatedAt
            }),
            sourceType: "work_page" as const,
            contentKind: "episode" as const,
            extra: {
              workTitle: item.title.titleName,
              latestUpdateDate: item.title.latestUpdateDate || null,
              nextUpdateDate: item.title.nextUpdateDate || null,
              authorName: item.title.authorName || null,
              chapterDescription: chapter.description || null,
              endOfRentalPeriod: chapter.endOfRentalPeriod || null,
              numberOfComments: chapter.numberOfComments ?? null,
              thumbnailUrl: chapter.thumbnailUrl || null,
              workThumbnailUrl: item.title.titleVerticalThumbUrl || item.title.titleListSingleUrl || null,
              seriesThumbnailUrl: item.title.titleListSingleUrl || null,
              previewThumbnailUrl: chapter.thumbnailUrl || item.title.titleListSingleUrl || item.title.titleVerticalThumbUrl || null
            }
          }));
        }

        return [
          {
            siteId: "mangaone" as const,
            canonicalUrl: releaseUrl(item.title.titleId, item.openChapterId ?? item.title.firstChapterId),
            workCanonicalUrl: workUrl(item.title.titleId),
            title: normalizeWhitespace(item.title.updateInfo || `${item.title.titleName} 更新`),
            rawTitle: normalizeWhitespace(item.title.updateInfo || item.title.titleName),
            publishedAt: formatUpdatedDay(item.updatedDay),
            sourceType: "series_list" as const,
            contentKind: "episode" as const,
            extra: {
              workTitle: item.title.titleName,
              latestUpdateDate: item.title.latestUpdateDate || null,
              nextUpdateDate: item.title.nextUpdateDate || null,
              authorName: item.title.authorName || null,
              workThumbnailUrl: item.title.titleVerticalThumbUrl || item.title.titleListSingleUrl || null,
              seriesThumbnailUrl: item.title.titleListSingleUrl || null,
              previewThumbnailUrl: item.title.titleListSingleUrl || item.title.titleVerticalThumbUrl || null
            }
          }
        ];
      }),
      (release) => release.canonicalUrl
    );

    return {
      works,
      releases,
      logs: [
        `mangaone rensaiItems=${items.length}`,
        `mangaone chapterLists=${chapterMap.size}`,
        `mangaone works=${works.length}`,
        `mangaone releases=${releases.length}`
      ]
    };
  }
};

function workUrl(titleId: number) {
  return canonicalizeUrl(`${baseUrl}/manga/${titleId}/chapter/first`);
}

function releaseUrl(titleId: number, firstChapterId?: number) {
  if (!firstChapterId) {
    return workUrl(titleId);
  }
  return canonicalizeUrl(`${baseUrl}/manga/${titleId}/chapter/${firstChapterId}`);
}

function formatUpdatedDay(updatedDay?: MangaOneDay) {
  if (!updatedDay?.year || !updatedDay.month || !updatedDay.day) {
    return undefined;
  }
  const month = String(updatedDay.month).padStart(2, "0");
  const day = String(updatedDay.day).padStart(2, "0");
  return `${updatedDay.year}-${month}-${day}T00:00:00+09:00`;
}

function normalizePublishedDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const match = value.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!match) {
    return undefined;
  }

  return `${match[1]}-${match[2]}-${match[3]}T00:00:00+09:00`;
}

function resolveCurrentChapterId(chapters: MangaOneChapter[], item: MangaOneRensaiItem) {
  const normalizedUpdateInfo = normalizeWhitespace(item.title.updateInfo ?? "");
  const matchedChapter = chapters.find((chapter) => normalizeWhitespace(chapter.chapterName) === normalizedUpdateInfo);
  if (matchedChapter) {
    return matchedChapter.chapterId;
  }

  const partialMatch = chapters.find((chapter) => {
    const chapterName = normalizeWhitespace(chapter.chapterName);
    return Boolean(chapterName) && Boolean(normalizedUpdateInfo) && (chapterName.includes(normalizedUpdateInfo) || normalizedUpdateInfo.includes(chapterName));
  });
  if (partialMatch) {
    return partialMatch.chapterId;
  }

  return item.openChapterId ?? item.title.firstChapterId;
}

function resolveChapterPublishedAt({
  chapterId,
  currentChapterId,
  chapterPublishedDate,
  updatedAt
}: {
  chapterId: number;
  currentChapterId?: number;
  chapterPublishedDate?: string;
  updatedAt?: string;
}) {
  const normalizedChapterDate = normalizePublishedDate(chapterPublishedDate);
  if (chapterId === currentChapterId) {
    return updatedAt ?? normalizedChapterDate;
  }

  if (!normalizedChapterDate || !updatedAt) {
    return normalizedChapterDate;
  }

  return normalizedChapterDate <= updatedAt ? normalizedChapterDate : undefined;
}

async function fetchChapterLists(items: MangaOneRensaiItem[]) {
  const targets = items
    .filter((item) => item.title.titleId > 0)
    .map((item) => ({
      titleId: item.title.titleId,
      chapterId: item.openChapterId ?? item.title.firstChapterId
    }))
    .filter((item): item is { titleId: number; chapterId: number } => {
      const chapterId = item.chapterId;
      return typeof chapterId === "number" && Number.isInteger(chapterId) && chapterId > 0;
    });

  const chapterMap = new Map<number, MangaOneChapter[]>();

  for (let index = 0; index < targets.length; index += chapterListBatchSize) {
    const batch = targets.slice(index, index + chapterListBatchSize);
    const results = await Promise.all(
      batch.map(async (target) => {
        try {
          const bytes = await fetchBytes(viewerChapterListUrl(target.titleId, target.chapterId));
          return [target.titleId, decodeViewerChapterListResponse(bytes)] as const;
        } catch {
          return [target.titleId, [] as MangaOneChapter[]] as const;
        }
      })
    );

    for (const [titleId, chapters] of results) {
      if (chapters.length > 0) {
        chapterMap.set(titleId, chapters);
      }
    }
  }

  return chapterMap;
}

function viewerChapterListUrl(titleId: number, chapterId: number) {
  const params = new URLSearchParams({
    rq: "viewer/chapter_list",
    title_id: String(titleId),
    chapter_id: String(chapterId),
    type: "chapter",
    sort_type: "desc",
    page: "1",
    limit: String(chapterListLimit)
  });

  return `${baseUrl}/api/client?${params.toString()}`;
}

function decodeViewerChapterListResponse(bytes: Uint8Array) {
  const reader = new ProtoReader(bytes);

  while (!reader.eof()) {
    const tag = reader.readVarint();
    const field = tag >>> 3;
    const wireType = tag & 7;

    if (field === 1 && wireType === 2) {
      return decodeViewerChapterList(reader.readDelimitedReader());
    }

    reader.skip(wireType);
  }

  return [];
}

function decodeViewerChapterList(reader: ProtoReader) {
  const chapters: MangaOneChapter[] = [];

  while (!reader.eof()) {
    const tag = reader.readVarint();
    const field = tag >>> 3;
    const wireType = tag & 7;

    if (field === 1 && wireType === 2) {
      chapters.push(decodeViewerChapter(reader.readDelimitedReader()));
      continue;
    }

    reader.skip(wireType);
  }

  return chapters;
}

function decodeViewerChapter(reader: ProtoReader): MangaOneChapter {
  const chapter: MangaOneChapter = {
    chapterId: 0,
    chapterName: "",
    description: ""
  };

  while (!reader.eof()) {
    const tag = reader.readVarint();
    const field = tag >>> 3;
    const wireType = tag & 7;

    switch (field) {
      case 1:
        chapter.chapterId = reader.readVarint();
        break;
      case 2:
        chapter.chapterName = reader.readString();
        break;
      case 3:
        chapter.description = reader.readString();
        break;
      case 4:
        chapter.thumbnailUrl = reader.readString();
        break;
      case 5:
        chapter.publishedDate = reader.readString();
        break;
      case 11:
        chapter.numberOfComments = reader.readVarint();
        break;
      case 19:
        chapter.endOfRentalPeriod = reader.readString();
        break;
      default:
        reader.skip(wireType);
    }
  }

  return chapter;
}

function decodeWebRensaiListResponse(bytes: Uint8Array) {
  const reader = new ProtoReader(bytes);
  const items: MangaOneRensaiItem[] = [];

  while (!reader.eof()) {
    const tag = reader.readVarint();
    const field = tag >>> 3;
    const wireType = tag & 7;

    if (field === 1 && wireType === 2) {
      const child = reader.readDelimitedReader();
      items.push(...decodeDayOfWeekTitleList(child));
      continue;
    }

    reader.skip(wireType);
  }

  return items;
}

function decodeDayOfWeekTitleList(reader: ProtoReader) {
  const items: MangaOneRensaiItem[] = [];

  while (!reader.eof()) {
    const tag = reader.readVarint();
    const field = tag >>> 3;
    const wireType = tag & 7;

    if (field === 3 && wireType === 2) {
      items.push(decodeWebDayOfWeekTitle(reader.readDelimitedReader()));
      continue;
    }

    reader.skip(wireType);
  }

  return items;
}

function decodeWebDayOfWeekTitle(reader: ProtoReader): MangaOneRensaiItem {
  let title: MangaOneTitle | undefined;
  let openChapterId: number | undefined;
  let updatedDay: MangaOneDay | undefined;

  while (!reader.eof()) {
    const tag = reader.readVarint();
    const field = tag >>> 3;
    const wireType = tag & 7;

    if (field === 1 && wireType === 2) {
      const webTitle = decodeWebTitle(reader.readDelimitedReader());
      title = webTitle.title;
      openChapterId = webTitle.openChapterId;
      continue;
    }

    if (field === 2 && wireType === 2) {
      updatedDay = decodeWebDay(reader.readDelimitedReader());
      continue;
    }

    reader.skip(wireType);
  }

  return {
    title:
      title ?? {
        titleId: 0,
        titleName: "",
        description: "",
        authorName: "",
        updateInfo: "",
        latestUpdateDate: "",
        nextUpdateDate: "",
        isCompleted: false
      },
    openChapterId,
    updatedDay
  };
}

function decodeWebTitle(reader: ProtoReader) {
  let title: MangaOneTitle | undefined;
  let openChapterId: number | undefined;

  while (!reader.eof()) {
    const tag = reader.readVarint();
    const field = tag >>> 3;
    const wireType = tag & 7;

    if (field === 1 && wireType === 2) {
      title = decodeTitle(reader.readDelimitedReader());
      continue;
    }

    if (field === 2) {
      openChapterId = reader.readVarint();
      continue;
    }

    reader.skip(wireType);
  }

  return {
    title:
      title ?? {
        titleId: 0,
        titleName: "",
        description: "",
        authorName: "",
        updateInfo: "",
        latestUpdateDate: "",
        nextUpdateDate: "",
        isCompleted: false
      },
    openChapterId
  };
}

function decodeTitle(reader: ProtoReader): MangaOneTitle {
  const title: MangaOneTitle = {
    titleId: 0,
    titleName: "",
    description: "",
    authorName: "",
    updateInfo: "",
    latestUpdateDate: "",
    nextUpdateDate: "",
    isCompleted: false
  };

  while (!reader.eof()) {
    const tag = reader.readVarint();
    const field = tag >>> 3;
    const wireType = tag & 7;

    switch (field) {
      case 1:
        title.titleId = reader.readVarint();
        break;
      case 2:
        title.titleName = reader.readString();
        break;
      case 4:
        title.description = reader.readString();
        break;
      case 5:
        title.authorName = reader.readString();
        break;
      case 18:
        title.updateInfo = reader.readString();
        break;
      case 21:
        title.latestUpdateDate = reader.readString();
        break;
      case 22:
        title.nextUpdateDate = reader.readString();
        break;
      case 24:
        title.isCompleted = reader.readBool();
        break;
      case 27:
        title.firstChapterId = reader.readVarint();
        break;
      default:
        if (wireType === 2) {
          const value = ProtoReader.decodeMaybeString(reader.readDelimitedBytes());
          if (value?.includes("/title_vertical_thumb/")) {
            title.titleVerticalThumbUrl = value;
            break;
          }
          if (value?.includes("/title_list_single/")) {
            title.titleListSingleUrl = value;
            break;
          }
          break;
        }
        reader.skip(wireType);
    }
  }

  return title;
}

function decodeWebDay(reader: ProtoReader): MangaOneDay {
  const day: MangaOneDay = {};

  while (!reader.eof()) {
    const tag = reader.readVarint();
    const field = tag >>> 3;
    const wireType = tag & 7;

    switch (field) {
      case 1:
        day.year = reader.readVarint();
        break;
      case 2:
        day.month = reader.readVarint();
        break;
      case 3:
        day.day = reader.readVarint();
        break;
      default:
        reader.skip(wireType);
    }
  }

  return day;
}

class ProtoReader {
  private readonly bytes: Uint8Array;
  private offset = 0;
  private static readonly textDecoder = new TextDecoder();

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  eof() {
    return this.offset >= this.bytes.length;
  }

  readVarint() {
    let result = 0;
    let shift = 0;

    while (this.offset < this.bytes.length) {
      const byte = this.bytes[this.offset++];
      result += (byte & 0x7f) * 2 ** shift;
      if ((byte & 0x80) === 0) {
        return result;
      }
      shift += 7;
    }

    throw new Error("Unexpected end of protobuf varint");
  }

  readBool() {
    return this.readVarint() !== 0;
  }

  readString() {
    const length = this.readVarint();
    const start = this.offset;
    const end = start + length;
    if (end > this.bytes.length) {
      throw new Error("Unexpected end of protobuf string");
    }
    this.offset = end;
    return ProtoReader.textDecoder.decode(this.bytes.subarray(start, end));
  }

  readDelimitedReader() {
    return new ProtoReader(this.readDelimitedBytes());
  }

  readDelimitedBytes() {
    const length = this.readVarint();
    const start = this.offset;
    const end = start + length;
    if (end > this.bytes.length) {
      throw new Error("Unexpected end of protobuf message");
    }
    this.offset = end;
    return this.bytes.subarray(start, end);
  }

  static decodeMaybeString(bytes: Uint8Array) {
    try {
      return ProtoReader.textDecoder.decode(bytes);
    } catch {
      return null;
    }
  }

  skip(wireType: number) {
    switch (wireType) {
      case 0:
        this.readVarint();
        return;
      case 1:
        this.offset += 8;
        return;
      case 2: {
        const length = this.readVarint();
        this.offset += length;
        if (this.offset > this.bytes.length) {
          throw new Error("Unexpected end of protobuf bytes");
        }
        return;
      }
      case 5:
        this.offset += 4;
        return;
      default:
        throw new Error(`Unsupported protobuf wire type: ${wireType}`);
    }
  }
}
