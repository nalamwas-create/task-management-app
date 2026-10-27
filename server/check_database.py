
from app import app, db
from sqlalchemy import inspect, text


def check_database():
    with app.app_context():
        print("=== TASK MANAGEMENT DATABASE ===")
        print("Database:", db.engine.url.database)

        inspector = inspect(db.engine)
        tables = inspector.get_table_names()

        print("\nTables found:")
        for table in tables:
            print(f"- {table}")

        # Display user records without exposing password hashes.
        if "users" in tables:
            print("\n=== USERS ===")
            users = db.session.execute(
                text("SELECT id, email FROM users")
            ).mappings().all()

            for user in users:
                print(dict(user))

            print("Total users:", len(users))

        # Display task records.
        if "tasks" in tables:
            print("\n=== TASKS ===")
            tasks = db.session.execute(
                text("""
                    SELECT id, title, description, status, user_id
                    FROM tasks
                    ORDER BY id
                """)
            ).mappings().all()

            for task in tasks:
                print(dict(task))

            print("Total tasks:", len(tasks))

        # Display migration version.
        if "alembic_version" in tables:
            version = db.session.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one_or_none()

            print("\nMigration version:", version)

        print("\nDatabase check complete.")


if __name__ == "__main__":
    check_database()
