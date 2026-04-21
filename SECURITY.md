# Security Policy

## Supported Versions

This project is early-stage. Security fixes target the current `main` branch.

## Reporting a Vulnerability

Please use GitHub private vulnerability reporting if it is enabled on the repository. If it is not enabled, open a minimal issue that does not include secrets or exploit details, and ask for a private contact path.

Do not include:

- Real `.env` values
- OAuth client secrets
- Database URLs
- Session tokens
- Cloud project secrets
- Private cookies

## Public Data Boundary

The public-safe page and API must remain whitelist-based. They must not expose private user state, read state, priorities, tags, manga body text, raw HTML, or images.

## Deployment Notes

For production-like deployments:

- Use Google OAuth allowlists or another real authentication layer.
- Keep `PASSWORD_LOGIN_ENABLED=false` after OAuth is verified.
- Store secrets in a managed secret store.
- Rotate anything that was pasted into logs, screenshots, issues, or chat.
- Keep sync frequency conservative to avoid upstream load.
