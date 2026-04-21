import { env } from "@/lib/env";

type TriggerResult = {
  jobName: string;
  ok: boolean;
  status: number;
  error?: string;
};

export function canTriggerCloudRunJobs() {
  return Boolean(env.GCP_PROJECT_ID && env.CLOUD_RUN_REGION);
}

export async function triggerSyncJobs(siteIds: string[]): Promise<TriggerResult[]> {
  if (!env.GCP_PROJECT_ID || !env.CLOUD_RUN_REGION) {
    throw new Error("GCP_PROJECT_ID and CLOUD_RUN_REGION are required to trigger Cloud Run Jobs");
  }

  const token = await fetchMetadataAccessToken();
  const uniqueSiteIds = [...new Set(siteIds)];

  return Promise.all(
    uniqueSiteIds.map(async (siteId) => {
      const jobName = `${env.SYNC_JOB_PREFIX}-${siteId}`;
      const url = `https://run.googleapis.com/v2/projects/${env.GCP_PROJECT_ID}/locations/${env.CLOUD_RUN_REGION}/jobs/${jobName}:run`;
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
          },
          body: "{}"
        });
        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          return {
            jobName,
            ok: false,
            status: response.status,
            error: errorText.slice(0, 500)
          };
        }
        return {
          jobName,
          ok: true,
          status: response.status
        };
      } catch (error) {
        return {
          jobName,
          ok: false,
          status: 0,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    })
  );
}

async function fetchMetadataAccessToken() {
  const response = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    {
      headers: {
        "Metadata-Flavor": "Google"
      },
      cache: "no-store"
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch metadata token: ${response.status}`);
  }
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Metadata token response did not include access_token");
  }
  return payload.access_token;
}
