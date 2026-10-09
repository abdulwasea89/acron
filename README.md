# Acron — Gym Operations Platform

Acron is a multi-tenant platform for gyms and fitness businesses. It combines a FastAPI backend, a Next.js web portal, and an Expo mobile app for members, staff, and owners.

Each organization is an independent tenant. The platform supports gym operations, member billing, staff management, and AI-assisted retention workflows. The product scope is documented in the [functional requirements](requirements/functional_requirements.md) and architecture references below.

## Product areas

- **Members and memberships:** organization-scoped member records, plans, enrollment, profiles, and payment history.
- **Front desk:** QR and manual attendance, visitor/day-pass workflows, cash logging, and receipts.
- **Payments and payroll:** Stripe billing and Connect integrations, offline payment records, payroll, and reconciliation workflows.
- **Retention and communications:** onboarding, renewal and inactivity workflows, campaigns, NPS, celebrations, and an email inbox with AI drafting.
- **Assistant and analytics:** organization-aware analytics, an AI assistant, and approval-gated write actions.
- **Mobile app:** member, staff, and owner experiences for common operational tasks.

Some integrations run in a local stub or fallback mode until credentials are configured. The repository is under active development; review the product requirements and setup documentation before treating a feature as production-ready.

## Repository layout

```text
backend/       FastAPI API, SQLAlchemy models, services, workers, and tests
frontend/      Next.js web portal
mobileapp/     Expo / React Native app
shared/        Shared TypeScript contracts
docs/          Architecture, API references, ADRs, and feature audit
requirements/  Product and engineering requirements
docker/        Backend image and production Compose configuration
deploy/        Deployment scripts
infra/         Staging and production infrastructure notes
monitoring/    Monitoring configuration and documentation
```

## Technology

| Area | Stack |
| --- | --- |
| Backend | Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic |
| Data and jobs | SQLite for local development by default; PostgreSQL for cloud deployments; Celery and Redis for background work |
| Web | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Mobile | Expo SDK 54, React Native, TypeScript |
| Payments | Stripe Billing and Stripe Connect integrations |
| Assistant | LangGraph with a configurable Groq-compatible model provider |

## Requirements

- Python 3.12+
- Node.js 20+
- `uv` for backend dependencies
- npm for the web and mobile projects
- Redis when running Celery workers or features that depend on Redis
- PostgreSQL when using the cloud database configuration

## Run locally

### Backend API

The API uses a local SQLite database by default and creates its tables at startup, so a database server is not required for a basic local run.

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

The API is available at `http://localhost:8000`; interactive API docs are at `http://localhost:8000/docs`. Configure secrets and integrations in `backend/.env` as needed. The root `.env.example` documents supported settings. To use PostgreSQL, set `USE_CLOUD_DB=yes` and configure `CLOUD_DATABASE_URL`; apply schema migrations with `uv run alembic upgrade head` from `backend/`.

### Web portal

In a separate terminal:

```bash
cd frontend
npm ci
npm run dev
```

The portal runs at `http://localhost:3000`. Its optional local environment template is `frontend/.env.local.example`.

### Mobile app

In a separate terminal:

```bash
cd mobileapp
npm ci
npm start
```

Set `EXPO_PUBLIC_API_URL` to a backend address reachable from the simulator or device. A physical phone usually needs the computer's LAN IP instead of `localhost`.

## Background worker

Start Redis, then run the worker from `backend/`:

```bash
uv run celery -A app.workers worker -l info
```

## Useful commands

Run these from `backend/`:

```bash
uv run pytest                 # backend test suite
uv run ruff check .           # lint backend Python
uv run mypy app               # type-check backend
uv run alembic upgrade head   # apply database migrations
```

Run frontend or mobile linting from the corresponding project directory:

```bash
npm run lint
```

## Architecture and product docs

- [Development setup](docs/setup/development.md)
- [Environment variables](docs/setup/environment.md)
- [Architecture overview](docs/architecture.md)
- [API endpoint catalog](docs/api/endpoint-catalog.md)
- [Functional requirements](requirements/functional_requirements.md)
- [Architecture decision records](docs/adr/)

## Security and payment boundaries

- Organization-scoped data access is tied to the authenticated organization context.
- State-changing operations use idempotency protections where supported.
- Platform Stripe billing is separate from member payments processed for gyms through Connect.
- Mobile workflows are intended for member and operational quick actions; administrative financial controls remain in the web portal.

For deployment, credentials, data migrations, and operational requirements, review the deployment and infrastructure documentation before running the platform outside local development.
