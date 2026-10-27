# Task Management App

A full-stack task management application built with React, Flask, and SQLite. The application supports user registration, secure password hashing, JWT authentication, and personal task management.

## Features

- User registration and login
- Password hashing using Werkzeug
- JWT-based authentication
- Create, view, edit, complete, and delete tasks
- Task statuses: `Pending` and `Completed`
- User-specific tasks protected by authenticated ownership checks
- SQLite database managed with Flask-Migrate and Alembic
- Seed script for repeatable sample data
- Responsive React interface

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React 18, Vite, CSS |
| Backend | Python, Flask |
| Database | SQLite |
| ORM | Flask-SQLAlchemy |
| Database migrations | Flask-Migrate, Alembic |
| Authentication | Flask-JWT-Extended |
| Password security | Werkzeug password hashing |

## Project Structure

```text
task_manager/
├── README.md
├── .gitignore
├── frontend/
│   ├── package.json
│   ├── package-lock.json
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       ├── App.css
│       ├── index.css
│       └── main.jsx
└── server/
    ├── app.py
    ├── models.py
    ├── requirements.txt
    ├── seed.py
    └── migrations/
        ├── env.py
        └── versions/
            └── e56c7f6ac242_create_users_and_tasks_tables.py
```

The `.env` file, database files, backups, and virtual environment are local development files and should not be committed to the repository.

## Prerequisites

Install the following before setting up the application:

- Python 3.10 or newer
- Node.js and npm
- Git

## Backend Setup

From the project root, open a terminal and run:

```bash
cd server
python3 -m venv venv
source venv/bin/activate
python -m pip install -r requirements.txt
```

### Configure the environment

Create a local `.env` file containing a randomly generated JWT secret:

```bash
python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_hex(32))" > .env
```

Keep this file private. Never commit or share its contents.

### Create the database using migrations

From the `server` directory, with the virtual environment activated, run:

```bash
flask --app app db upgrade
```

This applies the migration files in `migrations/` and creates or updates the database schema.

The initial migration creates:

- `users` — registered accounts and password hashes
- `tasks` — tasks linked to their owners
- `alembic_version` — the migration revision currently applied

The application uses `server/instance/tasks.db` by default.

**Do not use `db.create_all()` as a replacement for migrations.** Use Flask-Migrate to manage schema changes.

### Seed the database

After applying migrations, run:

```bash
python seed.py
```

The seed script creates a demonstration account and sample tasks if they do not already exist.

Development demonstration credentials:

- Email: `demo@example.com`
- Password: `DemoPass123!`

These credentials are for local testing only. Change or remove the demonstration account before any public deployment.

Run the seed command again whenever needed; existing sample records should not be duplicated.

### Start the backend

From the `server` directory:

```bash
flask --app app run --debug
```

The API should be available at:

`http://127.0.0.1:5000`

Check the health endpoint:

```bash
curl http://127.0.0.1:5000/health
```

Expected response:

```json
{
  "status": "ok"
}
```

Keep this terminal running while using the frontend.

## Frontend Setup

Open a second terminal:

```bash
cd ~/webdev/task_manager/frontend
npm install
npm run build
npm run dev
```

Vite should display a local development URL, normally:

`http://localhost:5173`

Open that URL in your browser.

The frontend communicates with the Flask API at `http://127.0.0.1:5000`.

## Database Migrations

Apply pending migrations:

```bash
cd ~/webdev/task_manager/server
source venv/bin/activate
flask --app app db upgrade
```

Check the current migration revision:

```bash
flask --app app db current
```

The initial revision is:

`e56c7f6ac242`

When model changes require a new migration, generate and review it before applying:

```bash
flask --app app db migrate -m "Describe the schema change"
flask --app app db upgrade
```

Review generated migration files before applying them, especially when changing or removing existing columns.

## API Reference

All request and response bodies use JSON unless otherwise specified.

| Method | Endpoint | Purpose | Authentication |
|---|---|---|---|
| GET | `/health` | Check API health | Not required |
| POST | `/register` | Register a new account | Not required |
| POST | `/login` | Authenticate and receive a JWT | Not required |
| GET | `/me` | Retrieve the authenticated user's details | Required |
| GET | `/tasks` | List the current user's tasks | Required |
| POST | `/tasks` | Create a task | Required |
| PATCH | `/tasks/<id>` | Update a task | Required |
| DELETE | `/tasks/<id>` | Delete a task | Required |

### Register

`POST /register`

Example request:

```json
{
  "email": "user@example.com",
  "password": "StrongPass123!"
}
```

A successful registration returns HTTP `201 Created`.

Passwords must be at least eight characters long. Duplicate email addresses are rejected.

### Login

`POST /login`

Example request:

```json
{
  "email": "user@example.com",
  "password": "StrongPass123!"
}
```

A successful login returns an `access_token` and user details.

### Authenticated requests

Include the access token in the HTTP authorization header:

```text
Authorization: Bearer YOUR_ACCESS_TOKEN
```

Replace `YOUR_ACCESS_TOKEN` with the token returned by login. Do not share actual tokens in screenshots, reports, or public repositories.

