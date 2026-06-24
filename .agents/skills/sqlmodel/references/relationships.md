# SQLModel Relationships Reference

## Table of Contents
- [One-to-Many](#one-to-many)
- [Many-to-Many](#many-to-many)
- [One-to-One](#one-to-one)
- [Self-Referential](#self-referential)
- [Loading Strategies](#loading-strategies)
- [Relationship Operations](#relationship-operations)
- [Circular Imports](#circular-imports)

## One-to-Many

### Basic One-to-Many
```python
from sqlmodel import Field, Relationship, SQLModel

class Team(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str

    heroes: list["Hero"] = Relationship(back_populates="team")

class Hero(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str

    team_id: int | None = Field(default=None, foreign_key="team.id")
    team: Team | None = Relationship(back_populates="heroes")
```

### Creating with Relationship
```python
# Method 1: Create separately, assign FK
with Session(engine) as session:
    team = Team(name="Avengers")
    session.add(team)
    session.commit()
    session.refresh(team)

    hero = Hero(name="Iron Man", team_id=team.id)
    session.add(hero)
    session.commit()

# Method 2: Create together (nested)
with Session(engine) as session:
    team = Team(
        name="Avengers",
        heroes=[
            Hero(name="Iron Man"),
            Hero(name="Thor"),
        ]
    )
    session.add(team)
    session.commit()
```

### Querying with Relationship
```python
from sqlmodel import select
from sqlalchemy.orm import selectinload

# Eager load heroes with team
statement = select(Team).options(selectinload(Team.heroes))
teams = session.exec(statement).all()

for team in teams:
    print(f"{team.name}: {[h.name for h in team.heroes]}")
```

## Many-to-Many

### With Link Table
```python
class HeroTeamLink(SQLModel, table=True):
    hero_id: int | None = Field(
        default=None, foreign_key="hero.id", primary_key=True
    )
    team_id: int | None = Field(
        default=None, foreign_key="team.id", primary_key=True
    )

class Team(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str

    heroes: list["Hero"] = Relationship(
        back_populates="teams",
        link_model=HeroTeamLink
    )

class Hero(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str

    teams: list[Team] = Relationship(
        back_populates="heroes",
        link_model=HeroTeamLink
    )
```

### Link Table with Extra Data
```python
from datetime import datetime

class HeroTeamLink(SQLModel, table=True):
    hero_id: int | None = Field(
        default=None, foreign_key="hero.id", primary_key=True
    )
    team_id: int | None = Field(
        default=None, foreign_key="team.id", primary_key=True
    )
    joined_at: datetime = Field(default_factory=datetime.utcnow)
    role: str = "member"
```

### Many-to-Many Operations
```python
# Add hero to team
with Session(engine) as session:
    hero = session.get(Hero, 1)
    team = session.get(Team, 1)

    hero.teams.append(team)
    session.add(hero)
    session.commit()

# Remove hero from team
with Session(engine) as session:
    hero = session.get(Hero, 1)
    team = session.get(Team, 1)

    hero.teams.remove(team)
    session.add(hero)
    session.commit()

# Query through link
statement = (
    select(Hero)
    .join(HeroTeamLink)
    .join(Team)
    .where(Team.name == "Avengers")
)
heroes = session.exec(statement).all()
```

## One-to-One

```python
class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    username: str

    profile: "Profile | None" = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"uselist": False}
    )

class Profile(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    bio: str | None = None

    user_id: int = Field(foreign_key="user.id", unique=True)
    user: User = Relationship(back_populates="profile")
```

## Self-Referential

### Parent-Child (Tree Structure)
```python
class Category(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str

    parent_id: int | None = Field(default=None, foreign_key="category.id")

    parent: "Category | None" = Relationship(
        back_populates="children",
        sa_relationship_kwargs={"remote_side": "Category.id"}
    )
    children: list["Category"] = Relationship(back_populates="parent")
```

### Usage
```python
with Session(engine) as session:
    parent = Category(name="Electronics")
    child1 = Category(name="Phones", parent=parent)
    child2 = Category(name="Laptops", parent=parent)

    session.add(parent)
    session.commit()

# Query children
with Session(engine) as session:
    electronics = session.exec(
        select(Category).where(Category.name == "Electronics")
    ).first()
    for child in electronics.children:
        print(child.name)
```

## Loading Strategies

### Lazy Loading (Default)
```python
# Relationships loaded on access (N+1 problem risk)
hero = session.get(Hero, 1)
print(hero.team.name)  # Triggers additional query
```

### Eager Loading with selectinload
```python
from sqlalchemy.orm import selectinload

# Best for collections (one-to-many, many-to-many)
statement = select(Team).options(selectinload(Team.heroes))
teams = session.exec(statement).all()
```

### Eager Loading with joinedload
```python
from sqlalchemy.orm import joinedload

# Best for single objects (many-to-one, one-to-one)
statement = select(Hero).options(joinedload(Hero.team))
heroes = session.exec(statement).all()
```

### Nested Eager Loading
```python
from sqlalchemy.orm import selectinload

statement = select(Team).options(
    selectinload(Team.heroes).selectinload(Hero.powers)
)
```

### Subquery Loading
```python
from sqlalchemy.orm import subqueryload

statement = select(Team).options(subqueryload(Team.heroes))
```

## Relationship Operations

### Check if Loaded
```python
from sqlalchemy import inspect

hero = session.get(Hero, 1)
state = inspect(hero)

if "team" in state.unloaded:
    # Team not loaded yet
    pass
```

### Refresh Relationship
```python
session.refresh(hero, ["team"])
```

### Detach from Session
```python
from sqlalchemy.orm import make_transient

session.expunge(hero)  # Remove from session
make_transient(hero)   # Reset state
```

## Circular Imports

### Problem
```python
# models/team.py
from models.hero import Hero  # Circular!

class Team(SQLModel, table=True):
    heroes: list[Hero] = Relationship(...)

# models/hero.py
from models.team import Team  # Circular!

class Hero(SQLModel, table=True):
    team: Team = Relationship(...)
```

### Solution: TYPE_CHECKING
```python
# models/team.py
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models.hero import Hero

class Team(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str

    heroes: list["Hero"] = Relationship(back_populates="team")

# models/hero.py
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models.team import Team

class Hero(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    team_id: int | None = Field(default=None, foreign_key="team.id")

    team: "Team | None" = Relationship(back_populates="heroes")
```

### Update Forward References
```python
# In your main module after all imports
from models.team import Team
from models.hero import Hero

Team.model_rebuild()
Hero.model_rebuild()
```

## Response Models with Relationships

### Avoid Circular Serialization
```python
class TeamBase(SQLModel):
    name: str

class HeroBase(SQLModel):
    name: str

class HeroPublic(HeroBase):
    id: int

class TeamPublic(TeamBase):
    id: int

# Include related data explicitly
class TeamPublicWithHeroes(TeamPublic):
    heroes: list[HeroPublic] = []

class HeroPublicWithTeam(HeroPublic):
    team: TeamPublic | None = None
```

### FastAPI Endpoint
```python
@app.get("/teams/{team_id}", response_model=TeamPublicWithHeroes)
def get_team(team_id: int, session: SessionDep):
    statement = select(Team).where(Team.id == team_id).options(
        selectinload(Team.heroes)
    )
    team = session.exec(statement).first()
    if not team:
        raise HTTPException(404, "Team not found")
    return team
```
