
from app import app
from models import db, User, Task


def seed_database():
    """Add sample data without duplicating it on repeated runs."""

    with app.app_context():
        # Create the sample user if it does not already exist.
        user = User.query.filter_by(
            email="demo@example.com"
        ).first()

        if user is None:
            user = User(email="demo@example.com")
            user.set_password("DemoPass123!")
            db.session.add(user)
            db.session.flush()
            print("Created demo user.")
        else:
            print("Demo user already exists.")

        # Add sample tasks only when they are missing.
        sample_tasks = [
            {
                "title": "Complete project documentation",
                "description": "Document setup, API routes, and security.",
                "status": "Pending",
            },
            {
                "title": "Test task management",
                "description": "Verify creating, editing, and deleting tasks.",
                "status": "Pending",
            },
            {
                "title": "Review completed work",
                "description": "Check the project before submission.",
                "status": "Completed",
            },
        ]

        for item in sample_tasks:
            existing_task = Task.query.filter_by(
                user_id=user.id,
                title=item["title"],
            ).first()

            if existing_task is None:
                task = Task(
                    title=item["title"],
                    description=item["description"],
                    status=item["status"],
                    user_id=user.id,
                )
                db.session.add(task)
                print(f"Added task: {item['title']}")
            else:
                print(f"Task already exists: {item['title']}")

        db.session.commit()
        print("Database seeding completed.")


if __name__ == "__main__":
    seed_database()
