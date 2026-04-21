import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { defaultVisibilityByKind, siteDisplayOrder, type DefaultVisibility, type SemanticKind } from "@/lib/domain";

export type AppSettings = {
  timezone: string;
  dayBoundaryHour: number;
  discoverWindowDays: number;
  semanticDefaults: Record<SemanticKind, DefaultVisibility>;
  tileDensity: "denser" | "compact" | "roomy";
  tileAspect: "wide" | "poster" | "square";
  imagePolicy: "strict_metadata" | "preview_safe" | "private_rich";
  siteOrder: string[];
};

function normalizeSiteOrder(siteOrder?: string[] | null) {
  const seen = new Set<string>();
  const ordered = [...(siteOrder ?? []), ...siteDisplayOrder].filter((siteId) => {
    if (seen.has(siteId)) {
      return false;
    }
    seen.add(siteId);
    return true;
  });
  return ordered;
}

export function getDefaultSettings(): AppSettings {
  return {
    timezone: env.APP_TIMEZONE,
    dayBoundaryHour: env.DAY_BOUNDARY_HOUR,
    discoverWindowDays: 7,
    tileDensity: "compact",
    tileAspect: "wide",
    imagePolicy: "preview_safe",
    siteOrder: normalizeSiteOrder(null),
    semanticDefaults: {
      ...defaultVisibilityByKind
    }
  };
}

export async function getSettings(userId?: string | null): Promise<AppSettings> {
  const defaults = getDefaultSettings();
  if (!userId) {
    return defaults;
  }

  const rows = await prisma.userSetting.findMany({
    where: { userId }
  });
  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  return {
    timezone: map.timezone ?? defaults.timezone,
    dayBoundaryHour: Number(map.dayBoundaryHour ?? defaults.dayBoundaryHour),
    discoverWindowDays: Number(map.discoverWindowDays ?? defaults.discoverWindowDays),
    tileDensity: (map.tileDensity as AppSettings["tileDensity"]) ?? defaults.tileDensity,
    tileAspect: (map.tileAspect as AppSettings["tileAspect"]) ?? defaults.tileAspect,
    imagePolicy: (map.imagePolicy as AppSettings["imagePolicy"]) ?? defaults.imagePolicy,
    siteOrder: normalizeSiteOrder(map.siteOrder ? (JSON.parse(map.siteOrder) as string[]) : defaults.siteOrder),
    semanticDefaults: {
      ...defaults.semanticDefaults,
      ...(map.semanticDefaults ? (JSON.parse(map.semanticDefaults) as Record<SemanticKind, DefaultVisibility>) : {})
    }
  };
}

export async function updateSettings(userId: string, partial: Partial<AppSettings>) {
  const current = await getSettings(userId);
  const next = {
    ...current,
    ...partial,
    semanticDefaults: {
      ...current.semanticDefaults,
      ...(partial.semanticDefaults ?? {})
    },
    siteOrder: normalizeSiteOrder(partial.siteOrder ?? current.siteOrder)
  };

  const entries = [
    ["timezone", next.timezone],
    ["dayBoundaryHour", String(next.dayBoundaryHour)],
    ["discoverWindowDays", String(next.discoverWindowDays)],
    ["semanticDefaults", JSON.stringify(next.semanticDefaults)],
    ["tileDensity", next.tileDensity],
    ["tileAspect", next.tileAspect],
    ["imagePolicy", next.imagePolicy],
    ["siteOrder", JSON.stringify(next.siteOrder)]
  ] as const;

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.userSetting.upsert({
        where: {
          userId_key: {
            userId,
            key
          }
        },
        update: { value },
        create: {
          userId,
          key,
          value
        }
      })
    )
  );

  return next;
}
