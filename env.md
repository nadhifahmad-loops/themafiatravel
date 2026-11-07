# Environment configuration

Use [`.env.example`](./.env.example) as the safe template for local development.
Copy it to `.env.local` for Next.js or `.env` for Docker Compose, then provide
values from the appropriate development, staging, or production accounts.

Never put credentials, connection strings, access tokens, or generated provider
configuration dumps in this file or in Git. Environment files containing real
values are ignored by `.gitignore`; verify with `git status --short` before
sharing the repository.

**Credential hygiene:** a previous version of this tracked file contained
real environment values. Removing them from the current file does not erase
older Git commits. Rotate/revoke the affected credentials and coordinate a
history cleanup before sharing with a wider audience. See
[`PRODUCTION-HANDOFF.md`](./PRODUCTION-HANDOFF.md).
