import os
import json
import time
import threading

import redis
from flask import Flask, jsonify, request, send_from_directory

REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
PORT = int(os.environ.get("PORT", 5000))
CACHE_TTL_SECONDS = int(os.environ.get("CACHE_TTL_SECONDS", 60))
SIMULATED_DB_DELAY_SECONDS = float(os.environ.get("SIMULATED_DB_DELAY_SECONDS", 1.2))

# The one Redis key this whole demo revolves around: the cached product JSON.
# Inspect it from the terminal with:  redis-cli GET product:1
#                                     redis-cli TTL product:1
#                                     redis-cli DEL product:1
CACHE_KEY = "product:1"

app = Flask(__name__, static_folder="static")
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)


# --------------------------------------------------------------------------
# The "database"
# --------------------------------------------------------------------------
# A plain dict behind a lock -- stand-in for a real database (Postgres, MySQL,
# whatever). The only things that matter for the lesson are that it lives
# somewhere other than Redis, and that reading it is slow.

_db_lock = threading.Lock()
_DB = {"id": 1, "name": "Wireless Headphones", "price": 79.99}


def db_read_product():
    """Read the product from the database. Deliberately slow."""
    time.sleep(SIMULATED_DB_DELAY_SECONDS)  # pretend this is a real query
    with _db_lock:
        return dict(_DB)


def db_write_price(price):
    """Write the new price to the database and return the updated row."""
    with _db_lock:
        _DB["price"] = price
        return dict(_DB)


# --------------------------------------------------------------------------
# The read path -- cache-aside, identical in all three modes
# --------------------------------------------------------------------------
# The three modes differ only in what the *write* does. The read never changes:
# look in Redis, and on a miss fall back to the database and populate the cache.

def read_product_cache_aside():
    cached = r.get(CACHE_KEY)                                    # GET product:1

    if cached:
        return json.loads(cached), "hit", r.ttl(CACHE_KEY)       # TTL product:1

    product = db_read_product()                                  # slow DB read
    r.set(CACHE_KEY, json.dumps(product), ex=CACHE_TTL_SECONDS)  # SET product:1 EX 60
    return product, "miss", CACHE_TTL_SECONDS


# --------------------------------------------------------------------------
# The three write paths -- one function each, deliberately not shared
# --------------------------------------------------------------------------
# Each one is short enough to read aloud. The duplication is on purpose: on
# screen you want to compare three whole functions, not three branches.

def write_no_invalidation(price):
    """Mode 1 -- the bug. Write the DB, leave the cache completely alone."""
    product = db_write_price(price)
    # Nothing happens to Redis here. product:1 still holds the OLD price and
    # will keep serving it to every reader until its TTL runs out.
    return product, ["DB write"]


def write_with_invalidation(price):
    """Mode 2 -- the fix. Write the DB, then delete the stale cache entry."""
    product = db_write_price(price)
    r.delete(CACHE_KEY)                                          # DEL product:1
    # The next read misses, falls through to the DB, and re-caches the new price.
    return product, ["DB write", "DEL " + CACHE_KEY]


def write_through(price):
    """Mode 3 -- write-through. Write the DB and the cache in one operation."""
    product = db_write_price(price)
    r.set(CACHE_KEY, json.dumps(product), ex=CACHE_TTL_SECONDS)  # SET product:1 EX 60
    # The cache is never stale, not even for the instant between the two writes,
    # and the next read is a HIT rather than a forced miss. Note that the SET
    # also restarts the TTL countdown.
    return product, ["DB write", "SET {} EX {}".format(CACHE_KEY, CACHE_TTL_SECONDS)]


MODES = {
    "no-invalidation": write_no_invalidation,
    "invalidate-on-write": write_with_invalidation,
    "write-through": write_through,
}

# Which write path the admin form currently uses. This is demo configuration,
# not cached data, so it lives in the process -- never in Redis.
current_mode = "no-invalidation"


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------

@app.get("/api/product")
def get_product():
    """Storefront read. Always cache-aside, whatever the mode is."""
    try:
        product, source, ttl = read_product_cache_aside()
        return jsonify({"source": source, "ttl": ttl, "key": CACHE_KEY, "product": product})
    except redis.RedisError as exc:
        return jsonify({"error": f"Redis unavailable at {REDIS_HOST}:{REDIS_PORT} ({exc})"}), 503


@app.post("/api/admin/update-price")
def update_price():
    """Admin write. The active mode decides what happens to the cache."""
    payload = request.get_json(silent=True) or {}
    try:
        price = round(float(payload.get("price")), 2)
    except (TypeError, ValueError):
        return jsonify({"error": "price must be a number"}), 400
    if price < 0:
        return jsonify({"error": "price must be zero or more"}), 400

    try:
        write = MODES[current_mode]
        product, ops = write(price)
        return jsonify(
            {"mode": current_mode, "ops": ops, "product": product, "ttl": r.ttl(CACHE_KEY)}
        )
    except redis.RedisError as exc:
        return jsonify({"error": f"Redis unavailable at {REDIS_HOST}:{REDIS_PORT} ({exc})"}), 503


@app.post("/api/admin/set-mode")
def set_mode():
    global current_mode
    payload = request.get_json(silent=True) or {}
    mode = payload.get("mode")
    if mode not in MODES:
        return jsonify({"error": f"unknown mode: {mode}", "modes": list(MODES)}), 400
    current_mode = mode
    return jsonify({"mode": current_mode})


@app.get("/api/mode")
def get_mode():
    """Current mode plus the database's real price -- what the admin page loads with."""
    with _db_lock:
        product = dict(_DB)
    try:
        ttl = r.ttl(CACHE_KEY)
    except redis.RedisError:
        ttl = None
    return jsonify({"mode": current_mode, "modes": list(MODES), "product": product, "ttl": ttl})


@app.post("/api/admin/reset")
def reset():
    """Back to the starting state between takes: 79.99 in the DB, empty cache."""
    db_write_price(79.99)
    try:
        r.delete(CACHE_KEY)
    except redis.RedisError as exc:
        return jsonify({"error": f"Redis unavailable at {REDIS_HOST}:{REDIS_PORT} ({exc})"}), 503
    return jsonify({"ok": True, "ops": ["DB write", "DEL " + CACHE_KEY]})


@app.get("/api/health")
def health():
    try:
        return jsonify({"status": "ok", "redis": r.ping()})
    except redis.RedisError as exc:
        return jsonify({"status": "degraded", "redis": False, "error": str(exc)}), 503


@app.errorhandler(Exception)
def json_errors(exc):
    """Keep /api/* responses JSON so the frontend never chokes on an HTML error page."""
    code = getattr(exc, "code", 500)
    if request.path.startswith("/api/"):
        return jsonify({"error": getattr(exc, "description", str(exc))}), code
    return (getattr(exc, "description", str(exc)), code)


@app.get("/favicon.ico")
def favicon():
    return send_from_directory(app.static_folder, "favicon.ico")


@app.get("/")
def storefront():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/admin")
def admin():
    return send_from_directory(app.static_folder, "admin.html")


if __name__ == "__main__":
    print(
        f" * Redis  {REDIS_HOST}:{REDIS_PORT}  key={CACHE_KEY}  "
        f"ttl={CACHE_TTL_SECONDS}s  db_delay={SIMULATED_DB_DELAY_SECONDS}s  mode={current_mode}"
    )
    app.run(host="0.0.0.0", port=PORT, debug=True, threaded=True)
