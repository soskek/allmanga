import type { SourceAdapter } from "@/lib/types";
import type { SiteDescriptor } from "@/lib/sources/types";
import { comicdaysAdapter } from "@/lib/sources/comicdays";
import { comicwalkerAdapter } from "@/lib/sources/comicwalker";
import { jumpplusAdapter } from "@/lib/sources/jumpplus";
import { magapokeAdapter } from "@/lib/sources/magapoke";
import { mangaoneAdapter } from "@/lib/sources/mangaone";
import { sundaywebryAdapter } from "@/lib/sources/sundaywebry";
import { tonarinoyjAdapter } from "@/lib/sources/tonarinoyj";
import { yanmagaAdapter } from "@/lib/sources/yanmaga";
import { ynjnAdapter } from "@/lib/sources/ynjn";
import { younganimalAdapter } from "@/lib/sources/younganimal";

export const defaultSites: SiteDescriptor[] = [
  { id: "jumpplus", name: "少年ジャンプ＋", baseUrl: "https://shonenjumpplus.com", syncStrategy: "mixed" },
  { id: "tonarinoyj", name: "となりのヤングジャンプ", baseUrl: "https://tonarinoyj.jp", syncStrategy: "mixed" },
  { id: "comicdays", name: "コミックDAYS", baseUrl: "https://comic-days.com", syncStrategy: "mixed" },
  { id: "sundaywebry", name: "サンデーうぇぶり", baseUrl: "https://www.sunday-webry.com", syncStrategy: "mixed" },
  { id: "magapoke", name: "マガポケ", baseUrl: "https://pocket.shonenmagazine.com", syncStrategy: "mixed" },
  { id: "ynjn", name: "ヤンジャン＋", baseUrl: "https://ynjn.jp", syncStrategy: "mixed" },
  { id: "comicwalker", name: "ComicWalker / カドコミ", baseUrl: "https://comic-walker.com", syncStrategy: "list" },
  { id: "younganimal", name: "ヤングアニマルWeb", baseUrl: "https://younganimal.com", syncStrategy: "list" },
  { id: "mangaone", name: "マンガワン", baseUrl: "https://manga-one.com", syncStrategy: "list" },
  { id: "yanmaga", name: "ヤンマガWeb", baseUrl: "https://yanmaga.jp", syncStrategy: "list" }
];

export const sourceAdapters: SourceAdapter[] = [
  jumpplusAdapter,
  tonarinoyjAdapter,
  comicdaysAdapter,
  sundaywebryAdapter,
  magapokeAdapter,
  ynjnAdapter,
  comicwalkerAdapter,
  younganimalAdapter,
  mangaoneAdapter,
  yanmagaAdapter
];

export const adapterMap = Object.fromEntries(sourceAdapters.map((adapter) => [adapter.siteId, adapter]));
