# Grocery Booking System — API Server

A REST API for managing grocery inventory and placing orders. Built with NestJS, PostgreSQL, and Redis.

---

## Requirements

- Node.js 20+
- pnpm
- Docker and Docker Compose v2

---

## Development

**1. Copy the environment file**

```bash
cp .env.example .env
```

The defaults in `.env.example` match the dev Docker Compose config, so no changes are needed for local development.

**2. Start the database and Redis**

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts PostgreSQL 15 on port 5432 and Redis 7 on port 6379. The API process runs on the host machine directly, not inside Docker, which gives faster TypeScript recompilation on file changes.

**3. Install dependencies**

```bash
pnpm install
```

**4. Start the API in watch mode**

```bash
pnpm start:dev
```

Migrations run automatically on startup. The server listens on `http://localhost:5000`.

**5. Seed the first admin account**

```bash
pnpm seed:admin
```

Credentials are read from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`. The script skips creation if an admin already exists, so it is safe to run more than once.

---

## Production

The production setup runs the API, PostgreSQL, and Redis together in Docker.

**1. Set environment variables**

```bash
cp .env.example .env
```

Edit `.env` before starting. Minimum required changes:

```
NODE_ENV=production
JWT_SECRET=<at least 64 random characters>
DB_PASSWORD=<strong password>
ADMIN_PASSWORD=<strong password>
ALLOWED_ORIGINS=https://your-frontend-domain.com
```

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**2. Start all services**

```bash
docker compose up -d --build
```

**3. Seed the admin account**

```bash
docker compose exec api pnpm seed:admin
```

The API is available on the port set by `PORT` in `.env` (default: 5000).

---

## Running Tests

```bash
# All unit tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:cov
```

---

## Swagger Docs

Only available when `NODE_ENV` is not `production`.

```
http://localhost:5000/api/v1/docs
```

OpenAPI JSON spec:

```
http://localhost:5000/api/v1/docs-json
```

---

## API Reference

All routes are prefixed with `/api/v1`.

| Method | Route                              | Auth         | Description                       |
|--------|------------------------------------|--------------|-----------------------------------|
| POST   | /auth/register                     | Public       | Create a user account             |
| POST   | /auth/login                        | Public       | Get a JWT access token            |
| GET    | /groceries                         | User         | List available grocery items      |
| GET    | /groceries/:id                     | User         | Get a single grocery item         |
| POST   | /orders                            | User         | Place an order                    |
| GET    | /orders                            | User         | List own orders (paginated)       |
| GET    | /orders/:id                        | User         | Get a single order                |
| GET    | /admin/groceries                   | Admin        | List all items including deleted  |
| GET    | /admin/groceries/:id               | Admin        | Get one item including deleted    |
| POST   | /admin/groceries                   | Admin        | Create a grocery item             |
| PATCH  | /admin/groceries/:id               | Admin        | Update item name/description/price|
| PATCH  | /admin/groceries/:id/inventory     | Admin        | Set stock level                   |
| DELETE | /admin/groceries/:id               | Admin        | Soft-delete an item               |
| GET    | /health                            | Public       | Liveness and readiness probe      |

---

## Architecture Diagram

```
                         HTTP Clients
                              |
                     [ NestJS API :5000 ]
                              |
            ┌─────────────────┼─────────────────┐
            |                 |                 |
     [ ThrottlerGuard ] [ JwtAuthGuard ] [ RolesGuard ]
            |                 |                 |
            └─────────────────┼─────────────────┘
                              |
               ┌──────────────┼──────────────┐
               |              |              |
         [ Controllers ]  [ Interceptor ] [ Filter ]
               |              |              |
               └──────────────┼──────────────┘
                              |
            ┌─────────────────┼──────────────────┐
            |                                    |
     [ Command Services ]          [ Query Services ]
            |                                    |
      (write path)                         (read path)
            |                                    |
     ┌──────┴──────┐                  ┌──────────┴──────────┐
     |             |                  |                     |
  [ Redis ]  [ PostgreSQL ]        [ Redis ]          [ PostgreSQL ]
  Layer 1     Layer 2 + 3          cache hit            cache miss
  pre-check   SELECT FOR UPDATE    (60s TTL)            fallback
              + CHECK constraint


[ BullMQ Workers ] — run inside the same process, use Redis db1
     |
     ├── order-queue    -> SEND_ORDER_CONFIRMATION
     └── inventory-queue -> CHECK_LOW_STOCK (deduped by jobId)


