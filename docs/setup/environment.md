# Environment Variables

## Backend (.env)
| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | postgresql+asyncpg://localhost/gym_ops |
| REDIS_URL | Redis connection string | redis://localhost:6379 |
| SECRET_KEY | JWT signing secret | (required) |
| STRIPE_SECRET_KEY | Platform Stripe secret key | (required) |
| STRIPE_WEBHOOK_SECRET | Platform webhook signing secret | (required) |
| STRIPE_CONNECT_CLIENT_ID | Stripe Connect OAuth client ID | (required) |
| SENTRY_DSN | Error tracking | None |
| RESEND_API_KEY | Email delivery | None |
| APP_NAME | Application name | Gym Ops |
| CORS_ORIGINS | Allowed CORS origins | http://localhost:3000 |

## Frontend (.env.local)
| Variable | Description | Default |
|----------|-------------|---------|
| NEXT_PUBLIC_API_URL | Backend API URL | http://localhost:8000 |
| NEXT_PUBLIC_WS_URL | WebSocket URL | ws://localhost:8000/ws |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | Platform Stripe publishable key | (required) |
