"""Import side-effect module that registers every SQLModel table.

Alembic's env and ``init_db`` import this so that ``SQLModel.metadata`` knows
about all tables. Add new model modules here when you create them.
"""

from __future__ import annotations

from sqlmodel import SQLModel  # re-exported for convenience

# Importing the package imports each model module (see app/models/__init__.py).
import app.models  # noqa: F401

__all__ = ["SQLModel"]
