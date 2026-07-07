from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict
from datetime import datetime

from flask import Flask, redirect, render_template, request, session, url_for

from services.project_routes import project_bp
from services.project_service import ProjectService

# Try to import APScheduler; set flag if unavailable
try:
    from apscheduler.schedulers.background import BackgroundScheduler
    HAS_APSCHEDULER = True
except ImportError:
    HAS_APSCHEDULER = False


def ensure_seed_user(data_dir: Path) -> None:
    users_file = data_dir / "users.json"
    username = os.getenv("APP_ADMIN_USERNAME", "TestUser")
    password = os.getenv("APP_ADMIN_PASSWORD", "TestUser@123")

    payload: Dict[str, Any] = {"users": []}
    if users_file.exists():
        try:
            payload = json.loads(users_file.read_text(encoding="utf-8"))
            if "users" not in payload or not isinstance(payload["users"], list):
                payload = {"users": []}
        except Exception:
            payload = {"users": []}

    existing = None
    for user in payload["users"]:
        if user.get("username") == username:
            existing = user
            break

    if existing:
        existing["password"] = password
        existing["role"] = "Admin"
        existing["permissions"] = ["create", "read", "update", "delete"]
    else:
        payload["users"].append(
            {
                "username": username,
                "password": password,
                "role": "Admin",
                "permissions": ["create", "read", "update", "delete"],
            }
        )

    data_dir.mkdir(parents=True, exist_ok=True)
    users_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_users(data_dir: Path) -> Dict[str, Any]:
    users_file = data_dir / "users.json"
    if not users_file.exists():
        return {"users": []}
    try:
        payload = json.loads(users_file.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else {"users": []}
    except Exception:
        return {"users": []}


app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "change-me-secret")
app.config["SESSION_PERMANENT"] = False

data_dir = Path(os.getenv("DATA_DIR", "data"))
ensure_seed_user(data_dir)

# Initialize project service for scheduler
project_service = ProjectService(data_dir=str(data_dir))

# Load configuration
config_file = Path("config.json")
config: Dict[str, Any] = {}
if config_file.exists():
    try:
        config = json.loads(config_file.read_text(encoding="utf-8"))
    except Exception:
        config = {}

scheduler_enabled = config.get("scheduler", {}).get("enabled", True) and HAS_APSCHEDULER
scheduler = None

# Set up background notification scheduler only if enabled and available
if scheduler_enabled:
    scheduler = BackgroundScheduler()

    def run_scheduled_notifications() -> None:
        """Run notification cycle on schedule (no logging to avoid verbosity)."""
        try:
            project_service.run_notification_cycle()
        except Exception as e:
            print(f"Scheduled notification error: {e}")

    # Get schedule config
    schedule_config = config.get("scheduler", {})
    hour = schedule_config.get("hour", 6)
    minute = schedule_config.get("minute", 0)

    # Schedule daily at specified time
    scheduler.add_job(
        run_scheduled_notifications,
        trigger="cron",
        hour=hour,
        minute=minute,
        id="daily_notifications",
        name="Daily Notification Cycle",
        replace_existing=True,
    )
    scheduler.start()
    print(f"[OK] Notification scheduler started - runs daily at {hour:02d}:{minute:02d}")
elif HAS_APSCHEDULER:
    print("[WARNING] Notification scheduler disabled in config.json")
else:
    print("[WARNING] APScheduler not installed - notifications disabled. Run: pip install apscheduler")
    print("   Or set scheduler.enabled=false in config.json to suppress this warning.")

app.register_blueprint(project_bp)


def is_logged_in() -> bool:
    return bool(session.get("auth_user"))


@app.context_processor
def inject_auth() -> Dict[str, Any]:
    """Make auth_user and role available in every template automatically."""
    return {
        "auth_user": session.get("auth_user", ""),
        "role": session.get("role", ""),
    }


@app.get("/")
def index() -> Any:
    """Always open the dashboard as the default view."""
    return redirect(url_for("dashboard"))


@app.route("/login", methods=["GET", "POST"])
def login() -> Any:
    if request.method == "GET":
        if is_logged_in():
            return redirect(url_for("dashboard"))
        return render_template("login.html", error=None)

    username = (request.form.get("username") or "").strip()
    password = request.form.get("password") or ""
    users = load_users(data_dir).get("users", [])

    for user in users:
        if user.get("username") == username and user.get("password") == password:
            session["auth_user"] = username
            session["role"] = user.get("role", "Admin")
            return redirect(url_for("dashboard"))

    return render_template("login.html", error="Invalid credentials")


@app.get("/logout")
def logout() -> Any:
    session.clear()
    return redirect(url_for("dashboard"))


@app.get("/dashboard")
def dashboard() -> Any:
    """Public dashboard — auth context injected via context_processor."""
    current_year = datetime.now().year
    lovs = project_service.get_form_lovs()
    return render_template(
        "dashboard.html",
        current_year=current_year,
        next_year=current_year + 1,
        lovs=lovs,
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
