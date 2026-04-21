# Contributing

AllManga is a metadata-only manga update inbox. Contributions are welcome, but please keep the project conservative around copyright, upstream site load, and private user state.

## Local Setup

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

The app expects PostgreSQL. For Docker-based local setup:

```bash
docker compose up --build
```

## Checks

Run these before opening a pull request:

```bash
npm run lint
npm test
npm run build
./scripts/audit-public-release.sh
```

## Source Adapter Guidelines

- Prefer official public routes: RSS, update lists, series lists, oneshot lists, labels, and news pages.
- Do not depend on authenticated, paid, or user-specific areas.
- Do not store or redistribute manga body images or text.
- Keep adapters isolated per site.
- Add tests or fixtures when changing classification, dates, deduplication, or site-specific parsing.
- Be gentle with upstream sites: avoid high-frequency polling and unnecessary detail-page fan-out.

## Public-Safe Data Rules

Public output must be whitelist-based and metadata-only.

Allowed:

- Work title
- Author names
- Site name
- Semantic kind
- Publish date
- Official URL

Not allowed in public-safe output:

- Manga images or thumbnails
- Body text
- Raw HTML
- Private follow/read state
- User priority, tags, or personal notes

## Reporting Site Breakage

Adapters can break when upstream sites change their markup. Please include:

- Site id
- URL that stopped working
- Expected title/release
- Whether the issue affects sync, classification, thumbnails, or UI

Avoid pasting private cookies, account data, or paid-content URLs.
