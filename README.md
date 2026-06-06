# Gym Operations Platform

Multi-tenant SaaS for gym operations. One backend, one web portal, one mobile app,
multiple roles: owner, manager, trainer, front desk, member. Each gym is an isolated
organization identified by `organization_id`.

Full product specification: `requirements/Gym_Platform_Full_Plan.pdf`
Engineering reference: `CLAUDE.md`

## Money flows

1. Gym owner pays the platform a monthly SaaS subscription ($29 / $79 / custom) via Stripe.
2. Members pay their gym directly through Stripe Connect Standard or cash. The platform never holds member funds.
3. Gym pays trainers through the built-in payroll module (fixed + hourly + per-class + commission).

## Repository layout

```
backend/        FastAPI API, Celery workers, SQLAlchemy models
frontend/       Web portal, Next.js 15 (admin command center)        -- not started
mobileapp/      Expo / React Native (members, staff, admin quick actions) -- not started
requirements/   Product plan and requirement documents
docker/         Dockerfile and production compose files
docs/           Architecture, API, data model, decision records
scripts/        Dev setup and database seed scripts
deploy/         Deployment scripts
infra/          Environment configs (prod, staging)
nginx/          Reverse proxy config
monitoring/     Alerting and observability config
backups/        Database backup scripts
```

## Stack

| Layer    | Technology                                          |
|----------|------------------------------------------------------|
| Backend  | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 async |
| Database | PostgreSQL 16 (row-level security), Redis             |
| Jobs     | Celery + Redis                                        |
| Payments | Stripe Billing (SaaS) + Stripe Connect Standard (gyms)|
| Web      | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui       |
| Mobile   | Expo, React Native, TypeScript                        |
| Auth     | JWT (15 min access / 7 day refresh), optional MFA     |

## Getting started

```bash
# Start Postgres, Redis, API, and worker
docker compose up

# Or run the backend directly
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

See `backend/README.md` for migrations, tests, and lint commands.

## Build order

1. Backend — API, auth, tenancy, payments, payroll (in progress)
2. Web portal — admin command center
3. Mobile app — members and staff

## Core invariants

- Every state-changing request carries an `Idempotency-Key` header. Zero double-charges.
- Every org-scoped query filters by the JWT's `organization_id`. Postgres RLS is the second defense, not the first.
- Two Stripe accounts, never mixed: platform Stripe for SaaS fees only, gym Connect accounts for member payments only.
- Financial actions (refunds, payroll, plan edits, security settings) are web-only for admins. Mobile is for quick actions.
- Auth failures return vague errors; never reveal which field was wrong.
