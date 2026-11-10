import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, ClipboardList, LogOut, Plus, Search, Trash2 } from "lucide-react";
import { api, type Task, type TaskPriority, type TaskStatus, type User } from "./api";

type AuthResponse = { user: User; workspaceId: string };
const statuses: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];
const priorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mode, setMode] = useState<"register" | "login">("register");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TaskStatus>("ALL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");

  async function loadTasks() {
    const result = await api<{ tasks: Task[] }>("/api/tasks");
    setTasks(result.tasks);
  }

  useEffect(() => {
    api<AuthResponse>("/api/auth/me")
      .then(async (result) => {
        setUser(result.user);
        await loadTasks();
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const visibleTasks = useMemo(() => tasks.filter((task) => {
    const searchableText = (task.title + " " + (task.description ?? "")).toLowerCase();
    const matchesSearch = searchableText.includes(query.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [tasks, query, statusFilter]);

  const totals = {
    all: tasks.length,
    open: tasks.filter((task) => task.status !== "DONE").length,
    completed: tasks.filter((task) => task.status === "DONE").length
  };

  async function submitAuthentication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      const result = await api<AuthResponse>("/api/auth/" + mode, {
        method: "POST",
        body: {
          ...(mode === "register" ? { name: form.get("name") } : {}),
          email: form.get("email"),
          password: form.get("password")
        }
      });
      setUser(result.user);
      await loadTasks();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ task: Task }>("/api/tasks", {
        method: "POST",
        body: {
          title,
          description: description || undefined,
          priority,
          dueDate: dueDate ? new Date(dueDate + "T12:00:00").toISOString() : undefined
        }
      });
      setTasks((current) => [result.task, ...current]);
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setDueDate("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the task.");
    } finally {
      setBusy(false);
    }
  }

  async function updateTaskStatus(task: Task, status: TaskStatus) {
    try {
      const result = await api<{ task: Task }>("/api/tasks/" + task.id, {
        method: "PATCH",
        body: { status }
      });
      setTasks((current) => current.map((item) => item.id === task.id ? result.task : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the task.");
    }
  }

  async function deleteTask(taskId: string) {
    try {
      await api<void>("/api/tasks/" + taskId, { method: "DELETE" });
      setTasks((current) => current.filter((task) => task.id !== taskId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete the task.");
    }
  }

  async function signOut() {
    await api<void>("/api/auth/logout", { method: "POST" });
    setUser(null);
    setTasks([]);
  }

  if (loading) return <main className="loading">Preparing your workspace…</main>;

  if (!user) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="mark"><ClipboardList /></div>
          <p className="eyebrow">A CLEARER WAY TO WORK</p>
          <h1>{mode === "register" ? "Make room for good work." : "Welcome back."}</h1>
          <p className="muted">Plan the work, keep your team aligned, and see what needs attention.</p>
          {error && <p className="alert" role="alert">{error}</p>}
          <form onSubmit={submitAuthentication}>
            {mode === "register" && (
              <label>
                Your name
                <input name="name" minLength={2} maxLength={80} autoComplete="name" required />
              </label>
            )}
            <label>
              Email address
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Password
              <input name="password" type="password" minLength={mode === "register" ? 10 : 1}
                autoComplete={mode === "register" ? "new-password" : "current-password"} required />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Please wait…" : mode === "register" ? "Create workspace" : "Sign in"}
              <ArrowRight size={16} />
            </button>
          </form>
          <button className="link" onClick={() => {
            setMode(mode === "register" ? "login" : "register");
            setError("");
          }}>
            {mode === "register" ? "Already registered? Sign in" : "Need an account? Create one"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="mark"><ClipboardList size={17} /></span>TaskFlow</a>
        <div className="account">
          {user.name}
          <button className="icon" onClick={signOut} aria-label="Sign out"><LogOut size={17} /></button>
        </div>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow">WORKSPACE / OVERVIEW</p>
          <h1>Good work starts with clarity.</h1>
          <p className="muted">A focused view of what is moving, what is finished, and what needs attention.</p>
        </div>
        <span>{new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date())}</span>
      </section>

      {error && <p className="alert" role="alert">{error}</p>}

      <section className="stats" aria-label="Task summary">
        <article><span>All tasks</span><strong>{totals.all}</strong></article>
        <article><span>Open tasks</span><strong>{totals.open}</strong></article>
        <article><span>Completed</span><strong>{totals.completed}</strong></article>
      </section>

      <section className="columns">
        <aside className="panel">
          <p className="eyebrow">CAPTURE A TASK</p>
          <h2>What's next?</h2>
          <form onSubmit={createTask}>
            <label>Task title
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
            </label>
            <label>Description
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={2000} />
            </label>
            <div className="form-row">
              <label>Priority
                <select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
                  {priorities.map((item) => <option key={item} value={item}>{item.toLowerCase()}</option>)}
                </select>
              </label>
              <label>Due date
                <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </label>
            </div>
            <button className="primary" disabled={busy || !title.trim()}><Plus size={15} /> Add task</button>
          </form>
        </aside>

        <section className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">YOUR WORK</p><h2>Task list</h2></div>
            <span>{visibleTasks.length} shown</span>
          </div>
          <div className="toolbar">
            <label className="search">
              <Search size={15} />
              <input aria-label="Search tasks" placeholder="Search tasks" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <select aria-label="Filter by status" value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "ALL" | TaskStatus)}>
              <option value="ALL">All statuses</option>
              {statuses.map((status) => <option key={status} value={status}>{status.replace("_", " ").toLowerCase()}</option>)}
            </select>
          </div>

          {visibleTasks.length === 0 ? (
            <div className="empty">
              <ClipboardList size={28} />
              <strong>No tasks here yet</strong>
              <span>Add a task or change the current filter.</span>
            </div>
          ) : (
            <div className="task-list">
              {visibleTasks.map((task) => (
                <article className="task" key={task.id}>
                  <div className="task-copy">
                    <div className="task-title">
                      <strong>{task.title}</strong>
                      <span className={"priority " + task.priority.toLowerCase()}>{task.priority.toLowerCase()}</span>
                    </div>
                    {task.description && <p>{task.description}</p>}
                    {task.dueDate && <small>Due {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(task.dueDate))}</small>}
                  </div>
                  <div className="task-actions">
                    <select aria-label={"Status for " + task.title} value={task.status}
                      onChange={(event) => void updateTaskStatus(task, event.target.value as TaskStatus)}>
                      {statuses.map((status) => <option key={status} value={status}>{status.replace("_", " ").toLowerCase()}</option>)}
                    </select>
                    <button className="icon danger" onClick={() => void deleteTask(task.id)} aria-label={"Delete " + task.title}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
      <footer className="footer">TaskFlow · Personal workspace · PostgreSQL</footer>
    </main>
  );
}
