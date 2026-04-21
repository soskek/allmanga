import { env } from "@/lib/env";

const defaultHeaders = {
  "user-agent": "AllMangaInbox/0.1 (+self-hosted; metadata-only)"
};

export async function fetchText(url: string) {
  const response = await fetchWithRetry(url, {
    headers: defaultHeaders
  });
  return response.text();
}

export async function fetchJson<T>(url: string) {
  const response = await fetchWithRetry(url, {
    headers: {
      ...defaultHeaders,
      accept: "application/json,text/plain;q=0.9,*/*;q=0.8"
    }
  });
  return (await response.json()) as T;
}

export async function fetchBytes(url: string) {
  const response = await fetchWithRetry(url, {
    headers: {
      ...defaultHeaders,
      accept: "application/octet-stream,application/x-protobuf,*/*;q=0.8"
    }
  });
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 2) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.SOURCE_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        next: {
          revalidate: 0
        }
      });

      if (response.ok) {
        return response;
      }

      if (attempt === retries || !shouldRetryStatus(response.status)) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
      }
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }

    await sleep(250 * (attempt + 1));
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

function shouldRetryStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
