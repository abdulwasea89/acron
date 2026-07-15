# Backups

Database snapshot and restore scripts.

| File | Purpose |
|------|---------|
| `backup_db.sh` | Creates a timestamped PostgreSQL dump via `pg_dump`, compresses it, and rotates old backups |
