# Monitoring

Observability stack for the Gym Platform.

## Stack

| Tool | Role |
|------|------|
| **Sentry** | Error tracking and performance monitoring (backend + frontend) |
| **Prometheus** | Metric collection — API latency, payment throughput, queue depths, Stripe webhook lag |
| **Grafana** | Dashboards — SaaS revenue, cash reconciliation, AI pipeline health, payroll run times |

## Alerts (planned)

- Payment idempotency failure rate > 0%
- AI receipt queue backlog > 50 items
- Payroll run exceeding 10 minutes
- Webhook processing lag > 30 seconds
