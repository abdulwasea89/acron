# SQLModel Async Reference

## Table of Contents
- [Async Setup](#async-setup)
- [Async Session](#async-session)
- [Async CRUD Operations](#async-crud-operations)
- [FastAPI Integration](#fastapi-integration)
- [Async Relationships](#async-relationships)
- [Connection Pool](#connection-pool)
- [Testing Async](#testing-async)

## Async Setup

### Installation
```bash
pip install sqlmodel aiosqlite  # SQLite
# or
pip install sqlmodel asyncpg    # PostgreSQL
# or
pip install sqlmodel aiomysql   # MySQL
```

### Async Engine
```python
from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# SQLite async
DATABASE_URL = "sqlite+aiosqlite:///./database.db"

# PostgreSQL async
# DATABASE_URL = "postgresql+asyncpg://user:password@localhost/dbname"

async_engine = create_async_engine(
    DATABASE_URL,
    echo=True,
    future=True
)

async_session = sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)
```

### Create Tables
```python
async def create_db_and_tables():
    async with async_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
```

## Async Session

### Context Manager Pattern
```python
async def get_async_session():
    async with async_session() as session:
        yield session
```

### Manual Session Management
```python
async def example():
    session = async_session()
    try:
        # ... operations
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
```

## Async CRUD Operations

### Create
```python
from sqlmodel import select

async def create_hero(session: AsyncSession, hero: HeroCreate) -> Hero:
    db_hero = Hero.model_validate(hero)
    session.add(db_hero)
    await session.commit()
    await session.refresh(db_hero)
    return db_hero
```

### Read
```python
async def get_hero(session: AsyncSession, hero_id: int) -> Hero | None:
    return await session.get(Hero, hero_id)

async def get_heroes(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 100
) -> list[Hero]:
    result = await session.exec(
        select(Hero).offset(skip).limit(limit)
    )
    return result.all()

async def get_hero_by_name(session: AsyncSession, name: str) -> Hero | None:
    result = await session.exec(
        select(Hero).where(Hero.name == name)
    )
    return result.first()
```

### Update
```python
async def update_hero(
    session: AsyncSession,
    hero_id: int,
    hero_update: HeroUpdate
) -> Hero | None:
    db_hero = await session.get(Hero, hero_id)
    if not db_hero:
        return None

    hero_data = hero_update.model_dump(exclude_unset=True)
    db_hero.sqlmodel_update(hero_data)

    session.add(db_hero)
    await session.commit()
    await session.refresh(db_hero)
    return db_hero
```

### Delete
```python
async def delete_hero(session: AsyncSession, hero_id: int) -> bool:
    hero = await session.get(Hero, hero_id)
    if not hero:
        return False

    await session.delete(hero)
    await session.commit()
    return True
```

## FastAPI Integration

### Dependencies
```python
from typing import Annotated
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

async def get_async_session():
    async with async_session() as session:
        yield session

AsyncSessionDep = Annotated[AsyncSession, Depends(get_async_session)]
```

### Lifespan
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_and_tables()
    yield
    await async_engine.dispose()

app = FastAPI(lifespan=lifespan)
```

### Async Endpoints
```python
from fastapi import FastAPI, HTTPException

@app.post("/heroes/", response_model=HeroPublic)
async def create_hero(hero: HeroCreate, session: AsyncSessionDep):
    db_hero = Hero.model_validate(hero)
    session.add(db_hero)
    await session.commit()
    await session.refresh(db_hero)
    return db_hero

@app.get("/heroes/{hero_id}", response_model=HeroPublic)
async def read_hero(hero_id: int, session: AsyncSessionDep):
    hero = await session.get(Hero, hero_id)
    if not hero:
        raise HTTPException(status_code=404, detail="Hero not found")
    return hero

@app.get("/heroes/", response_model=list[HeroPublic])
async def read_heroes(
    session: AsyncSessionDep,
    skip: int = 0,
    limit: int = 100
):
    result = await session.exec(select(Hero).offset(skip).limit(limit))
    return result.all()
```

## Async Relationships

### Eager Loading with selectinload
```python
from sqlalchemy.orm import selectinload

@app.get("/teams/{team_id}", response_model=TeamPublicWithHeroes)
async def read_team(team_id: int, session: AsyncSessionDep):
    statement = (
        select(Team)
        .where(Team.id == team_id)
        .options(selectinload(Team.heroes))
    )
    result = await session.exec(statement)
    team = result.first()

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team
```

### Avoid Lazy Loading in Async
```python
# BAD - Lazy loading doesn't work well in async
hero = await session.get(Hero, 1)
team = hero.team  # May cause issues!

# GOOD - Eager load explicitly
statement = select(Hero).where(Hero.id == 1).options(
    selectinload(Hero.team)
)
result = await session.exec(statement)
hero = result.first()
team = hero.team  # Already loaded
```

## Connection Pool

### PostgreSQL Pool Configuration
```python
async_engine = create_async_engine(
    DATABASE_URL,
    echo=True,
    pool_size=5,           # Number of connections to keep open
    max_overflow=10,       # Additional connections if pool exhausted
    pool_timeout=30,       # Seconds to wait for connection
    pool_recycle=1800,     # Recycle connections after N seconds
    pool_pre_ping=True     # Check connection health before use
)
```

### Graceful Shutdown
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_and_tables()
    yield
    # Dispose of connection pool on shutdown
    await async_engine.dispose()
```

## Testing Async

### Pytest Fixtures
```python
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def async_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=True)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield engine
    await engine.dispose()

@pytest_asyncio.fixture
async def async_session(async_engine):
    async_session_maker = sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    async with async_session_maker() as session:
        yield session

@pytest_asyncio.fixture
async def client(async_session):
    async def override_get_session():
        yield async_session

    app.dependency_overrides[get_async_session] = override_get_session

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        yield client

    app.dependency_overrides.clear()
```

### Async Tests
```python
import pytest

@pytest.mark.asyncio
async def test_create_hero(client: AsyncClient):
    response = await client.post(
        "/heroes/",
        json={"name": "Spider-Boy", "secret_name": "Peter Parker"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Spider-Boy"
    assert "id" in data

@pytest.mark.asyncio
async def test_read_heroes(client: AsyncClient, async_session: AsyncSession):
    # Create test data
    hero = Hero(name="Test Hero", secret_name="Secret")
    async_session.add(hero)
    await async_session.commit()

    # Test endpoint
    response = await client.get("/heroes/")
    assert response.status_code == 200
    assert len(response.json()) >= 1
```

## Async Background Tasks

### FastAPI Background Tasks
```python
from fastapi import BackgroundTasks

async def send_notification(hero_id: int):
    # Async notification logic
    async with async_session() as session:
        hero = await session.get(Hero, hero_id)
        # Send notification...

@app.post("/heroes/")
async def create_hero(
    hero: HeroCreate,
    session: AsyncSessionDep,
    background_tasks: BackgroundTasks
):
    db_hero = Hero.model_validate(hero)
    session.add(db_hero)
    await session.commit()
    await session.refresh(db_hero)

    # Schedule background task
    background_tasks.add_task(send_notification, db_hero.id)

    return db_hero
```

## Transactions

### Async Transaction
```python
async def transfer_hero(
    session: AsyncSession,
    hero_id: int,
    from_team_id: int,
    to_team_id: int
):
    async with session.begin():
        hero = await session.get(Hero, hero_id)
        if hero.team_id != from_team_id:
            raise ValueError("Hero not in source team")

        hero.team_id = to_team_id
        session.add(hero)
        # Auto-commits on context exit, rolls back on exception
```

### Nested Transactions (Savepoints)
```python
async with session.begin():
    # Outer transaction
    session.add(hero1)

    async with session.begin_nested():
        # Savepoint
        session.add(hero2)
        # Rollback only this savepoint on error

    # Continues outer transaction
    session.add(hero3)
```
