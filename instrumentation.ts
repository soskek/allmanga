import { env } from "@/lib/env";
import { runAllEnabledSyncs } from "@/lib/sync";

let started = false;

export async function register() {
  const isBuildProcess = process.argv.includes("build");
  if (
    started ||
    typeof window !== "undefined" ||
    process.env.NODE_ENV !== "production" ||
    isBuildProcess ||
    !env.EMBEDDED_CRON_ENABLED
  ) {
    return;
  }
  started = true;
  const importFn = new Function("specifier", "return import(specifier)") as (
    specifier: string
  ) => Promise<{ default: { schedule: typeof import("node-cron")["default"]["schedule"] } }>;
  const { default: cron } = await importFn(["node", "cron"].join("-"));
  cron.schedule(env.CRON_SCHEDULE, async () => {
    try {
      await runAllEnabledSyncs();
    } catch (error) {
      console.error("cron sync failed", error);
    }
  });
}
