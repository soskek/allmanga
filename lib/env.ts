import { z } from "zod";

const envSchema = z.object({
  APP_PASSWORD_HASH: z.string().optional(),
  APP_DEV_PASSWORD: z.string().optional(),
  DATABASE_URL: z.string().default("postgresql://allmanga:allmanga@127.0.0.1:5432/allmanga"),
  SESSION_SECRET: z.string().default("dev-secret-change-me"),
  APP_TIMEZONE: z.string().default("Asia/Tokyo"),
  DAY_BOUNDARY_HOUR: z.coerce.number().int().min(0).max(23).default(4),
  CRON_SCHEDULE: z.string().default("*/30 * * * *"),
  EMBEDDED_CRON_ENABLED: z.coerce.boolean().default(false),
  INTERNAL_SYNC_TOKEN: z.string().optional(),
  BASE_URL: z.string().default("http://localhost:3000"),
  APP_OWNER_EMAIL: z.string().email().default("owner@allmanga.local"),
  APP_OWNER_NAME: z.string().default("Owner"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_AUTH_ALLOWED_EMAILS: z.string().optional(),
  GOOGLE_AUTH_ALLOWED_DOMAINS: z.string().optional(),
  PASSWORD_LOGIN_ENABLED: z.coerce.boolean().default(true),
  GCP_PROJECT_ID: z.string().optional(),
  CLOUD_RUN_REGION: z.string().optional(),
  SYNC_JOB_PREFIX: z.string().default("allmanga-sync"),
  SOURCE_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  PREVIEW_BACKFILL_LIMIT: z.coerce.number().int().min(0).default(16),
  PREVIEW_BACKFILL_CONCURRENCY: z.coerce.number().int().min(1).default(4),
  PREVIEW_BACKFILL_COOLDOWN_HOURS: z.coerce.number().int().min(1).default(24),
  YNJN_THUMBNAIL_SYNC_LIMIT: z.coerce.number().int().min(0).default(120),
  YNJN_EPISODE_SYNC_LIMIT: z.coerce.number().int().min(0).default(40),
  YNJN_EPISODES_PER_TITLE_LIMIT: z.coerce.number().int().min(1).default(3)
});

export const env = envSchema.parse(process.env);
