import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AllManga Inbox",
    short_name: "AllManga",
    description: "Self-hosted manga update inbox",
    start_url: "/",
    display: "standalone",
    background_color: "#f4efe8",
    theme_color: "#f4efe8",
    lang: "ja",
    icons: []
  };
}
