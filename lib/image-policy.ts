import type { AppSettings } from "@/lib/settings";

export function resolvePrivateImageMode(settings: Pick<AppSettings, "imagePolicy">) {
  return {
    hideAllImages: settings.imagePolicy === "strict_metadata",
    preferPreviewSingle: settings.imagePolicy === "preview_safe",
    allowSecondary: settings.imagePolicy === "private_rich"
  };
}
