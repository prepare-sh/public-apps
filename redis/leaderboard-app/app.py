import os
import random

import redis
from flask import Flask, jsonify, request, send_from_directory

REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
PORT = int(os.environ.get("PORT", 5000))

# The Redis sorted set used by this demo.
# Inspect or reset it from the terminal with:
#   redis-cli ZRANGE leaderboard 0 -1 REV WITHSCORES
#   redis-cli DEL leaderboard
LEADERBOARD_KEY = os.environ.get("LEADERBOARD_KEY", "leaderboard")

# How often the frontend triggers a score update.
TICK_INTERVAL_SECONDS = float(
    os.environ.get("TICK_INTERVAL_SECONDS", 1.5)
)

SCORE_INCREMENT_MIN = int(
    os.environ.get("SCORE_INCREMENT_MIN", 50)
)

SCORE_INCREMENT_MAX = int(
    os.environ.get("SCORE_INCREMENT_MAX", 500)
)


app = Flask(__name__, static_folder="static")

r = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    decode_responses=True,
)


# ---- starting leaderboard ----

STARTING_PLAYERS = {
    "WhySoSerious_99": 14500,
    "KiraWasRight": 13200,
    "WiggleYourBigToe": 12840,
    "FirstRule_Shh": 12100,
    "Forgot-MYReal-Name": 11500,
    "ApplesAreMyRelief": 10450,
    "Ezekiel_2517": 9820,
    "SpaceCowboy_321": 9400,
    "Hey_SpideySense": 8910,
    "nomilk_nolife": 7650,
    "Shinigami_Gamer": 6420,
    "Evaaaa_Bot": 5180,
}


def reset_leaderboard():
    """Restore the sorted set to its starting scores."""

    r.delete(LEADERBOARD_KEY)

    # ZADD leaderboard <score> <player>
    r.zadd(LEADERBOARD_KEY, STARTING_PLAYERS)


def read_leaderboard():
    """Return players from highest score to lowest score."""

    # ZREVRANGE leaderboard 0 -1 WITHSCORES
    players = r.zrevrange(
        LEADERBOARD_KEY,
        0,
        -1,
        withscores=True,
    )

    return [
        {
            "rank": rank,
            "player": player,
            "score": int(score),
        }
        for rank, (player, score) in enumerate(players, start=1)
    ]


def increment_random_player():
    """Give a random player some points using ZINCRBY."""

    player = random.choice(list(STARTING_PLAYERS))

    amount = random.randint(
        SCORE_INCREMENT_MIN,
        SCORE_INCREMENT_MAX,
    )

    # ZINCRBY leaderboard <amount> <player>
    new_score = r.zincrby(
        LEADERBOARD_KEY,
        amount,
        player,
    )

    return {
        "player": player,
        "amount": amount,
        "score": int(new_score),
    }


@app.get("/api/leaderboard")
def get_leaderboard():
    try:
        return jsonify({
            "key": LEADERBOARD_KEY,
            "interval": TICK_INTERVAL_SECONDS,
            "players": read_leaderboard(),
        })
    except redis.RedisError as exc:
        return redis_down(exc)


@app.post("/api/tick")
def tick():
    """Increment one random player's score and return the new leaderboard."""

    try:
        update = increment_random_player()

        return jsonify({
            "update": update,
            "players": read_leaderboard(),
        })
    except redis.RedisError as exc:
        return redis_down(exc)


@app.get("/api/player/<player>")
def get_player(player):
    """Return a player's score and rank."""

    try:
        # ZSCORE leaderboard <player>
        score = r.zscore(LEADERBOARD_KEY, player)

        if score is None:
            return jsonify({"error": "Player not found"}), 404

        # ZREVRANK leaderboard <player>
        rank = r.zrevrank(LEADERBOARD_KEY, player)

        return jsonify({
            "player": player,
            "score": int(score),
            "rank": rank + 1,
        })
    except redis.RedisError as exc:
        return redis_down(exc)


@app.post("/api/reset")
def reset():
    """Restore all players to their starting scores."""

    try:
        reset_leaderboard()

        return jsonify({
            "message": "Leaderboard reset",
            "players": read_leaderboard(),
        })
    except redis.RedisError as exc:
        return redis_down(exc)


@app.get("/api/health")
def health():
    try:
        return jsonify({
            "status": "ok",
            "redis": r.ping(),
        })
    except redis.RedisError as exc:
        return jsonify({
            "status": "degraded",
            "redis": False,
            "error": str(exc),
        }), 503


def redis_down(exc):
    return jsonify({
        "error": (
            f"Redis unavailable at "
            f"{REDIS_HOST}:{REDIS_PORT} ({exc})"
        )
    }), 503


@app.errorhandler(Exception)
def json_errors(exc):
    """Keep /api/* responses JSON so the frontend never chokes on an HTML error page."""

    code = getattr(exc, "code", 500)

    if request.path.startswith("/api/"):
        return jsonify({
            "error": getattr(exc, "description", str(exc))
        }), code

    return (
        getattr(exc, "description", str(exc)),
        code,
    )


@app.get("/favicon.ico")
def favicon():
    return send_from_directory(
        app.static_folder,
        "favicon.ico",
    )


@app.get("/")
def index():
    return send_from_directory(
        app.static_folder,
        "index.html",
    )


if __name__ == "__main__":
    print(
        f" * Redis  {REDIS_HOST}:{REDIS_PORT}  "
        f"key={LEADERBOARD_KEY}"
    )

    app.run(
        host="0.0.0.0",
        port=PORT,
        debug=True,
        threaded=True,
    )