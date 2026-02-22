---
name: db-operations
description: Database operations, PostgreSQL queries, Redis usage, migrations. Use when working with database issues, query optimization, schema changes, or Redis caching.
---

# Database Operations Guide

## PostgreSQL Basics

### Connection

The API uses a shared connection pool from `api/src/index.ts`:

```typescript
import { pool } from "../index";

// Query example
const result = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
```

### Common Queries

**Fetch user by ID**:
```sql
SELECT id, email, name, role, status, created_at, updated_at
FROM users WHERE id = $1;
```

**Fetch all users (paginated)**:
```sql
SELECT id, email, name, role, status, created_at
FROM users
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;
```

**Insert with returning**:
```sql
INSERT INTO tasks (title, user_id, status)
VALUES ($1, $2, 'pending')
RETURNING id, title, status, created_at;
```

**Update with timestamp**:
```sql
UPDATE users
SET name = $1, updated_at = NOW()
WHERE id = $2
RETURNING id, name, updated_at;
```

**Soft delete**:
```sql
UPDATE tasks
SET deleted_at = NOW()
WHERE id = $1;
```

## Redis Operations

Redis is used for:
- Token blacklisting (session management)
- Refresh token storage
- Password reset tokens
- Rate limiting

### Token Management

**Store refresh token**:
```typescript
import { storeRefreshToken } from "../utils/redis";
await storeRefreshToken(userId, tokenId, token, expirySeconds);
```

**Blacklist access token on logout**:
```typescript
import { blacklistAccessToken } from "../utils/redis";
await blacklistAccessToken(token, expirySeconds);
```

**Check if token is blacklisted**:
```typescript
import { isTokenBlacklisted } from "../utils/redis";
const blacklisted = await isTokenBlacklisted(token);
```

### Password Reset Tokens

**Store reset token**:
```typescript
import { storeResetToken } from "../utils/redis";
await storeResetToken(tokenHash, userId, 3600); // 1 hour expiry
```

**Retrieve reset token**:
```typescript
import { getResetToken } from "../utils/redis";
const userId = await getResetToken(tokenHash);
```

## Debugging Database Issues

### Connection Problems

- Check `DATABASE_URL` environment variable
- Verify PostgreSQL is running
- Check connection pool settings in `api/src/index.ts`

### Query Performance

- Use `EXPLAIN ANALYZE` for slow queries
- Add indexes on frequently filtered columns
- Check for missing foreign key indexes

### Common Errors

**"Connection refused"**: PostgreSQL not running or wrong port
**"Database does not exist"**: Create database or check connection string
**"Relation does not exist"**: Run migrations or create tables

## Direct Database Access

Connect to local database:
```bash
psql -U squadops -d squadops -h localhost -p 5432
```

Useful psql commands:
- `\dt` - List tables
- `\d table_name` - Describe table
- `\du` - List users/roles

## Transaction Support

```typescript
const client = await pool.connect();
try {
  await client.query("BEGIN");
  // Multiple operations
  await client.query("COMMIT");
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  client.release();
}
```
