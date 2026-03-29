"use client";
import { useState, useRef, useCallback, useEffect } from "react";

// ── Todoist helpers (via our API routes to avoid CORS) ──
async function fetchProjects(token) {
  const res = await fetch("/api/todoist/projects", {
    headers: { "x-todoist-token": token },
  });
  if (!res.ok) throw new Error("Todoist connection failed");
  return res.json();
}

async function addTask(token, { content, description, due_string, priority, project_id }) {
  const body = { content };
  if (description) body.description = description;
  if (due_string) body.due_string = due_string;
  if (priority) body.priority = priority;
  if (project_id) body.project_id = project_id;
  const res = await fetch("/api/todoist/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-todoist-token": token,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to add task");
  return res.json();
}

// ── Analyze via our API route ──
async function analyzeScreenshot(base64, mediaType) {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, mediaType }),
  });
  if (!res.ok) throw new Error("Analysis failed");
  const data = await res.json();
  return data.tasks;
}

const priorityConfig = {
  1: { label: "低", color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  2: { label: "中", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  3: { label: "高", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  4: { label: "緊急", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

export default function Home() {
  const [token, setToken] = useState("");
  const [tokenSaved, setTokenSaved] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [adding, setAdding] = useState({});
  const [added, setAdded] = useState({});
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  // Load token from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("todoist_token");
    if (saved) {
      setToken(saved);
      setTokenSaved(true);
    }
  }, []);

  // Fetch projects
  useEffect(() => {
    if (!tokenSaved || !token) return;
    fetchProjects(token)
      .then((p) => {
        setProjects(p);
        const inbox = p.find((x) => x.is_inbox_above);
        if (inbox) setSelectedProject(inbox.id);
      })
      .catch(() => setError("Todoistの接続に失敗しました。トークンを確認してください。"));
  }, [tokenSaved, token]);

  const saveToken = () => {
    if (!token.trim()) return;
    localStorage.setItem("todoist_token", token.trim());
    setTokenSaved(true);
    setError(null);
  };

  const resetToken = () => {
    localStorage.removeItem("todoist_token");
    setToken("");
    setTokenSaved(false);
    setProjects([]);
    setTasks([]);
  };

  const handleFile = useCallback((file) => {
    if (!file?.type.startsWith("image/")) return;
    setError(null);
    setTasks([]);
    setAdded({});
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
      setImage({ base64: e.target.result.split(",")[1], mediaType: file.type });
    };
    reader.readAsDataURL(file);
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      handleFile(e.dataTransfer?.files?.[0]);
    },
    [handleFile]
  );

  const analyze = async () => {
    if (!image) return;
    setAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeScreenshot(image.base64, image.mediaType);
      setTasks(Array.isArray(result) ? result : [result]);
    } catch {
      setError("画像の解析に失敗しました。もう一度お試しください。");
    }
    setAnalyzing(false);
  };

  const handleAddTask = async (idx) => {
    const t = tasks[idx];
    setAdding((p) => ({ ...p, [idx]: true }));
    try {
      await addTask(token, {
        content: t.title,
        description: t.description || "",
        due_string: t.due_date || undefined,
        priority: t.priority || 1,
        project_id: selectedProject || undefined,
      });
      setAdded((p) => ({ ...p, [idx]: true }));
    } catch {
      setError(`「${t.title}」の追加に失敗しました`);
    }
    setAdding((p) => ({ ...p, [idx]: false }));
  };

  const addAll = async () => {
    for (let i = 0; i < tasks.length; i++) {
      if (!added[i]) await handleAddTask(i);
    }
  };

  const updateTask = (idx, field, value) => {
    setTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  };

  const resetForNew = () => {
    setTasks([]);
    setAdded({});
    setImage(null);
    setImagePreview(null);
  };

  const allAdded = tasks.length > 0 && tasks.every((_, i) => added[i]);

  // ── Token setup ──
  if (!tokenSaved) {
    return (
      <div style={styles.container}>
        <div style={styles.inner}>
          <div style={styles.headerCenter}>
            <div style={styles.logoMark}>📸</div>
            <h1 style={styles.title}>Task Capture</h1>
            <p style={styles.subtitle}>スクショ → AI解析 → Todoist自動追加</p>
          </div>
          <div style={styles.card}>
            <label style={styles.label}>Todoist APIトークン</label>
            <p style={styles.hint}>Todoist → 設定 → 連携 → 開発者 で取得できます</p>
            <input
              style={styles.input}
              type="password"
              placeholder="トークンを貼り付け..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveToken()}
            />
            <div style={{ height: 16 }} />
            <button style={styles.btnPrimary} onClick={saveToken}>接続する</button>
          </div>
          {error && <div style={styles.error}>{error}</div>}
        </div>
      </div>
    );
  }

  // ── Main ──
  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        <div style={styles.headerRow}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ ...styles.logoMark, width: 36, height: 36, fontSize: 16 }}>📸</div>
            <h1 style={{ ...styles.title, fontSize: 20 }}>Task Capture</h1>
          </div>
          <button style={styles.btnGhost} onClick={resetToken}>🔑 再設定</button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {projects.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label style={styles.label}>追加先プロジェクト</label>
            <select style={styles.select} value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Dropzone */}
        <div
          style={styles.dropzone(dragOver, !!imagePreview)}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0])} />
          {imagePreview ? (
            <img src={imagePreview} alt="Preview" style={styles.preview} />
          ) : (
            <div>
              <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>📱</div>
              <p style={{ margin: 0, fontSize: 14, color: "#888" }}>スクリーンショットをドロップ / タップして選択</p>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#555" }}>PNG, JPG, WEBP 対応</p>
            </div>
          )}
        </div>

        {image && tasks.length === 0 && (
          <div style={{ marginTop: 16 }}>
            <button style={{ ...styles.btnPrimary, opacity: analyzing ? 0.7 : 1 }} onClick={analyze} disabled={analyzing}>
              {analyzing ? "🔄 AI解析中..." : "🔍 タスクを解析する"}
            </button>
          </div>
        )}

        {tasks.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ ...styles.label, margin: 0 }}>抽出されたタスク（{tasks.length}件）</span>
              {!allAdded && (
                <button style={{ ...styles.btnGhost, color: "#e44332", borderColor: "rgba(228,67,50,0.4)" }} onClick={addAll}>
                  ✦ すべて追加
                </button>
              )}
            </div>

            {tasks.map((task, i) => {
              const pc = priorityConfig[task.priority] || priorityConfig[1];
              return (
                <div key={i} style={styles.taskCard(added[i])}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input
                        value={task.title}
                        onChange={(e) => updateTask(i, "title", e.target.value)}
                        style={styles.taskInput}
                        disabled={added[i]}
                      />
                      {task.description && (
                        <p style={{ fontSize: 12, color: "#777", margin: "4px 0 0 8px" }}>{task.description}</p>
                      )}
                      <div style={{ display: "flex", gap: 8, marginTop: 8, marginLeft: 8, flexWrap: "wrap" }}>
                        <span style={styles.tag(pc.color, pc.bg)}>{pc.label}</span>
                        {task.due_date && <span style={styles.tag("#60a5fa", "rgba(96,165,250,0.12)")}>📅 {task.due_date}</span>}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {added[i] ? (
                        <span style={{ fontSize: 22 }}>✅</span>
                      ) : adding[i] ? (
                        <span style={styles.spinnerEl} />
                      ) : (
                        <button onClick={() => handleAddTask(i)} style={styles.addBtn}>追加</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {allAdded && (
              <div style={{ textAlign: "center", marginTop: 24 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
                <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#e8e6e3" }}>すべてTodoistに追加しました！</p>
                <button style={{ ...styles.btnGhost, marginTop: 16 }} onClick={resetForNew}>新しいスクショを読み込む</button>
              </div>
            )}
          </div>
        )}

        {imagePreview && tasks.length > 0 && !allAdded && (
          <button style={{ ...styles.btnGhost, marginTop: 12, width: "100%" }} onClick={resetForNew}>
            別のスクショを読み込む
          </button>
        )}
      </div>
    </div>
  );
}

// ── Styles ──
const styles = {
  container: {
    minHeight: "100vh",
    background: "#0c0c0c",
    color: "#e8e6e3",
    fontFamily: "'DM Sans', 'Noto Sans JP', system-ui, sans-serif",
  },
  inner: { maxWidth: 640, margin: "0 auto", padding: "40px 20px 80px" },
  headerCenter: { marginBottom: 40, textAlign: "center" },
  headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 },
  logoMark: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 48, height: 48, borderRadius: 14,
    background: "linear-gradient(135deg, #e44332 0%, #ff7043 100%)",
    fontSize: 22,
  },
  title: {
    fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", margin: 0,
    background: "linear-gradient(135deg, #e44332 0%, #ff7043 60%, #ffab91 100%)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  subtitle: { fontSize: 13, color: "#777", marginTop: 6, fontWeight: 400 },
  card: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16, padding: 24, marginBottom: 16,
  },
  label: {
    fontSize: 11, fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.08em", color: "#888", marginBottom: 8, display: "block",
  },
  hint: { fontSize: 12, color: "#666", margin: "0 0 12px" },
  input: {
    width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
    color: "#e8e6e3", fontSize: 14, outline: "none", boxSizing: "border-box",
  },
  select: {
    width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
    color: "#e8e6e3", fontSize: 14, outline: "none", boxSizing: "border-box", appearance: "none",
  },
  btnPrimary: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    width: "100%", padding: "12px 24px",
    background: "linear-gradient(135deg, #e44332 0%, #ff7043 100%)",
    color: "#fff", border: "none", borderRadius: 10,
    fontSize: 14, fontWeight: 600, cursor: "pointer",
  },
  btnGhost: {
    background: "none", border: "1px solid rgba(255,255,255,0.15)",
    color: "#aaa", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer",
  },
  dropzone: (active, hasImage) => ({
    border: `2px dashed ${active ? "#e44332" : "rgba(255,255,255,0.15)"}`,
    borderRadius: 16, padding: hasImage ? 0 : "48px 24px",
    textAlign: "center", cursor: "pointer",
    background: active ? "rgba(228,67,50,0.06)" : "transparent",
    overflow: "hidden", transition: "all 0.3s",
  }),
  preview: { width: "100%", maxHeight: 300, objectFit: "contain", display: "block", borderRadius: 14 },
  taskCard: (done) => ({
    background: done ? "rgba(76,175,80,0.06)" : "rgba(255,255,255,0.03)",
    border: `1px solid ${done ? "rgba(76,175,80,0.3)" : "rgba(255,255,255,0.08)"}`,
    borderRadius: 14, padding: 18, marginBottom: 10,
    transition: "all 0.3s", opacity: done ? 0.7 : 1,
  }),
  taskInput: {
    width: "100%", fontWeight: 600, fontSize: 15, padding: "6px 8px",
    background: "transparent", border: "1px solid transparent",
    color: "#e8e6e3", outline: "none", boxSizing: "border-box",
  },
  tag: (color, bg) => ({
    display: "inline-block", padding: "3px 8px", borderRadius: 6,
    fontSize: 11, fontWeight: 600, color, background: bg,
  }),
  addBtn: {
    background: "none", border: "1px solid rgba(228,67,50,0.4)",
    color: "#e44332", borderRadius: 8, padding: "8px 14px",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  spinnerEl: {
    display: "inline-block", width: 18, height: 18,
    border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff",
    borderRadius: "50%", animation: "spin 0.6s linear infinite",
  },
  error: {
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#fca5a5", marginBottom: 16,
  },
};
