# Docker Compose Multi-Service Demo

Three services wired together with Compose: **nginx** (reverse proxy / load balancer),
**web** (Flask, stateless, scalable), and **db** (PostgreSQL 16 with a named volume).

The page at `/` shows a success message, whether the database connection worked, and
the hostname of the container that served the request — so reloading after
`--scale web=3` visibly bounces between replicas.

Two networks keep the services separated:

| network    | members     |
| ---------- | ----------- |
| `frontend` | nginx ↔ web |
| `backend`  | web ↔ db    |

nginx is **not** on `backend`, so it genuinely cannot reach `db`.

## Prerequisites

- Docker Engine + the Compose plugin (`docker compose version`)
- Host port `8080` free

## Bring it up

```bash
cp .env.example .env
docker compose up -d --build
```

Then open <http://localhost:8080>.

`web` waits for `db` to report healthy (`pg_isready`) before it starts —
`depends_on: condition: service_healthy`.

## Scaling

```bash
docker compose up -d --build --scale web=3
docker compose restart nginx
```

Reload the page a few times: the container name changes each request.

nginx resolves the `web` name once at startup, so restart it after changing the replica
count — that's why the `restart nginx` line is there.

## Proving the network isolation

```bash
# web can reach db
docker compose exec web python -c "import socket; socket.create_connection(('db', 5432), 3); print('web -> db OK')"

# nginx cannot — the name doesn't even resolve
docker compose exec nginx getent hosts db || echo "nginx -> db: no route, as designed"
```

## Environment variables (`.env`)

| Variable            | Example         | Used by                                |
| ------------------- | --------------- | -------------------------------------- |
| `POSTGRES_USER`     | `demo`          | db (`env_file`), web (`DATABASE_URL`)  |
| `POSTGRES_PASSWORD` | `demo_password` | db (`env_file`), web (`DATABASE_URL`)  |
| `POSTGRES_DB`       | `demo`          | db (`env_file`), web (`DATABASE_URL`)  |

`web` builds `DATABASE_URL` from those same three values via Compose variable
substitution, so the password is written down once.

## Endpoints

- `GET /` — the demo page
- `GET /health` — `{"status": "ok", "instance": "<container>"}`

## Tear down

```bash
docker compose down          # keep the database volume
docker compose down -v       # drop it too
```
