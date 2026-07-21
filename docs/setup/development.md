# Development Setup

## Prerequisites
- Python 3.12+, Node.js 20+, pnpm
- PostgreSQL 16, Redis 7
- Docker (optional, for local DB)

## Quick Start
```bash
# 1. Start infrastructure
docker compose up -d postgres redis

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 3. Frontend
cd frontend
pnpm install
pnpm dev
```

## Commands
| Command | Purpose |
|---------|---------|
| `pnpm dev:backend` | Start FastAPI + PostgreSQL + Redis |
| `pnpm dev:web` | Start Next.js dev server |
| `pnpm lint` | ESLint + Ruff across all packages |
| `pnpm typecheck` | TypeScript + mypy |
| `pnpm test` | All test suites |
| `pnpm db:migrate` | Alembic migration upgrade |
| `pnpm db:seed` | Seed development data |
| `pnpm db:reset` | Drop + recreate + migrate |

## Code Conventions
- TypeScript: camelCase, explicit return types, no `any`
- Python: PEP 8, type hints everywhere, async def for routes
- SQLAlchemy: async sessions, never sync
- Commits: conventional commits (`feat:`, `fix:`, `docs:`, etc.)
