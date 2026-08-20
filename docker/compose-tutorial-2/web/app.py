import os
import socket
import time

import psycopg2
from flask import Flask

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://demo:demo@db:5432/demo")
PORT = int(os.environ.get("PORT", 5000))

# Which container answered: this is what makes `--scale web=3` visible on screen.
INSTANCE = os.environ.get("HOSTNAME", socket.gethostname())

app = Flask(__name__)

PAGE_CSS = """
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    background: #0A0E14;
    padding: 64px 24px;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    position: relative;
    overflow-x: hidden;
  }
  .glow {
    position: absolute;
    top: -180px;
    left: 50%;
    transform: translateX(-50%);
    width: 900px;
    height: 500px;
    background: radial-gradient(closest-side, rgba(76, 134, 201, 0.16), transparent 70%);
    pointer-events: none;
  }
  .wrap { max-width: 720px; margin: 0 auto; position: relative; }

  .eyebrow {
    display: inline-block;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #4C86C9;
    margin-bottom: 12px;
  }
  h1 {
    font-family: 'Georgia', 'Iowan Old Style', ui-serif, serif;
    font-size: 40px;
    font-weight: 600;
    color: #E8EFF7;
    margin: 0 0 12px;
    letter-spacing: -0.01em;
  }
  .lede {
    font-size: 15px;
    color: #8B99AC;
    margin: 0 0 28px;
    line-height: 1.65;
  }
  .divider {
    height: 1px;
    background: linear-gradient(90deg, #212A36, transparent 70%);
    margin: 0 0 28px;
  }

  .card {
    background: #12171F;
    border: 1px solid #1E2530;
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }
  .label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #6B7789;
    margin: 0 0 12px;
  }
  .instance {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 28px;
    font-weight: 700;
    color: #7FB3E8;
    letter-spacing: -0.01em;
    margin: 0;
  }

  .badge {
    display: inline-block;
    font-size: 12px;
    font-weight: 700;
    padding: 5px 14px;
    border-radius: 9999px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .ok {
    background: rgba(76, 134, 201, 0.14);
    color: #8FC0F0;
    border: 1px solid rgba(76, 134, 201, 0.38);
  }
  .bad {
    background: rgba(201, 82, 74, 0.1);
    color: #E29A93;
    border: 1px solid rgba(201, 82, 74, 0.35);
  }
  .version {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 12.5px;
    color: #6B7789;
    line-height: 1.6;
    margin: 14px 0 0;
    word-break: break-word;
  }

  .hint {
    font-size: 13px;
    color: #5C687A;
    margin: 24px 0 0;
    letter-spacing: 0.02em;
  }
"""


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
        db_status = "NOT CONNECTED"
        db_class = "bad"
        version = str(error)
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
    <style>{PAGE_CSS}</style>
  </head>
  <body>
    <div class="glow"></div>
    <div class="wrap">
      <span class="eyebrow">Docker Compose</span>
      <h1>It works.</h1>
      <p class="lede">
        nginx is load balancing across the web replicas, and this replica reached
        Postgres on the backend network.
      </p>
      <div class="divider"></div>

      <div class="card">
        <p class="label">Served by container</p>
        <p class="instance">{INSTANCE}</p>
      </div>

      <div class="card">
        <p class="label">Database</p>
        <span class="badge {db_class}">{db_status}</span>
        <p class="version">{version}</p>
      </div>

      <p class="hint">Reload the page to see the load balancer pick another container.</p>
    </div>
  </body>
</html>"""


@app.get("/health")
def health():
    return {"status": "ok", "instance": INSTANCE}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)
