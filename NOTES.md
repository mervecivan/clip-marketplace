# Notes

## Setup

Follow the commands in `README.md`. The compose file starts Postgres on port `5433`; migrations are committed under `drizzle/`. `pnpm db:seed` creates one development admin and one development creator for the signed-cookie user switcher.

## Concurrent approvals

Approval runs in a database transaction and locks the campaign row with `SELECT ... FOR UPDATE` before it calculates approved spend and changes a submission state. Every concurrent approval for that campaign queues behind the same lock, so the request that acquires it first is evaluated first; later requests see its spend and receive the typed `BUDGET_EXCEEDED` error when appropriate. I considered serializable isolation and advisory locks, but the campaign-row lock directly scopes contention to the budget being protected and works with the existing schema.

The database-backed workflow test starts two approval calls against a budget that covers only one payout and asserts that exactly one succeeds. It also verifies that a second ingest for the same UTC day is skipped.

## Deliberately omitted

Real authentication, third-party platform APIs, payment transfer execution, and custom visual design are intentionally omitted. The dev user switcher and fake ingest match the exercise scope. A live deployment has not been created because it requires access to a hosting account.

## With another day

I would add observability around ingest failures, a production migration/backup workflow, and end-to-end browser coverage for the primary admin and creator journeys.

## AI tooling

I used AI tools as support for reviewing requirements, considering alternatives, and building a verification checklist. I reviewed and adapted the output to the project structure; scope, technical decisions, and final checks were my responsibility.
