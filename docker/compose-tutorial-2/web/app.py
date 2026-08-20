import os
import socket
import time

import psycopg2
from flask import Flask

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://demo:demo@db:5432/demo")
PORT = int(os.environ.get("PORT", 5000))

# Which container answered — this is what makes `--scale web=3` visible on screen.
INSTANCE = os.environ.get("HOSTNAME", socket.gethostname())

app = Flask(__name__)


def connect_with_retry(attempts=5, delay=1):
    """Try the database a few times before giving up, so a slow db doesn't
    kill the request. Compose healthchecks are what really order startup."""
    last_error = None
    for attempt in range(1, attempts + 1):
        try:
            return psycopg2.connect(DATABASE_URL, connect_timeout=3), None
        except psycopg2.OperationalError as error:
            last_error = error
            print(f"db connection attempt {attempt}/{attempts} failed: {error}")
            time.sleep(delay)
    return None, last_error


@app.get("/")
def index():
    conn, error = connect_with_retry()

    if conn is None:
        db_status = f"NOT CONNECTED — {error}"
        db_class = "bad"
        version = "-"
    else:
        with conn.cursor() as cur:
            cur.execute("SELECT version()")
            version = cur.fetchone()[0]
        conn.close()
        db_status = "CONNECTED"
        db_class = "ok"

    return f"""<!doctype html>
<html>
  <head>
    <title>Compose Multi-Service Demo</title>
    <style>
      body {{ font-family: system-ui, sans-serif; margin: 4rem auto; max-width: 40rem; }}
      .instance {{ font-size: 2rem; font-family: monospace; }}
      .ok {{ color: green; }}
      .bad {{ color: red; }}
    </style>
  </head>
  <body>
    <h1>It works.</h1>
    <p>Served by container <span class="instance">{INSTANCE}</span></p>
    <p>Database: <strong class="{db_class}">{db_status}</strong></p>
    <p><small>{version}</small></p>
    <p><small>Reload the page to see the load balancer pick another container.</small></p>
  </body>
</html>"""


@app.get("/health")
def health():
    return {"status": "ok", "instance": INSTANCE}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)
