# SQLModel Migrations Reference

## Table of Contents
- [Alembic Setup](#alembic-setup)
- [Configuration](#configuration)
- [Generating Migrations](#generating-migrations)
- [Running Migrations](#running-migrations)
- [Migration Patterns](#migration-patterns)
- [Async Migrations](#async-migrations)
- [Common Issues](#common-issues)

## Alembic Setup

### Installation
```bash
pip install alembic
```

### Initialize
```bash
alembic init alembic
```

Creates:
```
project/
├── alembic/
│   ├── versions/           # Migration files
│   ├── env.py              # Environment config
│   ├── script.py.mako      # Migration template
│   └── README
└── alembic.ini             # Alembic config
```

## Configuration

### alembic.ini
```ini
[alembic]
script_location = alembic
prepend_sys_path = .
sqlalchemy.url = sqlite:///./database.db

# For PostgreSQL:
# sqlalchemy.url = postgresql://user:password@localhost/dbname
```

### env.py (Sync)
```python
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# Import SQLModel and all your models
from sqlmodel import SQLModel
from app.models import Hero, Team  # Import all models!

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set target metadata for autogenerate
target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,  # Detect column type changes
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,  # Detect column type changes
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

### Use Environment Variables
```python
# env.py
import os
from dotenv import load_dotenv

load_dotenv()

def get_url():
    return os.getenv("DATABASE_URL", "sqlite:///./database.db")

config.set_main_option("sqlalchemy.url", get_url())
```

## Generating Migrations

### Auto-generate
```bash
# Generate migration from model changes
alembic revision --autogenerate -m "Add hero table"
```

### Empty Migration
```bash
# Create empty migration for manual editing
alembic revision -m "Add custom index"
```

### Generated Migration Example
```python
"""Add hero table

Revision ID: abc123
Revises:
Create Date: 2024-01-15 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
import sqlmodel

revision: str = 'abc123'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'hero',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('secret_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('age', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_hero_name'), 'hero', ['name'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_hero_name'), table_name='hero')
    op.drop_table('hero')
```

## Running Migrations

### Apply All Migrations
```bash
alembic upgrade head
```

### Apply Specific Migration
```bash
alembic upgrade abc123
```

### Rollback Last Migration
```bash
alembic downgrade -1
```

### Rollback to Specific Migration
```bash
alembic downgrade abc123
```

### Rollback All
```bash
alembic downgrade base
```

### View Current Version
```bash
alembic current
```

### View Migration History
```bash
alembic history
```

### Show SQL Without Executing
```bash
alembic upgrade head --sql
```

## Migration Patterns

### Add Column
```python
def upgrade() -> None:
    op.add_column('hero', sa.Column('power_level', sa.Integer(), nullable=True))

def downgrade() -> None:
    op.drop_column('hero', 'power_level')
```

### Add Column with Default
```python
def upgrade() -> None:
    op.add_column(
        'hero',
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False)
    )

def downgrade() -> None:
    op.drop_column('hero', 'is_active')
```

### Rename Column
```python
def upgrade() -> None:
    op.alter_column('hero', 'name', new_column_name='hero_name')

def downgrade() -> None:
    op.alter_column('hero', 'hero_name', new_column_name='name')
```

### Change Column Type
```python
def upgrade() -> None:
    op.alter_column(
        'hero',
        'age',
        existing_type=sa.Integer(),
        type_=sa.String(10),
        existing_nullable=True
    )

def downgrade() -> None:
    op.alter_column(
        'hero',
        'age',
        existing_type=sa.String(10),
        type_=sa.Integer(),
        existing_nullable=True
    )
```

### Add Index
```python
def upgrade() -> None:
    op.create_index('ix_hero_team_id', 'hero', ['team_id'], unique=False)

def downgrade() -> None:
    op.drop_index('ix_hero_team_id', table_name='hero')
```

### Add Foreign Key
```python
def upgrade() -> None:
    op.add_column('hero', sa.Column('team_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_hero_team',
        'hero', 'team',
        ['team_id'], ['id']
    )

def downgrade() -> None:
    op.drop_constraint('fk_hero_team', 'hero', type_='foreignkey')
    op.drop_column('hero', 'team_id')
```

### Add Unique Constraint
```python
def upgrade() -> None:
    op.create_unique_constraint('uq_hero_email', 'hero', ['email'])

def downgrade() -> None:
    op.drop_constraint('uq_hero_email', 'hero', type_='unique')
```

### Data Migration
```python
from sqlalchemy.sql import table, column

def upgrade() -> None:
    # Define temporary table reference
    hero = table(
        'hero',
        column('id', sa.Integer),
        column('name', sa.String),
        column('name_upper', sa.String),
    )

    # Add new column
    op.add_column('hero', sa.Column('name_upper', sa.String(), nullable=True))

    # Migrate data
    connection = op.get_bind()
    connection.execute(
        hero.update().values(name_upper=sa.func.upper(hero.c.name))
    )

    # Make non-nullable after data migration
    op.alter_column('hero', 'name_upper', nullable=False)

def downgrade() -> None:
    op.drop_column('hero', 'name_upper')
```

### Batch Operations (SQLite)
```python
# SQLite requires batch mode for some operations
def upgrade() -> None:
    with op.batch_alter_table('hero') as batch_op:
        batch_op.alter_column('name', nullable=False)
        batch_op.create_index('ix_hero_name', ['name'])

def downgrade() -> None:
    with op.batch_alter_table('hero') as batch_op:
        batch_op.drop_index('ix_hero_name')
        batch_op.alter_column('name', nullable=True)
```

## Async Migrations

### env.py (Async)
```python
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

from sqlmodel import SQLModel
from app.models import *  # Import all models

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

### Async Database URL
```ini
# alembic.ini
sqlalchemy.url = postgresql+asyncpg://user:password@localhost/dbname
```

## Common Issues

### Autogenerate Not Detecting Changes

**Problem:** `alembic revision --autogenerate` creates empty migration.

**Solution:**
1. Import all models in env.py:
```python
from app.models import Hero, Team, Power  # All models!
```

2. Enable `compare_type`:
```python
context.configure(
    connection=connection,
    target_metadata=target_metadata,
    compare_type=True,  # Add this!
)
```

### Multiple Heads

**Problem:** "Multiple heads" error when running migrations.

**Solution:**
```bash
# View heads
alembic heads

# Merge heads
alembic merge heads -m "Merge migrations"
```

### Type Changes Not Detected

**Problem:** Column type changes not detected by autogenerate.

**Solution:**
Add to env.py:
```python
context.configure(
    connection=connection,
    target_metadata=target_metadata,
    compare_type=True,
    compare_server_default=True,  # For default value changes
)
```

### SQLModel AutoString Type

**Problem:** Migrations show `sqlmodel.sql.sqltypes.AutoString`.

**Solution:** This is normal for SQLModel. It maps to database varchar.

### Testing Migrations

```python
import pytest
from alembic.config import Config
from alembic import command

@pytest.fixture
def alembic_config():
    config = Config("alembic.ini")
    return config

def test_migrations_up_down(alembic_config):
    # Apply all migrations
    command.upgrade(alembic_config, "head")

    # Rollback all migrations
    command.downgrade(alembic_config, "base")

    # Apply again (ensures reversibility)
    command.upgrade(alembic_config, "head")
```

### Pre-commit Hook
```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: check-migrations
        name: Check for pending migrations
        entry: alembic check
        language: system
        pass_filenames: false
        always_run: true
```
