# Public Release Checklist

Use this before making the repository public.

## Source Tree

```bash
git status --short
./scripts/audit-public-release.sh
npm run lint
npm test
npm run build
```

Expected:

- `git status --short` is clean.
- The audit script reports no tracked sensitive findings.
- `.env`, local DB files, `.next`, `node_modules`, and `public-out` are ignored.

## Secrets

Confirm these are not tracked:

- `.env`
- `.env.local`
- `.env.*` except `.env.example`
- `*.db`
- `*.sqlite`
- `*.pem`
- `*.key`
- Cloud SQL passwords
- OAuth client secrets
- internal sync tokens

Rotate any value that appeared in terminal logs, screenshots, issue comments, or chat transcripts.

## Git History

The current tree can be public-safe while the commit history still contains author metadata and older development context.

If you want the cleanest public launch:

1. Create a new empty repository.
2. Copy the current working tree without `.git`.
3. Commit once using a GitHub noreply email.
4. Push that fresh repository.

If you are comfortable with the local author identity and commit history, pushing the existing history is simpler.

## Hosting Choice

- Public demo only: use [free-public-pages.md](free-public-pages.md).
- Dynamic private/multi-user app: use [deploy-gcp.md](deploy-gcp.md).
- Cost tradeoffs: see [cost-and-public-release.md](cost-and-public-release.md).

## Legal / Content Boundary

The code is MIT licensed, but manga content belongs to its respective rights holders.

Do not include manga images, thumbnails, body text, raw HTML, or scraped paid/private content in public output.