[ AuditService ] — fire-and-forget writes to audit_logs on every action
```

---

## Component Decisions and System Design

### NestJS

NestJS was chosen for its module-based structure and dependency injection container. The DI container allows swapping real services with mocks in unit tests without patching globals. Each module (auth, groceries, orders, queues, audit) has a hard boundary enforced at the framework level, not just by convention. Decorator-based routing and guard/interceptor/filter hooks keep HTTP concerns separate from business logic.

### PostgreSQL 15

The data has clear relational structure: users place orders, orders contain order items, order items reference grocery items at a fixed price. PostgreSQL gives ACID transactions, row-level locking (`SELECT FOR UPDATE`), `CHECK` constraints, and `JSONB` columns. All three are required for the overselling prevention logic and the audit trail. The `CHECK` constraint on `stock >= 0` acts as a hard floor that no application-level bug can breach.

### Redis — single instance, two logical databases

Redis serves two separate purposes, kept on separate database indexes:

- **db0** — grocery list cache (60s TTL), stock counters for atomic pre-checks, idempotency key storage (24h TTL).
- **db1** — BullMQ job queue.

Separating them by database index means BullMQ's key patterns do not pollute the cache namespace. Cache invalidation uses `SCAN` + `UNLINK` in cursor loops — never `KEYS *`, which blocks Redis.

Redis is not the authoritative source for stock levels. It is a fast rejection layer. If a stock counter is missing, the system falls through to the database lock.

### BullMQ

After a database transaction commits, two async jobs are enqueued: an order confirmation and a low-stock check per ordered item. These run outside the HTTP request cycle, so they cannot slow down or break the booking response. BullMQ handles retries with exponential backoff. The low-stock check uses a deterministic `jobId` (`low-stock-{itemId}`) so that multiple simultaneous orders for the same item result in one alert job, not many.

### Three-layer overselling prevention

A single database lock is correct but creates a queue of waiting transactions under concurrent load. The layers reduce contention progressively:

**Layer 1 — Redis DECRBY (before the transaction)**
Atomically decrements the stock counter. If the result goes negative, the request is rejected immediately without touching PostgreSQL. All previously decremented counters are rolled back. If the counter does not exist (cache miss), this layer is skipped entirely and the system falls through to the database.

**Layer 2 — SELECT FOR UPDATE sorted by item ID ASC (inside the transaction)**
Acquires row-level locks in consistent ascending ID order. Consistent lock ordering prevents deadlocks when two concurrent orders share some of the same items. After locking, the DB stock value is checked again as the authoritative source.

**Layer 3 — CHECK constraint `stock >= 0` (database level)**
A hard constraint that rejects any `UPDATE` that would make stock negative. This protects against application bugs that bypass Layers 1 and 2.

### Idempotency key

Clients send an `Idempotency-Key` header (max 128 characters, validated in the controller) with a POST to `/orders`. On the first request, the order is created and the response is cached in Redis for 24 hours keyed by `userId + idempotencyKey`. On a retry with the same key, the cached response is returned without touching the database or decrementing stock. A `UNIQUE` constraint on the `idempotency_key` column in the database acts as a backup guarantee if the Redis cache is lost.

### Price snapshot on order items

The `unit_price` column on each order item is copied from the grocery item at the moment the order is placed and never updated afterward. If the grocery item's price changes the next day, existing orders still reflect what was actually charged. This also makes the audit trail accurate without needing to join to the current grocery item price.

### Soft delete on grocery items

Grocery items are never physically deleted. The `deleted_at` timestamp is set instead. This preserves referential integrity — order items reference grocery items by foreign key, and those references must remain valid for display and audit purposes even after the item is removed from the storefront.

### Audit log

Every state-changing operation writes a record to `audit_logs` with: actor identity, IP address, request ID, entity before state, entity after state, and success or failure. The write is fire-and-forget — a failed audit write never rolls back the business operation. The table is append-only; no application code updates or deletes audit records.

### JWT authentication

The JWT is stateless and verified on every request by the `JwtAuthGuard`. The 15-minute expiry limits the exposure window of a leaked token. There is no refresh token in v1 — acceptable for the scope of this assignment.

### Rate limiting

Three named throttlers restrict request rates per IP:

| Throttler | Limit | Window | Applied to           |
|-----------|-------|--------|----------------------|
| global    | 100   | 60s    | All routes           |
| login     | 10    | 60s    | POST /auth/login     |
| register  | 5     | 60s    | POST /auth/register  |
| orders    | 20    | 60s    | POST /orders         |

Tighter limits on auth routes reduce brute-force risk. The orders limit reduces the damage from a client bug that loops requests.

### Health check

`GET /health` (public, no auth) runs two checks in parallel: a PostgreSQL ping via TypeORM and a Redis `PING` command. Returns HTTP 200 when both pass, HTTP 503 when either fails. Used by load balancers and container orchestrators to detect unhealthy instances without requiring application-level knowledge.
