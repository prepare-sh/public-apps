import os
import time
import json
import random

import redis
from flask import Flask, jsonify, request, send_from_directory

REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
PORT = int(os.environ.get("PORT", 5000))
CACHE_TTL_SECONDS = int(os.environ.get("CACHE_TTL_SECONDS", 30))
SIMULATED_DELAY_SECONDS = float(os.environ.get("SIMULATED_DELAY_SECONDS", 2))

# The Redis key the report is cached under.
# Clear it from the terminal with:  redis-cli DEL report
CACHE_KEY = "report"

app = Flask(__name__, static_folder="static")
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)


def build_report():
    """Pretend this is an expensive database query / aggregation."""
    time.sleep(SIMULATED_DELAY_SECONDS)
    return {
        "title": "Quarterly Revenue Report",
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "rows": [
            {"region": "North America", "revenue": random.randint(80_000, 120_000)},
            {"region": "Europe", "revenue": random.randint(60_000, 90_000)},
            {"region": "Asia Pacific", "revenue": random.randint(40_000, 70_000)},
        ],
    }


@app.get("/api/report")
def get_report():
    try:
        # ---- cache-aside pattern ----
        cached = r.get(CACHE_KEY)

        if cached:
            return jsonify({"source": "cache", "ttl": r.ttl(CACHE_KEY), "data": json.loads(cached)})

        report = build_report()
        r.set(CACHE_KEY, json.dumps(report), ex=CACHE_TTL_SECONDS)
        return jsonify({"source": "computed", "ttl": CACHE_TTL_SECONDS, "data": report})
        # -----------------------------
    except redis.RedisError as exc:
        # Redis is down / unreachable -- say so in JSON so the UI can show it.
        return jsonify({"error": f"Redis unavailable at {REDIS_HOST}:{REDIS_PORT} ({exc})"}), 503


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
    # Tiny inline SVG favicon -- avoids the browser's 404 on /favicon.ico
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
        '<rect width="32" height="32" rx="7" fill="#dc382c"/>'
        '<text x="16" y="23" font-size="19" font-family="Georgia,serif" '
        'font-weight="700" fill="#fff6f4" text-anchor="middle">R</text></svg>'
    )
    return app.response_class(svg, mimetype="image/svg+xml")


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    print(f" * Redis  {REDIS_HOST}:{REDIS_PORT}  key={CACHE_KEY}  ttl={CACHE_TTL_SECONDS}s  delay={SIMULATED_DELAY_SECONDS}s")
    app.run(host="0.0.0.0", port=PORT, debug=True)
