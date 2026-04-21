import type { NormalizedRelease, NormalizedWork } from "@/lib/types";

export const fixtureWork: NormalizedWork = {
  siteId: "jumpplus",
  canonicalUrl: "https://shonenjumpplus.com/series/test-work",
  title: "テスト作品",
  authors: ["作者A"],
  kind: "serial",
  status: "active"
};

export const fixtureReleases: Record<string, NormalizedRelease> = {
  main: {
    siteId: "jumpplus",
    canonicalUrl: "https://shonenjumpplus.com/episode/1",
    workCanonicalUrl: fixtureWork.canonicalUrl,
    title: "第1話",
    rawTitle: "第1話",
    sourceType: "work_page",
    contentKind: "episode"
  },
  badgeIllustration: {
    siteId: "jumpplus",
    canonicalUrl: "https://shonenjumpplus.com/episode/illust",
    workCanonicalUrl: fixtureWork.canonicalUrl,
    title: "更新",
    rawTitle: "更新",
    rawBadgeText: "イラスト",
    sourceType: "series_list",
    contentKind: "episode"
  },
  hiatusIllustration: {
    siteId: "jumpplus",
    canonicalUrl: "https://shonenjumpplus.com/episode/hiatus",
    workCanonicalUrl: fixtureWork.canonicalUrl,
    title: "休載イラスト",
    rawTitle: "休載イラスト",
    sourceType: "series_list",
    contentKind: "episode"
  },
  prSideStory: {
    siteId: "jumpplus",
    canonicalUrl: "https://shonenjumpplus.com/episode/pr-side",
    workCanonicalUrl: fixtureWork.canonicalUrl,
    title: "PR番外編",
    rawTitle: "PR番外編",
    sourceType: "series_list",
    contentKind: "episode"
  },
  news: {
    siteId: "jumpplus",
    canonicalUrl: "https://shonenjumpplus.com/article/news",
    workCanonicalUrl: fixtureWork.canonicalUrl,
    title: "お知らせ",
    rawTitle: "お知らせ",
    sourceType: "news",
    contentKind: "article"
  },
  sideStory: {
    siteId: "jumpplus",
    canonicalUrl: "https://shonenjumpplus.com/episode/side",
    workCanonicalUrl: fixtureWork.canonicalUrl,
    title: "特別編",
    rawTitle: "特別編",
    sourceType: "work_page",
    contentKind: "episode"
  },
  oneshot1: {
    siteId: "sundaywebry",
    canonicalUrl: "https://www.sunday-webry.com/episode/read-1",
    workCanonicalUrl: "https://www.sunday-webry.com/series/read-1",
    title: "特別読切",
    rawTitle: "特別読切",
    sourceType: "oneshot_list",
    contentKind: "work"
  },
  oneshot2: {
    siteId: "magapoke",
    canonicalUrl: "https://pocket.shonenmagazine.com/episode/read-2",
    workCanonicalUrl: "https://pocket.shonenmagazine.com/series/read-2",
    title: "特別読み切り",
    rawTitle: "特別読み切り",
    sourceType: "category_list",
    contentKind: "work"
  },
  gravure: {
    siteId: "ynjn",
    canonicalUrl: "https://ynjn.jp/gravure/123",
    title: "グラビア",
    rawTitle: "グラビア",
    sourceType: "label_list",
    contentKind: "work"
  }
};
