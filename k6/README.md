# k6 Load and Stress Tests

Tests for every endpoint in the Grocery Booking API. Each file is a standalone
k6 script. Run them individually for focused testing, or run them all in sequence.

---

## Prerequisites

Install k6:

```bash
# Linux
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# macOS
brew install k6

# Docker
docker pull grafana/k6
```

The API must be running before any test:

```bash
# in server/
pnpm start:dev
```

Seed groceries so order tests have items to work with:

```bash
pnpm seed:groceries
```

---

## Environment Variables

| Variable         | Default              | Description                        |
|------------------|----------------------|------------------------------------|
| `BASE_URL`       | `http://localhost:5000/api/v1` | API base URL            |
| `ADMIN_EMAIL`    | `admin@gmail.com`    | Admin account email                |
| `ADMIN_PASSWORD` | `Admin123!`          | Admin account password             |

Pass them with `-e`:

```bash
k6 run -e ADMIN_EMAIL=admin@example.com -e ADMIN_PASSWORD=secret 03-groceries-public.js
```

---

## Test Files

| File                      | Endpoints covered                                          | Peak VUs |
|---------------------------|------------------------------------------------------------|----------|
| `01-health.js`            | GET /health                                                | 200      |
| `02-auth.js`              | POST /auth/register, POST /auth/login                      | 30       |
| `03-groceries-public.js`  | GET /groceries, GET /groceries/:id                         | 300      |
| `04-orders.js`            | POST /orders, GET /orders, GET /orders/:id                 | 200      |
| `05-admin-groceries.js`   | All /admin/groceries CRUD + inventory                      | 45       |
| `stress.js`               | All endpoints mixed — ramps to 600 VUs to find limits      | 600      |

---

## Running Tests

### Individual load test

```bash
k6 run k6/01-health.js
k6 run k6/02-auth.js
k6 run k6/03-groceries-public.js
k6 run k6/04-orders.js
k6 run k6/05-admin-groceries.js
```

### Stress test

```bash
k6 run k6/stress.js
```

### Override VU count or duration

```bash
# Quick smoke test: 1 VU, 30 seconds
k6 run --vus 1 --duration 30s k6/03-groceries-public.js

# Spike: jump straight to 500 VUs for 1 minute
k6 run --vus 500 --duration 1m k6/stress.js
```

### With Grafana / InfluxDB output (real-time dashboard)

```bash
k6 run --out influxdb=http://localhost:8086/k6 k6/stress.js
```

---

## What Each Test Checks

### 01-health.js
- 200 OK under 200 VUs
- p(95) < 200ms

### 02-auth.js
- Register returns 201 with a token
- Duplicate register returns 409
- Login returns 200 with a token
- Wrong password returns 401
- Invalid email format returns 400

### 03-groceries-public.js
- List with search, sortBy, sortOrder, page — returns 200 with data array
- Plain list (hits Redis cache on second request)
- Single item by UUID — returns 200 with id field
- Invalid UUID — returns 400

### 04-orders.js
- Place order with 1–3 items — returns 201
- Replay same idempotency key — returns 201 (cached)
- Empty items array — returns 400
- List orders — returns 200
- Get single order by id — returns 200
- Invalid UUID — returns 400

### 05-admin-groceries.js
- List with includeDeleted=true/false — returns 200
- Get single item — returns 200
- Create item — returns 201
- Create with invalid data — returns 400
- Update price — returns 200
- Set stock — returns 200
- Set negative stock — returns 400
- Soft-delete — returns 200
- Delete already-deleted — returns 404

### stress.js
- Mixed traffic across all endpoints weighted by real-world usage
- Out-of-stock 409 on orders counted as valid under stress
- Ramps to 600 VUs over 15 minutes
- Thresholds: p(99) < 5s, error rate < 10%
