# SQLModel Models Reference

## Table of Contents
- [Field Options](#field-options)
- [Column Types](#column-types)
- [Validators](#validators)
- [Computed Fields](#computed-fields)
- [Model Inheritance](#model-inheritance)
- [Mixins](#mixins)
- [Model Configuration](#model-configuration)

## Field Options

### Primary Key
```python
class Hero(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
```

### Auto-increment UUID
```python
from uuid import UUID, uuid4

class Hero(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
```

### Index and Unique
```python
class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    username: str = Field(index=True)
```

### Foreign Key
```python
class Hero(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    team_id: int | None = Field(default=None, foreign_key="team.id")
```

### Default Values
```python
from datetime import datetime

class Article(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    is_published: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

### Nullable Fields
```python
class Hero(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str  # Required, NOT NULL
    nickname: str | None = None  # Optional, nullable
```

### String Constraints
```python
class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(min_length=3, max_length=50)
    email: str = Field(max_length=255, regex=r'^[\w\.-]+@[\w\.-]+\.\w+$')
```

### Numeric Constraints
```python
class Product(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    price: float = Field(ge=0)  # >= 0
    quantity: int = Field(ge=0, le=1000)  # 0-1000
    rating: float = Field(ge=0, le=5)  # 0-5
```

### SA Column Arguments
```python
from sqlalchemy import Column, String, Text

class Article(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    # Use SQLAlchemy column for advanced types
    content: str = Field(sa_column=Column(Text))
    status: str = Field(sa_column=Column(String(20), server_default="draft"))
```

## Column Types

### Common Types
```python
from datetime import date, datetime, time
from decimal import Decimal
from uuid import UUID

class AllTypes(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)

    # Strings
    name: str
    description: str | None = None

    # Numbers
    count: int
    price: float
    amount: Decimal = Field(decimal_places=2, max_digits=10)

    # Boolean
    is_active: bool = True

    # Date/Time
    birth_date: date
    created_at: datetime
    start_time: time

    # UUID
    uuid: UUID
```

### JSON Column
```python
from typing import Any
from sqlalchemy import Column, JSON

class Settings(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    data: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
```

### Enum Column
```python
from enum import Enum

class Status(str, Enum):
    draft = "draft"
    published = "published"
    archived = "archived"

class Article(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    status: Status = Status.draft
```

## Validators

### Field Validators
```python
from pydantic import field_validator

class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str
    username: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("Invalid email format")
        return v.lower()

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not v.isalnum():
            raise ValueError("Username must be alphanumeric")
        return v
```

### Model Validators
```python
from pydantic import model_validator

class DateRange(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def validate_dates(self) -> "DateRange":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be after start_date")
        return self
```

## Computed Fields

### Pydantic Computed Fields
```python
from pydantic import computed_field

class Hero(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    first_name: str
    last_name: str

    @computed_field
    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
```

### SQLAlchemy Hybrid Properties
```python
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import declared_attr

class Product(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    price: float
    discount: float = 0

    @hybrid_property
    def discounted_price(self) -> float:
        return self.price * (1 - self.discount)
```

## Model Inheritance

### Schema Inheritance (No table=True)
```python
class HeroBase(SQLModel):
    name: str
    secret_name: str
    age: int | None = None

class HeroCreate(HeroBase):
    pass

class HeroUpdate(SQLModel):
    name: str | None = None
    secret_name: str | None = None
    age: int | None = None

class HeroPublic(HeroBase):
    id: int

class Hero(HeroBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
```

### Multiple Response Models
```python
class HeroPublic(HeroBase):
    id: int

class HeroPublicWithTeam(HeroPublic):
    team: "TeamPublic | None" = None
```

## Mixins

### Timestamp Mixin
```python
from datetime import datetime

class TimestampMixin(SQLModel):
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

### Soft Delete Mixin
```python
class SoftDeleteMixin(SQLModel):
    deleted_at: datetime | None = None
    is_deleted: bool = False
```

### Using Mixins
```python
class User(TimestampMixin, SoftDeleteMixin, SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    username: str
```

## Model Configuration

### Table Name
```python
class Hero(SQLModel, table=True):
    __tablename__ = "heroes"  # Custom table name
    id: int | None = Field(default=None, primary_key=True)
```

### Model Config
```python
class Hero(SQLModel, table=True):
    model_config = {"str_strip_whitespace": True}

    id: int | None = Field(default=None, primary_key=True)
    name: str
```

### Schema Extra (API Docs)
```python
class HeroCreate(SQLModel):
    name: str
    age: int | None = None

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"name": "Spider-Boy", "age": 18}
            ]
        }
    }
```
