# Cost and Public Release Notes

AllManga can be run in several cost profiles. For a casual public demo, do not keep managed Cloud SQL running unless the private multi-user dashboard is actually needed.

## Cost Profiles

## Recommended Hosting Profiles

| Profile | Hosting | DB | Sync | Cost shape | When to use |
| --- | --- | --- | --- | --- | --- |
| `static-public-free` | Cloudflare Pages / GitHub Pages | none | manual or GitHub Actions | closest to free | Public metadata-only demo |
| `dynamic-free-ish` | Vercel Hobby or Cloud Run | Neon Free | manual / rare | free until provider limits | Login/follow features with tiny usage |
| `dynamic-managed` | Cloud Run | Cloud SQL | Cloud Scheduler + Jobs | paid, operationally simple | More serious always-on operation |
| `self-hosted` | home mini PC / VPS | local Postgres | cron | hardware/VPS cost | Personal use, full control |

Current best direction for this project:

1. Make a `static-public-free` export for people who just want to browse metadata.
2. Keep the private dashboard dynamic but move DB from Cloud SQL to Neon Free or another free Postgres while usage is tiny.
3. Keep GCP managed mode as a switchable production profile, not the default hobby/demo profile.

### 0. Manual / Almost-off

Best while experimenting.

- Cloud Scheduler: paused.
- Cloud Run service: no min instances, so it scales to zero.
- Cloud SQL: stop or delete it if the app does not need to be live.
- Sync: run manually when needed.

Commands:

```bash
export PROJECT_ID="your-project-id"
export REGION="asia-northeast1"

./scripts/pause-sync-schedulers.sh
./scripts/pause-legacy-scheduler.sh
```

If you are comfortable recreating schedulers later, delete them instead. Cloud Scheduler charges per job, and paused jobs still count.

```bash
./scripts/delete-sync-schedulers.sh
./scripts/delete-legacy-scheduler.sh
```

If you can accept the live app being broken while idle, stop Cloud SQL too:

```bash
./scripts/stop-cloud-sql.sh
```

Start it again before using the dynamic app:

```bash
./scripts/start-cloud-sql.sh
```

Stopping Cloud SQL should reduce compute charges, but storage and some attached resources can still cost money. Deleting Cloud SQL is the only way to remove that managed database cost entirely; export or dump data first if needed.

Manual sync:

```bash
./scripts/run-sync-jobs-once.sh
```

### 1. Public demo, near-free

Good target if the goal is "people can casually view a public page".

- Host a metadata-only static snapshot on GitHub Pages, Cloudflare Pages, or another static host.
- Keep private dashboard local or disabled.
- Run sync manually from a local machine or GitHub Actions, then publish static JSON/HTML.
- No Cloud SQL required.

This is the closest to free. It requires adding a static snapshot exporter for `/public` data.

Implemented static flow:

- `npm run export:public-static` writes `public-out/index.html`, `recent.json`, `discover.json`, and `site.webmanifest`.
- `.github/workflows/free-public-pages.yml` creates a temporary PostgreSQL service, runs migrations, syncs metadata once, exports the public-safe static page, and deploys it to GitHub Pages.
- The workflow runs once per day around 05:10 JST and can also be started manually from GitHub Actions.
- The static page includes per-browser follow/unfollow using `localStorage`, plus a `フォロー中` section and compact density toggle. This is intentionally not a server account feature: it costs nothing and keeps private state off the public host, but it does not sync across devices.
- The static page remains metadata-only. It does not include thumbnails, manga images, descriptions, read state, private follow state, or priorities.

Detailed setup: [free-public-pages.md](free-public-pages.md)

Local static export:

```bash
npm run sync:once
npm run export:public-static
```

The generated directory is ignored by git:

```text
public-out/
```

Cloudflare Pages is a good fit for this profile: its Free plan includes 500 builds/month and up to 20,000 files per site. GitHub Pages is also viable if the output is just static files.

For a public hobby repository, daily sync is realistic. Ten source adapters once per day is modest for GitHub Actions and much gentler on upstream manga sites than frequent polling. If you start caring about "same morning" freshness, use twice daily. If many users depend on it, move sync to a dynamic worker and add proper monitoring/rate limiting.

GitHub-specific notes:

- GitHub Actions standard GitHub-hosted runners are free for public repositories.
- GitHub Pages is available for public repositories on GitHub Free.
- GitHub Pages has soft/usage limits, including a 1 GB published site size limit and soft bandwidth limits. This app's metadata-only static output should stay far below that unless the export grows dramatically.

### 2. Dynamic app, low-cost

Useful when login, follow state, and dynamic search must be live.

- Cloud Run service with min instances = 0.
- PostgreSQL on a free/low-cost external provider such as Neon or Supabase.
- Cloud Scheduler paused or 12-hour cadence.
- Cloud Run Jobs only for occasional sync.

This avoids Cloud SQL fixed instance cost while keeping the app dynamic.

This is probably the best long-term path if the app should stay interactive but remain cheap.

Neon is a strong fit here because its Free plan is $0, has no credit card requirement, includes 0.5 GB storage per project, and scales to zero after inactivity. Supabase can also work, but Neon maps especially cleanly to the current Prisma/PostgreSQL setup.

### 3. Current managed-GCP shape

Convenient but not free.

- Cloud Run service is small when idle.
- Cloud Run Jobs cost grows with sync frequency.
- Cloud Scheduler is cheap, but paused jobs are still counted as jobs.
- Cloud SQL is the main fixed cost.

Use this only if managed PostgreSQL on GCP is worth the cost.

## What Actually Costs Money

- Cloud SQL dedicated instance: main cost driver.
- Cloud SQL storage: still matters if an instance is stopped.
- Cloud Run service: usually small if min instances is 0.
- Cloud Run Jobs: proportional to sync frequency and runtime.
- Cloud Scheduler: small, but each job counts even when paused.
- Artifact Registry: small for this project size; still clean old images if needed.

Official references:

- Google Cloud Free Tier: https://cloud.google.com/free/docs/gcp-free-tier
- Cloud Run pricing: https://cloud.google.com/run/pricing
- Cloud Scheduler pricing: https://cloud.google.com/scheduler/pricing
- GitHub Actions billing and usage: https://docs.github.com/en/actions/concepts/billing-and-usage
- GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

## Public Repository Checklist

Before making the repository public:

1. Run the audit script.

```bash
./scripts/audit-public-release.sh
```

2. Confirm these local-only files are not tracked.

- `.env`
- `.env.local`
- `.env.*` except `.env.example`
- `*.db`
- `*.sqlite`
- `*.pem`
- `*.key`
- `.next/`
- `node_modules/`

3. Review git history metadata.

Commits contain author name/email unless rewritten. If that matters, publish a clean squashed history using a GitHub noreply email instead of pushing this local history directly.

4. Rotate anything that was ever pasted into chat or terminal output.

Even if it is not in git, rotate old tokens if they appeared in logs, screenshots, or copied command output.

5. Decide whether to publish existing git history.

The current tree is intended to be public-safe, but git commits can contain author name/email and earlier development context. If that matters, create a fresh public repository from a squashed export instead of pushing the existing local history.

## Current Audit Result

As of this note:

- Tracked source files do not appear to contain production passwords, OAuth secrets, Cloud SQL passwords, or private keys.
- `.env` and local DB files exist locally but are ignored.
- Git history contains the local author identity. Publish with a squashed clean commit if you want to hide that.
