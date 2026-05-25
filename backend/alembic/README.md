Alembic Migrations
==================

This directory contains database migration scripts.

## Commands

```bash
# Create a new migration
alembic revision --autogenerate -m "description"

# Upgrade to latest
alembic upgrade head

# Downgrade
alembic downgrade -1

# Show current version
alembic current

# Show history
alembic history
```
