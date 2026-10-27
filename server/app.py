
import os
from datetime import timedelta
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, g, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_jwt_identity,
    jwt_required,
)
from flask_migrate import Migrate
from sqlalchemy import inspect

from models import db, User, Task


# Load environment variables from server/.env
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

# Create the Flask application
app = Flask(__name__, instance_relative_config=True)
os.makedirs(app.instance_path, exist_ok=True)

# Use DATABASE_URL when supplied (for isolated tests or deployment).
# Otherwise, use the normal local SQLite database.
default_database = "sqlite:///" + os.path.join(
    app.instance_path, "tasks.db"
)
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", default_database
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=12)

if not app.config["JWT_SECRET_KEY"]:
    raise RuntimeError(
        "JWT_SECRET_KEY is missing. Check the server/.env file."
    )

# Allow the local frontend to communicate with the API.
CORS(app, origins=["http://localhost:5173"])

# Initialize extensions.
db.init_app(app)
migrate = Migrate(app, db)
jwt_manager = JWTManager(app)


def error(message, status):
    """Return a consistent JSON error response."""
    return jsonify({"error": message}), status


def task_to_dict(task):
    """Convert a task to JSON-safe data."""
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "user_id": task.user_id,
    }


def login_required(view):
    """Require a valid JWT and an existing user."""
    @wraps(view)
    @jwt_required()
    def wrapped(*args, **kwargs):
        try:
            g.user_id = int(get_jwt_identity())
        except (TypeError, ValueError):
            return error("Invalid token identity", 401)

        user = db.session.get(User, g.user_id)
        if user is None:
            return error("User not found", 401)

        return view(*args, **kwargs)

    return wrapped


@app.get("/health")
def health():
    return jsonify({"status": "ok"}), 200


@app.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = data.get("password", "")

    if not email or not isinstance(password, str):
        return error("Email and password are required.", 400)

    if len(password) < 8:
        return error("Password must be at least 8 characters.", 400)

    if User.query.filter_by(email=email).first():
        return error("An account with this email already exists.", 409)

    user = User(email=email)
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    return jsonify({
        "message": "Registration successful.",
        "user": {"id": user.id, "email": user.email},
    }), 201


@app.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = data.get("password", "")

    user = User.query.filter_by(email=email).first()

    if not user or not isinstance(password, str):
        return error("Invalid email or password.", 401)

    if not user.check_password(password):
        return error("Invalid email or password.", 401)

    token = create_access_token(identity=str(user.id))

    return jsonify({
        "access_token": token,
        "user": {"id": user.id, "email": user.email},
    }), 200


@app.get("/me")
@login_required
def me():
    user = db.session.get(User, g.user_id)
    return jsonify({
        "user": {"id": user.id, "email": user.email}
    }), 200


@app.get("/tasks")
@login_required
def get_tasks():
    tasks = (
        Task.query.filter_by(user_id=g.user_id)
        .order_by(Task.id.desc())
        .all()
    )
    return jsonify([task_to_dict(task) for task in tasks]), 200


@app.post("/tasks")
@login_required
def create_task():
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    description = str(data.get("description", "")).strip()
    status = data.get("status", "Pending")

    if not title:
        return error("Task title is required.", 400)

    if len(title) > 200:
        return error("Task title must be 200 characters or fewer.", 400)

    if status not in ("Pending", "Completed"):
        return error("Status must be Pending or Completed.", 400)

    task = Task(
        title=title,
        description=description,
        status=status,
        user_id=g.user_id,
    )
    db.session.add(task)
    db.session.commit()

    return jsonify(task_to_dict(task)), 201


@app.patch("/tasks/<int:task_id>")
@login_required
def update_task(task_id):
    task = Task.query.filter_by(
        id=task_id,
        user_id=g.user_id,
    ).first()

    if task is None:
        return error("Task not found.", 404)

    data = request.get_json(silent=True) or {}

    if "title" in data:
        title = str(data["title"]).strip()
        if not title:
            return error("Task title cannot be empty.", 400)
        if len(title) > 200:
            return error(
                "Task title must be 200 characters or fewer.", 400
            )
        task.title = title

    if "description" in data:
        task.description = str(data["description"]).strip()

    if "status" in data:
        if data["status"] not in ("Pending", "Completed"):
            return error("Status must be Pending or Completed.", 400)
        task.status = data["status"]

    db.session.commit()
    return jsonify(task_to_dict(task)), 200


@app.delete("/tasks/<int:task_id>")
@login_required
def delete_task(task_id):
    task = Task.query.filter_by(
        id=task_id,
        user_id=g.user_id,
    ).first()

    if task is None:
        return error("Task not found.", 404)

    db.session.delete(task)
    db.session.commit()

    return jsonify({"message": "Task deleted successfully."}), 200


if __name__ == "__main__":
    app.run(debug=True)

