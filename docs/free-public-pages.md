# Free Public Pages

This is the lowest-cost public mode for AllManga.

It publishes a metadata-only static snapshot. There is no always-on app server, no always-on database, and no server-side user accounts.

## What It Provides

- Recent manga update metadata
- Discovery metadata for oneshots / public-safe announcements
- Official links only
- Browser-local follow / unfollow using `localStorage`
- Search and compact display mode
- Daily automatic refresh by GitHub Actions

## What It Does Not Provide

- Cross-device follow sync
- Server-side read/unread state
- Private dashboard
- Images, thumbnails, manga body text, descriptions, or raw HTML
- User accounts

If you need cross-device follow/read state, use the dynamic app profile with Google login and PostgreSQL.

## Local Export

You need a PostgreSQL `DATABASE_URL`.

```bash
npm run sync:once
npm run export:public-static
```

The static files are written to:

```text
public-out/
```

## GitHub Pages Setup

1. Push this repository to GitHub.
2. Open the repository settings.
3. Go to `Pages`.
4. Set `Source` to `GitHub Actions`.
5. Open `Actions`.
6. Run `Free Public Pages` manually once.

After that, the workflow runs once per day around 05:10 JST.

The workflow uses a temporary PostgreSQL service inside GitHub Actions:

- Migrate schema
- Sync all adapters once
- Export public-safe static files
- Deploy `public-out/` to GitHub Pages

## Sync Frequency

Daily sync is the default because it is gentle and cheap.

Recommended starting points:

- Public hobby demo: once per day
- Public page that people actually check daily: twice per day
- Personal dynamic dashboard: every 1-6 hours, depending on cost tolerance
- Serious multi-user service: dedicated worker queue, monitoring, and rate limits

Do not start with 30-minute polling unless freshness is clearly worth the cost and upstream load.

## Follow Behavior

The static page stores follows in this browser key:

```text
allmanga-public-follows-v1
```

This is intentionally local-only. It is privacy-preserving and free, but it is not a replacement for login.
