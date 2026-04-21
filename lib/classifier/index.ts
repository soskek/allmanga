import { defaultVisibilityByKind, type DefaultVisibility, type SemanticKind } from "@/lib/domain";
import type { ClassificationInput } from "@/lib/types";
import { normalizeWhitespace, titleLooksLikeEpisode } from "@/lib/utils";

const rules = {
  illustration: ["イラスト", "おまけイラスト"],
  promotion: ["PR", "宣伝", "新刊", "発売記念", "コミックス", "単行本", "書店特典", "グッズ", "キャンペーン", "コラボ", "PV", "特報"],
  announcement: ["お知らせ", "編集部", "インタビュー", "特集", "連載再開", "移籍"],
  sideStory: ["番外編", "特別編", "第0話", "エピソード0", "出張版", "出張特別読切", "外伝", "増刊"],
  oneshot: ["読切", "特別読切", "特別読み切り", "読み切り版", "読み切り掲載", "オリジナル読切", "本誌読切", "8P読切"]
};

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function resolveDefaultVisibility(
  semanticKind: SemanticKind,
  workDisplayOverride?: Partial<Record<SemanticKind, DefaultVisibility>>
) {
  return workDisplayOverride?.[semanticKind] ?? defaultVisibilityByKind[semanticKind];
}

export function classifyRelease(input: ClassificationInput) {
  if (input.manualOverrideKind) {
    return {
      semanticKind: input.manualOverrideKind,
      semanticConfidence: 1,
      semanticSignals: [`manual:${input.manualOverrideKind}`],
      defaultVisibility: resolveDefaultVisibility(input.manualOverrideKind, input.workDisplayOverride)
    };
  }

  const title = normalizeWhitespace(input.release.rawTitle ?? input.release.title);
  const badge = normalizeWhitespace(input.release.rawBadgeText);
  const signals: string[] = [];

  if (badge === "イラスト") {
    const semanticKind: SemanticKind = "illustration";
    signals.push("badge:イラスト");
    return {
      semanticKind,
      semanticConfidence: 1,
      semanticSignals: signals,
      defaultVisibility: resolveDefaultVisibility(semanticKind, input.workDisplayOverride)
    };
  }

  const isOneshotPreferred =
    input.work?.kind === "oneshot" ||
    input.release.sourceType === "oneshot_list" ||
    input.release.sourceType === "category_list";

  if (title.includes("休載イラスト") || (title.includes("休載") && title.includes("イラスト"))) {
    const semanticKind: SemanticKind = "hiatus_illustration";
    signals.push("title:休載イラスト");
    return {
      semanticKind,
      semanticConfidence: 0.98,
      semanticSignals: signals,
      defaultVisibility: resolveDefaultVisibility(semanticKind, input.workDisplayOverride)
    };
  }

  if (
    input.release.sourceType === "news" ||
    input.release.contentKind === "article" ||
    includesAny(title, rules.announcement)
  ) {
    signals.push(
      input.release.sourceType === "news" ? "sourceType:news" : "",
      input.release.contentKind === "article" ? "contentKind:article" : ""
    );
    if (includesAny(title, rules.announcement)) {
      signals.push(`title:${rules.announcement.find((keyword) => title.includes(keyword))}`);
    }
    const semanticKind: SemanticKind = "announcement";
    return {
      semanticKind,
      semanticConfidence: 0.92,
      semanticSignals: signals.filter(Boolean),
      defaultVisibility: resolveDefaultVisibility(semanticKind, input.workDisplayOverride)
    };
  }

  if (isOneshotPreferred && includesAny(title, rules.oneshot)) {
    const semanticKind: SemanticKind = "oneshot_discovery";
    signals.push(`title:${rules.oneshot.find((keyword) => title.includes(keyword))}`);
    return {
      semanticKind,
      semanticConfidence: 0.95,
      semanticSignals: signals,
      defaultVisibility: resolveDefaultVisibility(semanticKind, input.workDisplayOverride)
    };
  }

  if (isOneshotPreferred) {
    const semanticKind: SemanticKind = "oneshot_discovery";
    signals.push(
      input.work?.kind === "oneshot" ? "work.kind:oneshot" : "",
      input.release.sourceType === "oneshot_list" ? "sourceType:oneshot_list" : "",
      input.release.sourceType === "category_list" ? "sourceType:category_list" : ""
    );
    return {
      semanticKind,
      semanticConfidence: 0.9,
      semanticSignals: signals.filter(Boolean),
      defaultVisibility: resolveDefaultVisibility(semanticKind, input.workDisplayOverride)
    };
  }

  if (includesAny(title, rules.illustration) || badge.includes("イラスト")) {
    const semanticKind: SemanticKind = "illustration";
    signals.push(
      badge.includes("イラスト") ? `badge:${badge}` : "",
      includesAny(title, rules.illustration)
        ? `title:${rules.illustration.find((keyword) => title.includes(keyword))}`
        : ""
    );
    return {
      semanticKind,
      semanticConfidence: 0.95,
      semanticSignals: signals.filter(Boolean),
      defaultVisibility: resolveDefaultVisibility(semanticKind, input.workDisplayOverride)
    };
  }

  if (includesAny(title, rules.promotion)) {
    const semanticKind: SemanticKind = "promotion";
    signals.push(`title:${rules.promotion.find((keyword) => title.includes(keyword))}`);
    return {
      semanticKind,
      semanticConfidence: 0.95,
      semanticSignals: signals,
      defaultVisibility: resolveDefaultVisibility(semanticKind, input.workDisplayOverride)
    };
  }

  if (includesAny(title, rules.sideStory)) {
    const semanticKind: SemanticKind = "side_story";
    signals.push(`title:${rules.sideStory.find((keyword) => title.includes(keyword))}`);
    return {
      semanticKind,
      semanticConfidence: 0.9,
      semanticSignals: signals,
      defaultVisibility: resolveDefaultVisibility(semanticKind, input.workDisplayOverride)
    };
  }

  if (includesAny(title, rules.oneshot)) {
    const semanticKind: SemanticKind = "oneshot_discovery";
    signals.push(`title:${rules.oneshot.find((keyword) => title.includes(keyword))}`);
    return {
      semanticKind,
      semanticConfidence: 0.85,
      semanticSignals: signals,
      defaultVisibility: resolveDefaultVisibility(semanticKind, input.workDisplayOverride)
    };
  }

  if (input.release.contentKind === "episode" && titleLooksLikeEpisode(title)) {
    const semanticKind: SemanticKind = "main_episode";
    signals.push("contentKind:episode", "title:episode-pattern");
    return {
      semanticKind,
      semanticConfidence: 0.88,
      semanticSignals: signals,
      defaultVisibility: resolveDefaultVisibility(semanticKind, input.workDisplayOverride)
    };
  }

  if (input.release.contentKind === "episode") {
    const semanticKind: SemanticKind = "main_episode";
    signals.push("contentKind:episode");
    return {
      semanticKind,
      semanticConfidence: 0.7,
      semanticSignals: signals,
      defaultVisibility: resolveDefaultVisibility(semanticKind, input.workDisplayOverride)
    };
  }

  const semanticKind: SemanticKind = "unknown";
  return {
    semanticKind,
    semanticConfidence: 0.4,
    semanticSignals: title ? ["fallback:title-unmatched"] : ["fallback:unknown"],
    defaultVisibility: resolveDefaultVisibility(semanticKind, input.workDisplayOverride)
  };
}
