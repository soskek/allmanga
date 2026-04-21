import { defaultSites } from "../lib/sources/registry";
import { runAllEnabledSyncs, runSiteSync } from "../lib/sync";

function readSiteId() {
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--siteId" || arg === "--site") {
      return args[index + 1] ?? null;
    }
    if (arg.startsWith("--siteId=")) {
      return arg.slice("--siteId=".length);
    }
    if (arg.startsWith("--site=")) {
      return arg.slice("--site=".length);
    }
  }
  return null;
}

async function main() {
  const siteId = readSiteId();
  if (siteId) {
    if (!defaultSites.some((site) => site.id === siteId)) {
      throw new Error(`Unknown siteId: ${siteId}`);
    }
    const result = await runSiteSync(siteId);
    console.log(JSON.stringify({ mode: "site", siteId, result }, null, 2));
    return;
  }

  const result = await runAllEnabledSyncs();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
