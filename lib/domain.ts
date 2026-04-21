export const BOOTSTRAP_OWNER_USER_ID = "default";

export const semanticKinds = [
  "main_episode",
  "side_story",
  "illustration",
  "hiatus_illustration",
  "promotion",
  "announcement",
  "oneshot_discovery",
  "unknown"
] as const;

export const visibilityLanes = ["stack", "collapsed", "hidden"] as const;
export const releaseStates = ["unread", "opened", "read", "snoozed"] as const;
export const userLanes = ["today", "stack", "weekend", "archived"] as const;
export const catchupModes = ["all", "latest_only"] as const;

export type SemanticKind = (typeof semanticKinds)[number];
export type DefaultVisibility = (typeof visibilityLanes)[number];
export type ReleaseState = (typeof releaseStates)[number];
export type UserLane = (typeof userLanes)[number];
export type CatchupMode = (typeof catchupModes)[number];

export type ViewMode = "private" | "public";

export const defaultVisibilityByKind: Record<SemanticKind, DefaultVisibility> = {
  main_episode: "stack",
  side_story: "collapsed",
  illustration: "collapsed",
  hiatus_illustration: "collapsed",
  promotion: "hidden",
  announcement: "hidden",
  oneshot_discovery: "collapsed",
  unknown: "collapsed"
};

export const semanticLabels: Record<SemanticKind, string> = {
  main_episode: "本編",
  side_story: "番外編",
  illustration: "イラスト",
  hiatus_illustration: "休載イラスト",
  promotion: "PR",
  announcement: "告知",
  oneshot_discovery: "読切",
  unknown: "不明"
};

export const siteLabels: Record<string, string> = {
  jumpplus: "少年ジャンプ＋",
  tonarinoyj: "となりのヤングジャンプ",
  comicdays: "コミックDAYS",
  sundaywebry: "サンデーうぇぶり",
  magapoke: "マガポケ",
  ynjn: "ヤンジャン＋",
  mangaone: "マンガワン",
  yanmaga: "ヤンマガWeb",
  younganimal: "ヤングアニマルWeb",
  comicwalker: "ComicWalker / カドコミ"
};

export const siteDisplayOrder = [
  "jumpplus",
  "tonarinoyj",
  "comicdays",
  "sundaywebry",
  "magapoke",
  "ynjn",
  "comicwalker",
  "younganimal",
  "mangaone",
  "yanmaga"
] as const;

export const siteShortLabels: Record<string, string> = {
  jumpplus: "ジャンプ＋",
  tonarinoyj: "となYJ",
  comicdays: "DAYS",
  sundaywebry: "うぇぶり",
  magapoke: "マガポケ",
  ynjn: "ヤンジャン＋",
  mangaone: "マンガワン",
  yanmaga: "ヤンマガ",
  younganimal: "ヤングA",
  comicwalker: "カドコミ"
};

export const siteMarks: Record<string, string> = {
  jumpplus: "J+",
  tonarinoyj: "TYJ",
  comicdays: "D",
  sundaywebry: "SW",
  magapoke: "MP",
  ynjn: "YJ+",
  mangaone: "1",
  yanmaga: "YM",
  younganimal: "YA",
  comicwalker: "CW"
};

export const siteAccentClasses: Record<string, string> = {
  jumpplus: "bg-red-600",
  tonarinoyj: "bg-lime-500",
  comicdays: "bg-orange-600",
  sundaywebry: "bg-orange-500",
  magapoke: "bg-blue-600",
  ynjn: "bg-cyan-500",
  mangaone: "bg-pink-300",
  yanmaga: "bg-cyan-700",
  younganimal: "bg-amber-500",
  comicwalker: "bg-slate-600",
  kadokomi: "bg-zinc-950"
};

export const siteAccentColors: Record<string, string> = {
  jumpplus: "#dc2626",
  tonarinoyj: "#84cc16",
  comicdays: "#ea580c",
  sundaywebry: "#f97316",
  magapoke: "#2563eb",
  ynjn: "#06b6d4",
  mangaone: "#f9a8d4",
  yanmaga: "#0e7490",
  younganimal: "#f59e0b",
  comicwalker: "#4b5563",
  kadokomi: "#111827"
};

export const siteTextColorClasses: Record<string, string> = {
  jumpplus: "text-red-700",
  tonarinoyj: "text-lime-700",
  comicdays: "text-orange-700",
  sundaywebry: "text-orange-700",
  magapoke: "text-blue-700",
  ynjn: "text-cyan-700",
  mangaone: "text-pink-500",
  yanmaga: "text-cyan-800",
  younganimal: "text-amber-700",
  comicwalker: "text-slate-700",
  kadokomi: "text-zinc-950"
};

export const siteIconUrls: Record<string, string> = {
  jumpplus: "https://shonenjumpplus.com/apple-touch-icon.png",
  tonarinoyj: "https://cdn.tonarinoyj.jp/images/apple-touch-icon-180.png?1776244636",
  comicdays: "https://comic-days.com/_next/static/images/favicon.4385e7f9.ico",
  sundaywebry: "https://cdn.www.sunday-webry.com/images/apple-touch-icon-180.png?1776244636",
  magapoke: "https://pocket.shonenmagazine.com/favicon.ico",
  ynjn: "https://public.ynjn.jp/web/img/common/favicon.ico",
  mangaone: "https://app.manga-one.com/favicon.ico",
  yanmaga: "https://yanmaga.jp/favicon.ico",
  younganimal: "https://cdn-public.comici.jp/content/default/favicon/20230224104233322F50C73D00FDA2BD6D78CE4082E70F008.png",
  comicwalker: "https://comic-walker.com/favicons/favicon.ico"
};