### Create a task

`POST /tasks`

```json
{
  "title": "Finish project",
  "description": "Complete the documentation and tests.",
  "status": "Pending"
}
```

### Update a task

`PATCH /tasks/1`

```json
{
  "status": "Completed"
}
```

The task ID in this example is illustrative; use an ID belonging to the authenticated user.

Allowed statuses are `Pending` and `Completed`.

### Delete a task

`DELETE /tasks/1`

A successful deletion returns a confirmation message.

## Authentication and Authorization

- Passwords are stored as hashes rather than plaintext.
- Login returns a signed JWT access token.
- Protected endpoints require a valid JWT.
- Tokens expire after 12 hours.
- Tasks are associated with a `user_id`.
- Task listing filters records by the authenticated user's ID.
- Task updates and deletions check both the task ID and the authenticated user's ID.
- A user must not be able to view, modify, or delete another user's tasks by changing a task ID.

The frontend clears its locally stored authentication token when the user logs out. This is client-side logout; the current API does not implement a server-side token revocation endpoint.

## Testing Checklist

Complete these tests before submitting the project.

### Registration and login

- [ ] Register a new account.
- [ ] Confirm duplicate email registration is rejected.
- [ ] Attempt login with an incorrect password.
- [ ] Log in with the correct password.
- [ ] Confirm protected endpoints reject requests without a valid token.

### Task management

- [ ] Create a task.
- [ ] View the task in the list.
- [ ] Edit the title or description.
- [ ] Change its status from `Pending` to `Completed`.
- [ ] Change the status back to `Pending`.
- [ ] Delete a task.
- [ ] Confirm the task no longer appears after deletion.

### User isolation

- [ ] Register two different users.
- [ ] Create a task while authenticated as the first user.
- [ ] Confirm the second user cannot see that task.
- [ ] Attempt to update the first user's task using the second user's token; confirm the API returns `404`.
- [ ] Attempt to delete the first user's task using the second user's token; confirm the API returns `404`.

### Migrations and seeding

- [ ] Run `flask --app app db upgrade`.
- [ ] Check the current revision using `flask --app app db current`.
- [ ] Verify that a fresh database can be created by applying migrations.
- [ ] Run `python seed.py`.
- [ ] Run `python seed.py` again and confirm it does not duplicate the sample records.

### Frontend and build

- [ ] Confirm registration and login work from the browser.
- [ ] Confirm task operations work through the interface.
- [ ] Run `npm run build` successfully.

## Submission Evidence

Save genuine screenshots of the completed application in a submission evidence folder.

Recommended evidence:

1. **Login screen** — show the application's login interface.
2. **Task dashboard** — show sample tasks and their statuses.
3. **Task creation or editing** — demonstrate a successful task operation.
4. **Completed task** — show the `Completed` status.
5. **User isolation test** — show the second user's request being denied access to another user's task, with tokens and secrets hidden.
6. **Migration evidence** — show the migration revision and the successful fresh-database migration test.
7. **Build evidence** — show the successful `npm run build` output.

Use real screenshots from your own application and tests. Do not present an unperformed test as successful.

## Version Control and GitHub

From the project root:

```bash
cd ~/webdev/task_manager
git status --short
```

Review the files before committing. Ensure `.env`, database files, virtual environments, backups, and generated build files are excluded.

After verifying the `.gitignore` rules:

```bash
git add README.md .gitignore frontend server
git status --short
```

Review the staged files carefully before committing:

```bash
git commit -m "Build authenticated task management application"
```

Create a GitHub repository and follow GitHub's instructions to connect and push the local repository.

Never push `.env`, private keys, database files containing personal information, or authentication tokens.

## Limitations and Production Considerations

This is an educational project intended for local development. Before public deployment:

- Replace development secrets with secure deployment environment variables.
- Change or remove demonstration credentials.
- Use HTTPS.
- Review token storage and consider stronger token revocation or session management.
- Add automated backend and frontend tests.
- Configure production logging and error handling.
- Use a production-ready deployment server and assess database backup requirements.

## Project Status

The React production build has succeeded, the sample seed data has been created, and the initial database migration has been verified against a separate fresh SQLite database.

The user-ownership security test has also passed all four checks:
- A second user cannot see another user's task.
- A second user cannot edit another user's task.
- A second user cannot delete another user's task.
- The task remains accessible to its owner after the denied attempts.

## Submission Evidence

The `submission_evidence/` directory contains a written record of the
user-ownership security test. Capture genuine screenshots of the running
application, successful task operations, and the security-test results
if screenshots are required by the assignment.

## Final Verification Checklist

- [ ] Backend health endpoint responds successfully.
- [ ] User registration and login work.
- [ ] Authenticated users can create, view, update, and delete their own tasks.
- [ ] Task ownership isolation checks pass.
- [ ] Database migrations apply successfully.
- [ ] Frontend production build succeeds.
- [ ] README setup and API documentation are complete.
- [ ] No secrets, authentication tokens, or local database files are committed.
- [ ] Submission evidence is reviewed before pushing to GitHub.
