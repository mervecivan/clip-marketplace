# Clip marketplace

## Local setup

Prerequisites: Node.js 20+, pnpm 10+, and Docker Desktop.

```powershell
Copy-Item .env.example .env
docker compose up -d
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Before running Docker Compose, set `DATABASE_URL` and the database credential required by the official Postgres image in your local `.env` file. The `.env` file is ignored by Git and must never be committed.

Open `http://localhost:3000`, then select the seeded admin or creator using the development user switcher.

Useful commands:

```powershell
pnpm test
pnpm ingest
pnpm build
```

`pnpm ingest` creates at most one metric row per approved submission for the current UTC date. It reports individual failures and exits unsuccessfully if any submission failed.
