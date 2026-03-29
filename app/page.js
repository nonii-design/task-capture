"use client";
import { useState, useRef, useCallback } from "react";

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
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [copied, setCopied] = useState({});
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  const handleFile = useCallback((file) => {
    if (!file?.type.startsWith("image/")) return;
    setError(null);
    setTasks([]);
    setCopied({});
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

  const copyToClipboard = async (idx) => {
    const t = tasks[idx];
    const lines = [];
    lines.push(`【タスク名】${t.title}`);
    if (t.due_date) lines.push(`【予定日（着手日）】${t.due_date}`);
    const pc = priorityConfig[t.priority] || priorityConfig[1];
    lines.push(`【優先度】${pc.label}`);
    if (t.description) lines.push(`【説明】\n${t.description}`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied((p) => ({ ...p, [idx]: true }));
      setTimeout(() => setCopied((p) => ({ ...p, [idx]: false })), 2000);
    } catch {
      setError("コピーに失敗しました");
    }
  };

  const copyAll = async () => {
    const text = tasks
      .map((t, i) => {
        const pc = priorityConfig[t.priority] || priorityConfig[1];
        const lines = [`── タスク ${i + 1} ──`];
        lines.push(`タスク名: ${t.title}`);
        if (t.due_date) lines.push(`予定日（着手日）: ${t.due_date}`);
        lines.push(`優先度: ${pc.label}`);
        if (t.description) lines.push(`説明:\n${t.description}`);
        return lines.join("\n");
      })
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied({ all: true });
      setTimeout(() => setCopied((p) => ({ ...p, all: false })), 2000);
    } catch {
      setError("コピーに失敗しました");
    }
  };

  const resetForNew = () => {
    setTasks([]);
    setCopied({});
    setImage(null);
    setImagePreview(null);
    setError(null);
  };

  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        <div style={styles.headerCenter}>
          <div style={styles.logoMark}>📸</div>
          <h1 style={styles.title}>Task Capture</h1>
          <p style={styles.subtitle}>スクショ → AI解析 → Todoistタスク提案</p>
        </div>

        {error && <div style={styles.error}>{error}</div>}

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
              <button
                style={{ ...styles.btnGhost, color: copied.all ? "#4caf50" : "#e44332", borderColor: copied.all ? "rgba(76,175,80,0.4)" : "rgba(228,67,50,0.4)" }}
                onClick={copyAll}
              >
                {copied.all ? "✓ コピー済み" : "📋 すべてコピー"}
              </button>
            </div>

            {tasks.map((task, i) => {
              const pc = priorityConfig[task.priority] || priorityConfig[1];
              return (
                <div key={i} style={styles.taskCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.taskTitle}>{task.title}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        <span style={styles.tag(pc.color, pc.bg)}>優先度: {pc.label}</span>
                        {task.due_date && <span style={styles.tag("#60a5fa", "rgba(96,165,250,0.12)")}>📅 着手日: {task.due_date}</span>}
                      </div>
                      {task.description && (
                        <div style={styles.descBlock}>
                          <div style={styles.descLabel}>説明</div>
                          <div style={styles.descText}>{task.description}</div>
                        </div>
                      )}
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <button
                        onClick={() => copyToClipboard(i)}
                        style={{
                          ...styles.addBtn,
                          color: copied[i] ? "#4caf50" : "#e44332",
                          borderColor: copied[i] ? "rgba(76,175,80,0.4)" : "rgba(228,67,50,0.4)",
                        }}
                      >
                        {copied[i] ? "✓" : "📋"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            <button style={{ ...styles.btnGhost, marginTop: 16, width: "100%" }} onClick={resetForNew}>
              別のスクショを読み込む
            </button>
          </div>
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
  logoMark: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 48, height: 48, borderRadius: 14,
    background: "linear-gradient(135deg, #e44332 0%, #ff7043 100%)",
    fontSize: 22,
  },
  title: {
    fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", margin: "12px 0 0",
    background: "linear-gradient(135deg, #e44332 0%, #ff7043 60%, #ffab91 100%)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  subtitle: { fontSize: 13, color: "#777", marginTop: 6, fontWeight: 400 },
  label: {
    fontSize: 11, fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.08em", color: "#888", marginBottom: 8, display: "block",
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
  taskCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14, padding: 18, marginBottom: 10,
  },
  taskTitle: {
    fontWeight: 600, fontSize: 15, color: "#e8e6e3",
    padding: "4px 0", wordBreak: "break-word",
  },
  tag: (color, bg) => ({
    display: "inline-block", padding: "3px 8px", borderRadius: 6,
    fontSize: 11, fontWeight: 600, color, background: bg,
  }),
  descBlock: {
    marginTop: 12, padding: 12,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 10,
  },
  descLabel: {
    fontSize: 10, fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.08em", color: "#666", marginBottom: 6,
  },
  descText: {
    fontSize: 13, color: "#aaa", lineHeight: 1.6, whiteSpace: "pre-wrap",
  },
  addBtn: {
    background: "none", border: "1px solid rgba(228,67,50,0.4)",
    color: "#e44332", borderRadius: 8, padding: "8px 12px",
    fontSize: 16, cursor: "pointer",
  },
  error: {
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#fca5a5", marginBottom: 16,
  },
};
