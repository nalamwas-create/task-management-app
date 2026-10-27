
import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:5000";

export default function App() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem("task_manager_token") || ""
  );
  const [user, setUser] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [filter, setFilter] = useState("All");
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function request(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message || data.error || `Request failed (${response.status}).`
      );
    }

    return data;
  }

  async function loadTasks() {
    const data = await request("/tasks");

    // Support either { tasks: [...] } or a direct [...] response.
    const taskList = Array.isArray(data)
      ? data
      : Array.isArray(data.tasks)
        ? data.tasks
        : Array.isArray(data.data?.tasks)
          ? data.data.tasks
          : null;

    if (!taskList) {
      throw new Error("The server returned an unexpected task list.");
    }

    setTasks(taskList);
    return taskList;
  }

  async function loadUser() {
    const data = await request("/me");
    const currentUser = data.user?.email || data.email || "";

    setUser(currentUser);

    // The task list must be loaded after the session is validated.
    await loadTasks();
  }

  function logout() {
    sessionStorage.removeItem("task_manager_token");
    setToken("");
    setUser("");
    setTasks([]);
    setPassword("");
    setTitle("");
    setDescription("");
    setMessage("");
    setEditingId(null);
    setFilter("All");
  }

  // Validate the session and load tasks whenever the token changes.
  useEffect(() => {
    if (!token) {
      setTasks([]);
      setUser("");
      return;
    }

    let cancelled = false;

    async function initialiseWorkspace() {
      try {
        const data = await request("/me");

        if (cancelled) return;

        setUser(data.user?.email || data.email || "");

        const taskData = await request("/tasks");

        if (cancelled) return;

        const taskList = Array.isArray(taskData)
          ? taskData
          : Array.isArray(taskData.tasks)
            ? taskData.tasks
            : Array.isArray(taskData.data?.tasks)
              ? taskData.data.tasks
              : null;

        if (!taskList) {
          throw new Error("The server returned an unexpected task list.");
        }

        setTasks(taskList);
      } catch (error) {
        if (cancelled) return;

        setMessage(error.message);

        if (
          error.message.toLowerCase().includes("token") ||
          error.message.toLowerCase().includes("unauthorized") ||
          error.message.includes("401")
        ) {
          sessionStorage.removeItem("task_manager_token");
          setToken("");
          setTasks([]);
          setUser("");
        }
      }
    }

    initialiseWorkspace();

    return () => {
      cancelled = true;
    };
    // Re-run when login or logout changes the token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleAuth(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const endpoint = authMode === "login" ? "/login" : "/register";

      const data = await request(endpoint, {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      if (authMode === "register") {
        setMessage("Account created. Please log in.");
        setAuthMode("login");
        setPassword("");
        return;
      }

      const newToken = data.access_token || data.token;

      if (!newToken) {
        throw new Error("Login succeeded, but no access token was returned.");
      }

      sessionStorage.setItem("task_manager_token", newToken);
      setUser(data.user?.email || data.email || email.trim());
      setToken(newToken);
      setMessage("Login successful.");
      setPassword("");
    } catch (error) {
      setMessage(error.message || "Unable to complete your request.");
    } finally {
      setLoading(false);
    }
  }

  async function saveTask(event) {
    event.preventDefault();

    if (!title.trim()) {
      setMessage("Please enter a task title.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      if (editingId !== null) {
        await request(`/tasks/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
          }),
        });
      } else {
        await request("/tasks", {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
          }),
        });
      }

      // Refresh first. Only report success if refreshing also succeeds.
      await loadTasks();

      setMessage(editingId !== null ? "Task updated." : "Task created.");
      setTitle("");
      setDescription("");
      setEditingId(null);
    } catch (error) {
      setMessage(
        `Unable to save or refresh the task list: ${
          error.message || "Unknown error."
        }`
      );
    } finally {
      setLoading(false);
    }
  }

  function startEdit(task) {
    setEditingId(task.id);
    setTitle(task.title);
    setDescription(task.description || "");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setMessage("");
  }

  async function toggleTask(task) {
    const nextStatus =
      task.status === "Completed" ? "Pending" : "Completed";

    try {
      setMessage("");

      await request(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });

      await loadTasks();
      setMessage(
        nextStatus === "Completed"
          ? "Task marked as completed."
          : "Task marked as pending."
      );
    } catch (error) {
      setMessage(error.message || "Unable to update task status.");
    }
  }

  async function deleteTask(id) {
    if (!window.confirm("Are you sure you want to delete this task?")) {
      return;
    }

    try {
      setMessage("");

      await request(`/tasks/${id}`, { method: "DELETE" });
      await loadTasks();

      setMessage("Task deleted.");
    } catch (error) {
      setMessage(error.message || "Unable to delete task.");
    }
  }

  const visibleTasks = tasks.filter((task) => {
    if (filter === "Pending") return task.status === "Pending";
    if (filter === "Completed") return task.status === "Completed";
    return true;
  });

  const completedCount = tasks.filter(
    (task) => task.status === "Completed"
  ).length;

  const pendingCount = tasks.filter(
    (task) => task.status === "Pending"
  ).length;

  if (!token) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-mark">T</div>
          <p className="eyebrow">YOUR PERSONAL WORKSPACE</p>

          <h1>
            {authMode === "login"
              ? "Welcome back"
              : "Create your account"}
          </h1>

          <p className="muted">
            {authMode === "login"
              ? "Sign in to organise your day and get things done."
              : "Create an account to start managing your tasks."}
          </p>

          {message && (
            <div className="notice" role="status">
              {message}
            </div>
          )}

          <form onSubmit={handleAuth} className="form-stack">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete={
                authMode === "login"
                  ? "current-password"
                  : "new-password"
              }
              minLength={8}
              required
            />

            <button className="primary-button" disabled={loading}>
              {loading
                ? "Please wait..."
                : authMode === "login"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          <p className="switch-auth">
            {authMode === "login"
              ? "New here?"
              : "Already have an account?"}{" "}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setAuthMode(
                  authMode === "login" ? "register" : "login"
                );
                setMessage("");
              }}
            >
              {authMode === "login"
                ? "Create an account"
                : "Sign in"}
            </button>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">T</span>
          <span>Taskflow</span>
        </div>

        <p className="sidebar-label">WORKSPACE</p>

        <button
          className={`nav-item ${filter === "All" ? "active" : ""}`}
          onClick={() => setFilter("All")}
        >
          <span>▦</span> All tasks
        </button>

        <button
          className={`nav-item ${filter === "Pending" ? "active" : ""}`}
          onClick={() => setFilter("Pending")}
        >
          <span>◷</span> Pending
        </button>

        <button
          className={`nav-item ${filter === "Completed" ? "active" : ""}`}
          onClick={() => setFilter("Completed")}
        >
          <span>✓</span> Completed
        </button>

        <div className="sidebar-bottom">
          <div className="avatar">
            {(user || email || "U")[0].toUpperCase()}
          </div>

          <div className="user-info">
            <strong>{user || email || "Your account"}</strong>
            <span>Personal workspace</span>
          </div>

          <button
            className="icon-button"
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
          >
            ↪
          </button>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <span className="muted">Workspace / Tasks</span>
          <button className="outline-button" onClick={logout}>
            Sign out
          </button>
        </header>

        <div className="content-wrap">
          <div className="page-heading">
            <div>
              <p className="eyebrow">MAKE TODAY COUNT</p>
              <h1>
                My tasks<span className="heading-dot">.</span>
              </h1>
              <p className="muted">
                A little progress every day adds up.
              </p>
            </div>

            <div className="date-chip">
              <span>◷</span> Stay organised
            </div>
          </div>

          <div className="stats-grid">
            <article className="stat-card">
              <span className="stat-icon blue">▦</span>
              <p>Total tasks</p>
              <strong>{tasks.length}</strong>
              <span className="stat-note">In your workspace</span>
            </article>

            <article className="stat-card">
              <span className="stat-icon amber">◷</span>
              <p>Pending</p>
              <strong>{pendingCount}</strong>
              <span className="stat-note">Still in progress</span>
            </article>

            <article className="stat-card">
              <span className="stat-icon green">✓</span>
              <p>Completed</p>
              <strong>{completedCount}</strong>
              <span className="stat-note">Great work</span>
            </article>
          </div>

          <section className="task-form-card">
            <div className="section-heading">
              <div>
                <h2>
                  {editingId !== null ? "Edit task" : "Create a task"}
                </h2>
                <p className="muted">
                  Capture what needs to get done.
                </p>
              </div>
            </div>

            <form onSubmit={saveTask} className="task-form">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Task title"
                aria-label="Task title"
                maxLength={200}
                required
              />

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="Add a description (optional)"
                aria-label="Task description"
                rows={2}
              />

              <div className="form-actions">
                {editingId !== null && (
                  <button
                    type="button"
                    className="outline-button"
                    onClick={cancelEdit}
                  >
                    Cancel
                  </button>
                )}

                <button className="primary-button" disabled={loading}>
                  {loading
                    ? "Saving..."
                    : editingId !== null
                      ? "Save changes"
                      : "+ Add task"}
                </button>
              </div>
            </form>

            {message && (
              <div className="notice" role="status">
                {message}
              </div>
            )}
          </section>

          <section className="task-list-section">
            <div className="section-heading task-list-heading">
              <div>
                <h2>Your task list</h2>
                <p className="muted">
                  {visibleTasks.length} tasks shown
                </p>
              </div>

              <div className="filter-group">
                {["All", "Pending", "Completed"].map((item) => (
                  <button
                    key={item}
                    className={
                      filter === item
                        ? "filter active-filter"
                        : "filter"
                    }
                    onClick={() => setFilter(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {visibleTasks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✓</div>
                <h3>
                  {filter === "All"
                    ? "A fresh start"
                    : `No ${filter.toLowerCase()} tasks`}
                </h3>
                <p className="muted">
                  {filter === "All"
                    ? "Add your first task above and build momentum."
                    : "Try another filter or add a new task."}
                </p>
              </div>
            ) : (
              <div className="task-list">
                {visibleTasks.map((task) => (
                  <article className="task-row" key={task.id}>
                    <button
                      className={`task-check ${
                        task.status === "Completed" ? "checked" : ""
                      }`}
                      onClick={() => toggleTask(task)}
                      aria-label={`Mark ${task.title} ${
                        task.status === "Completed"
                          ? "pending"
                          : "completed"
                      }`}
                    >
                      {task.status === "Completed" ? "✓" : ""}
                    </button>

                    <div className="task-details">
                      <h3
                        className={
                          task.status === "Completed"
                            ? "completed-title"
                            : ""
                        }
                      >
                        {task.title}
                      </h3>

                      {task.description && <p>{task.description}</p>}
                    </div>

                    <span
                      className={`status-pill ${
                        task.status === "Completed"
                          ? "status-completed"
                          : "status-pending"
                      }`}
                    >
                      {task.status}
                    </span>

                    <div className="task-actions">
                      <button
                        className="icon-button"
                        onClick={() => startEdit(task)}
                        title="Edit task"
                        aria-label={`Edit ${task.title}`}
                      >
                        ✎
                      </button>

                      <button
                        className="icon-button danger"
                        onClick={() => deleteTask(task.id)}
                        title="Delete task"
                        aria-label={`Delete ${task.title}`}
                      >
                        ×
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <footer className="footer">
            <span>Taskflow · Personal productivity</span>
            <span>
              {completedCount} of {tasks.length} completed
            </span>
          </footer>
        </div>
      </section>
    </main>
  );
}

