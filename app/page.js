"use client";
import { useState, useRef, useCallback, useEffect } from "react";

const CORRECTIONS_KEY = "task-capture-corrections";
const MAX_CORRECTIONS = 30;

function loadCorrections() {
  try {
    return JSON.parse(localStorage.getItem(CORRECTIONS_KEY) || "[]");
  } catch { return []; }
}

function saveCorrections(list) {
  const trimmed = list.slice(-MAX_CORRECTIONS);
  localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(trimmed));
}

async function analyzeScreenshot(base64, mediaType, partnerName) {
  const body = { base64, mediaType };
  if (partnerName?.trim()) body.partnerName = partnerName.trim();
  const corrections = loadCorrections();
  if (corrections.length) body.corrections = corrections;
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Analysis failed");
  return data.tasks;
}

const priorityConfig = {
  1: { label: "低", color: "#94a3b8", bg: "rgba(148,163,184,0.10)" },
  2: { label: "中", color: "#f59e0b", bg: "rgba(245,158,11,0.10)" },
  3: { label: "高", color: "#f97316", bg: "rgba(249,115,22,0.10)" },
  4: { label: "緊急", color: "#ef4444", bg: "rgba(239,68,68,0.10)" },
};

function CopyButton({ text, label, copiedKey, copiedState, onCopy }) {
  const isCopied = copiedState[copiedKey];
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          onCopy(copiedKey);
        } catch {}
      }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "5px 10px", borderRadius: 8,
        border: "1px solid",
        borderColor: isCopied ? "rgba(76,175,80,0.3)" : "rgba(0,0,0,0.08)",
        background: isCopied ? "rgba(76,175,80,0.06)" : "rgba(0,0,0,0.02)",
        color: isCopied ? "#2e7d32" : "#666",
        fontSize: 11, fontWeight: 500, cursor: "pointer",
        transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <span style={{
        display: "inline-block",
        animation: isCopied ? "check-pop 0.3s ease" : "none",
      }}>
        {isCopied ? "✓" : "📋"}
      </span>
      {label}
    </button>
  );
}

function TodoistIcon({ size = 20 }) {
  return (
    <img
      src="/todoist-icon.png"
      alt="Todoist"
      width={size}
      height={size}
      style={{ borderRadius: size > 30 ? 12 : 4 }}
    />
  );
}

let imageIdCounter = 0;

export default function Home() {
  const [images, setImages] = useState([]);
  const [resultSections, setResultSections] = useState([]);
  const [originalTasks, setOriginalTasks] = useState({});
  const [savedTasks, setSavedTasks] = useState({});
  const [analyzing, setAnalyzing] = useState(false);
  const [copied, setCopied] = useState({});
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [partnerName, setPartnerName] = useState("");
  const [correctionCount, setCorrectionCount] = useState(0);
  const [todoistConnected, setTodoistConnected] = useState(false);
  const [todoistEmail, setTodoistEmail] = useState(null);
  const [todoistProjectName, setTodoistProjectName] = useState(null);
  const [todoistAdding, setTodoistAdding] = useState({});
  const [todoistAdded, setTodoistAdded] = useState({});
  const fileRef = useRef();

  useEffect(() => {
    setMounted(true);
    setCorrectionCount(loadCorrections().length);
    fetch("/api/todoist/status")
      .then((r) => r.json())
      .then((d) => {
        setTodoistConnected(d.connected);
        if (d.connected) {
          setTodoistEmail(d.email || null);
          setTodoistProjectName(d.projectName || null);
        }
      })
      .catch(() => {});
    const params = new URLSearchParams(window.location.search);
    if (params.get("todoist_connected") === "true") {
      setTodoistConnected(true);
      fetch("/api/todoist/status")
        .then((r) => r.json())
        .then((d) => {
          setTodoistEmail(d.email || null);
          setTodoistProjectName(d.projectName || null);
        })
        .catch(() => {});
      window.history.replaceState({}, "", "/");
    }
    if (params.get("todoist_error")) {
      setError(`Todoist連携エラー: ${params.get("todoist_error")}`);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const addFiles = useCallback((files) => {
    const newImages = [];
    Array.from(files).forEach((file) => {
      if (!file?.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const id = ++imageIdCounter;
        newImages.push({
          id,
          preview: e.target.result,
          base64: e.target.result.split(",")[1],
          mediaType: file.type,
          name: file.name,
        });
        if (newImages.length === files.length || newImages.length === Array.from(files).filter(f => f?.type.startsWith("image/")).length) {
          setImages((prev) => [...prev, ...newImages]);
          setError(null);
          setResultSections([]);
          setCopied({});
        }
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeImage = (id) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    setResultSections([]);
    setCopied({});
  };

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const analyze = async () => {
    if (!images.length) return;
    setAnalyzing(true);
    setError(null);
    setResultSections([]);

    const sections = [];
    for (const img of images) {
      try {
        const tasks = await analyzeScreenshot(img.base64, img.mediaType, partnerName);
        sections.push({
          imageId: img.id,
          imageName: img.name,
          preview: img.preview,
          tasks: Array.isArray(tasks) ? tasks : [tasks],
          error: null,
        });
      } catch (e) {
        sections.push({
          imageId: img.id,
          imageName: img.name,
          preview: img.preview,
          tasks: [],
          error: e?.message || "解析に失敗しました",
        });
      }
    }
    setResultSections(sections);
    const origMap = {};
    sections.forEach((s, si) => {
      s.tasks.forEach((t, ti) => {
        origMap[`${si}-${ti}`] = { title: t.title, description: t.description || "" };
      });
    });
    setOriginalTasks(origMap);
    setSavedTasks({});
    setAnalyzing(false);
  };

  const allTasks = resultSections.flatMap((s) => s.tasks);

  const markCopied = (key) => {
    setCopied((p) => ({ ...p, [key]: true }));
    setTimeout(() => setCopied((p) => ({ ...p, [key]: false })), 2000);
  };

  const copyAll = async () => {
    let globalIdx = 0;
    const text = resultSections
      .map((section, si) => {
        if (!section.tasks.length) return null;
        const header = resultSections.length > 1 ? `━━ 画像${si + 1}: ${section.imageName} ━━\n` : "";
        const body = section.tasks
          .map((t) => {
            globalIdx++;
            const pc = priorityConfig[t.priority] || priorityConfig[1];
            const lines = [`── タスク ${globalIdx} ──`, `タスク名: ${t.title}`];
            if (t.due_date) lines.push(`予定日（着手日）: ${t.due_date}`);
            lines.push(`優先度: ${pc.label}`);
            if (t.description) lines.push(`説明:\n${t.description}`);
            return lines.join("\n");
          })
          .join("\n\n");
        return header + body;
      })
      .filter(Boolean)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      markCopied("all");
    } catch {
      setError("コピーに失敗しました");
    }
  };

  const isTaskModified = (si, ti) => {
    const key = `${si}-${ti}`;
    const orig = originalTasks[key];
    if (!orig) return false;
    const current = resultSections[si]?.tasks?.[ti];
    if (!current) return false;
    return orig.title !== current.title || orig.description !== (current.description || "");
  };

  const saveTaskCorrection = (si, ti) => {
    const key = `${si}-${ti}`;
    const orig = originalTasks[key];
    const current = resultSections[si]?.tasks?.[ti];
    if (!orig || !current) return;

    const correction = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      original: { title: orig.title, description: orig.description },
      corrected: { title: current.title, description: current.description || "" },
      partnerName: partnerName?.trim() || null,
    };
    const list = loadCorrections();
    list.push(correction);
    saveCorrections(list);
    setCorrectionCount(list.slice(-MAX_CORRECTIONS).length);
    setSavedTasks((p) => ({ ...p, [key]: true }));
    setTimeout(() => setSavedTasks((p) => ({ ...p, [key]: false })), 2500);
  };

  const clearCorrections = () => {
    localStorage.removeItem(CORRECTIONS_KEY);
    setCorrectionCount(0);
  };

  const updateTask = (sectionIdx, taskIdx, field, value) => {
    setResultSections((prev) =>
      prev.map((s, si) =>
        si === sectionIdx
          ? {
              ...s,
              tasks: s.tasks.map((t, ti) =>
                ti === taskIdx ? { ...t, [field]: value } : t
              ),
            }
          : s
      )
    );
  };

  const addToTodoist = async (si, ti) => {
    const key = `${si}-${ti}`;
    const task = resultSections[si]?.tasks?.[ti];
    if (!task) return;
    setTodoistAdding((p) => ({ ...p, [key]: true }));
    try {
      const body = { content: task.title };
      if (task.description) body.description = task.description;
      if (task.due_date) body.due_string = task.due_date;
      if (task.priority) body.priority = task.priority;
      const res = await fetch("/api/todoist/add-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        if (res.status === 401) {
          setTodoistConnected(false);
          setError("Todoist認証が切れました。再連携してください。");
          return;
        }
        throw new Error("Failed");
      }
      setTodoistAdded((p) => ({ ...p, [key]: true }));
    } catch {
      setError("Todoistへの追加に失敗しました");
    } finally {
      setTodoistAdding((p) => ({ ...p, [key]: false }));
    }
  };

  const addAllToTodoist = async () => {
    setTodoistAdding((p) => ({ ...p, all: true }));
    let success = 0;
    for (let si = 0; si < resultSections.length; si++) {
      for (let ti = 0; ti < resultSections[si].tasks.length; ti++) {
        const key = `${si}-${ti}`;
        if (todoistAdded[key]) continue;
        await addToTodoist(si, ti);
        success++;
      }
    }
    setTodoistAdding((p) => ({ ...p, all: false }));
  };

  const resetForNew = () => {
    setImages([]);
    setResultSections([]);
    setCopied({});
    setError(null);
    setPartnerName("");
    setTodoistAdding({});
    setTodoistAdded({});
  };

  const hasResults = resultSections.length > 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(165deg, #f7f8fa 0%, #eef0f5 30%, #f0eff6 60%, #f7f8fa 100%)",
      backgroundSize: "400% 400%",
      animation: "gradient-shift 20s ease infinite",
      fontFamily: "'DM Sans', 'Noto Sans JP', system-ui, -apple-system, sans-serif",
      color: "#1a1a2e",
      opacity: mounted ? 1 : 0,
      transition: "opacity 0.6s ease",
    }}>
      {/* Background orbs */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: "none", zIndex: 0, overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: "-10%", right: "-5%",
          width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(228,67,50,0.06) 0%, transparent 70%)",
          filter: "blur(60px)",
        }} />
        <div style={{
          position: "absolute", bottom: "-5%", left: "-10%",
          width: 400, height: 400, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(96,165,250,0.05) 0%, transparent 70%)",
          filter: "blur(60px)",
        }} />
      </div>

      <div style={{
        position: "relative", zIndex: 1,
        maxWidth: hasResults ? 1200 : 640,
        margin: "0 auto", padding: "32px 20px 80px",
        transition: "max-width 0.4s ease",
      }}>
        {/* Header */}
        <header
          onClick={resetForNew}
          style={{
            textAlign: "center", marginBottom: hasResults ? 20 : 36,
            animation: "fadeUp 0.7s ease both",
            cursor: "pointer",
          }}
        >
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 10,
          }}>
            <div style={{ animation: "float 3s ease-in-out infinite" }}>
              <TodoistIcon size={hasResults ? 28 : 48} />
            </div>
            {hasResults ? (
              <h1 style={{
                fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em",
                margin: 0,
                background: "linear-gradient(135deg, #1a1a2e 0%, #e44332 50%, #ff7043 100%)",
                backgroundSize: "200% auto",
                animation: "shimmer 4s linear infinite",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                Task Capture
              </h1>
            ) : null}
          </div>
          {!hasResults && (
            <>
              <h1 style={{
                fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em",
                margin: "12px 0 0",
                background: "linear-gradient(135deg, #1a1a2e 0%, #e44332 50%, #ff7043 100%)",
                backgroundSize: "200% auto",
                animation: "shimmer 4s linear infinite",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                Task Capture
              </h1>
              <p style={{ fontSize: 13, color: "#888", marginTop: 4, fontWeight: 400 }}>
                スクショ → AI解析 → Todoistタスク提案
              </p>
            </>
          )}
        </header>

        {/* Todoist connection status */}
        <div style={{
          display: "flex", justifyContent: "center", marginBottom: 16,
          animation: "fadeUp 0.7s ease 0.2s both",
        }}>
          {todoistConnected ? (
            <div style={{
              display: "inline-flex", flexDirection: "column", alignItems: "center",
              gap: 4,
            }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 20,
                background: "rgba(76,175,80,0.08)",
                border: "1px solid rgba(76,175,80,0.2)",
                fontSize: 12, color: "#2e7d32", fontWeight: 500,
              }}>
                <TodoistIcon size={16} />
                Todoist連携済み
              </div>
              {todoistProjectName && (
                <span style={{ fontSize: 10, color: "#888" }}>
                  📂 {todoistProjectName}
                  {todoistEmail && <span style={{ color: "#bbb" }}> ({todoistEmail})</span>}
                </span>
              )}
            </div>
          ) : (
            <a
              href="/api/todoist/auth"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 18px", borderRadius: 20,
                background: "linear-gradient(135deg, #e44332 0%, #ff7043 100%)",
                color: "#fff", textDecoration: "none",
                fontSize: 12, fontWeight: 600,
                boxShadow: "0 2px 12px rgba(228,67,50,0.25)",
                transition: "all 0.2s ease",
              }}
            >
              <TodoistIcon size={16} />
              Todoistに連携する
            </a>
          )}
        </div>

        {error && (
          <div className="glass" style={{
            borderRadius: 12, padding: "12px 16px",
            fontSize: 13, color: "#c0392b",
            borderColor: "rgba(228,67,50,0.2)",
            background: "rgba(228,67,50,0.06)",
            marginBottom: 16,
            animation: "scaleIn 0.3s ease both",
          }}>
            {error}
          </div>
        )}

        {/* Hidden file input – always in DOM */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{
            position: "absolute", width: 1, height: 1,
            opacity: 0, overflow: "hidden",
            pointerEvents: "none",
          }}
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {/* Dropzone */}
        {!hasResults && (
          <label
            className="glass-strong"
            style={{
              display: "block",
              borderRadius: 20,
              padding: images.length ? "16px" : "52px 24px",
              textAlign: "center",
              cursor: "pointer",
              borderColor: dragOver ? "rgba(228,67,50,0.4)" : undefined,
              background: dragOver ? "rgba(228,67,50,0.04)" : undefined,
              overflow: "hidden",
              transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
              animation: "fadeUp 0.7s ease 0.1s both",
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={(e) => {
              if (images.length > 0) e.preventDefault();
              else fileRef.current?.click();
            }}
          >
            {images.length > 0 ? (
              <div>
                <div style={{
                  display: "flex", flexWrap: "wrap", gap: 10,
                  justifyContent: "center",
                }}>
                  {images.map((img) => (
                    <div key={img.id} style={{
                      position: "relative",
                      width: 100, height: 100,
                      borderRadius: 12, overflow: "hidden",
                      border: "1px solid rgba(0,0,0,0.06)",
                      animation: "scaleIn 0.3s ease both",
                    }}>
                      <img
                        src={img.preview}
                        alt={img.name}
                        style={{
                          width: "100%", height: "100%",
                          objectFit: "cover", display: "block",
                        }}
                      />
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeImage(img.id); }}
                        style={{
                          position: "absolute", top: 4, right: 4,
                          width: 22, height: 22, borderRadius: "50%",
                          background: "rgba(0,0,0,0.55)",
                          backdropFilter: "blur(8px)",
                          border: "none", color: "#fff",
                          fontSize: 12, lineHeight: 1,
                          cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {/* Add more button */}
                  <div
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); fileRef.current?.click(); }}
                    style={{
                      width: 100, height: 100,
                      borderRadius: 12,
                      border: "2px dashed rgba(0,0,0,0.1)",
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      cursor: "pointer", gap: 4,
                      transition: "border-color 0.2s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(228,67,50,0.4)"}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)"}
                  >
                    <span style={{ fontSize: 20, color: "#bbb" }}>+</span>
                    <span style={{ fontSize: 10, color: "#aaa" }}>追加</span>
                  </div>
                </div>
                <p style={{
                  margin: "10px 0 0", fontSize: 11, color: "#aaa",
                }}>
                  {images.length}枚の画像を選択中
                </p>
              </div>
            ) : (
              <div>
                <div style={{
                  width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(228,67,50,0.06)",
                  border: "1px solid rgba(228,67,50,0.1)",
                }}>
                  <span style={{ fontSize: 26 }}>📱</span>
                </div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#555" }}>
                  スクリーンショットをドロップ / タップして選択
                </p>
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "#aaa" }}>
                  PNG, JPG, WEBP 対応（複数可）
                </p>
              </div>
            )}
          </label>
        )}

        {/* Partner name input + Analyze button */}
        {images.length > 0 && !hasResults && (
          <div style={{ marginTop: 16, animation: "fadeUp 0.4s ease both" }}>
            <div
              className="glass"
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: 12,
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 13, flexShrink: 0 }}>🏢</span>
              <input
                type="text"
                placeholder="取引先名（任意：空欄ならスクショから自動判定）"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  flex: 1, border: "none", background: "transparent",
                  fontSize: 13, color: "#1a1a2e", outline: "none",
                  fontFamily: "inherit",
                }}
              />
              {partnerName && (
                <button
                  onClick={() => setPartnerName("")}
                  style={{
                    background: "none", border: "none",
                    color: "#aaa", cursor: "pointer", fontSize: 14,
                    padding: "2px 4px", lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={analyze}
              disabled={analyzing}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", padding: "14px 24px",
                background: analyzing
                  ? "linear-gradient(135deg, #ccc 0%, #bbb 100%)"
                  : "linear-gradient(135deg, #e44332 0%, #ff7043 100%)",
                color: "#fff", border: "none", borderRadius: 14,
                fontSize: 14, fontWeight: 600, cursor: analyzing ? "wait" : "pointer",
                boxShadow: analyzing
                  ? "none"
                  : "0 4px 20px rgba(228,67,50,0.3), 0 2px 6px rgba(228,67,50,0.2)",
                transition: "all 0.3s ease",
              }}
            >
              {analyzing ? (
                <>
                  <span style={{
                    display: "inline-block", width: 16, height: 16,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                  }} />
                  AI解析中...（{images.length}枚）
                </>
              ) : (
                `🔍 タスクを解析する（${images.length}枚）`
              )}
            </button>
          </div>
        )}

        {/* Results – two-column layout */}
        {hasResults && (
          <div style={{ animation: "fadeUp 0.5s ease both" }}>
            {/* Toolbar */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TodoistIcon size={18} />
                <span style={{
                  fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                  letterSpacing: "0.06em", color: "#888",
                }}>
                  抽出されたタスク（{allTasks.length}件）
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {allTasks.length > 0 && todoistConnected && (
                  <button
                    onClick={addAllToTodoist}
                    disabled={!!todoistAdding.all}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 12px", borderRadius: 8,
                      border: "1px solid rgba(228,67,50,0.2)",
                      background: "rgba(228,67,50,0.06)",
                      color: "#e44332",
                      fontSize: 11, fontWeight: 600, cursor: todoistAdding.all ? "wait" : "pointer",
                    }}
                  >
                    {todoistAdding.all ? (
                      <>
                        <span style={{
                          display: "inline-block", width: 12, height: 12,
                          border: "2px solid rgba(228,67,50,0.2)",
                          borderTopColor: "#e44332",
                          borderRadius: "50%",
                          animation: "spin 0.7s linear infinite",
                        }} />
                        追加中...
                      </>
                    ) : (
                      <>
                        <TodoistIcon size={14} />
                        すべてTodoistに追加
                      </>
                    )}
                  </button>
                )}
                {allTasks.length > 0 && (
                  <button
                    onClick={copyAll}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 12px", borderRadius: 8,
                      border: "1px solid",
                      borderColor: copied.all ? "rgba(76,175,80,0.3)" : "rgba(0,0,0,0.08)",
                      background: copied.all ? "rgba(76,175,80,0.06)" : "rgba(255,255,255,0.5)",
                      backdropFilter: "blur(12px)",
                      color: copied.all ? "#2e7d32" : "#666",
                      fontSize: 11, fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    {copied.all ? "✓ コピー済み" : "📋 すべてコピー"}
                  </button>
                )}
                <button
                  className="glass"
                  onClick={resetForNew}
                  style={{
                    padding: "6px 12px", borderRadius: 8,
                    fontSize: 11, fontWeight: 500,
                    color: "#666", cursor: "pointer",
                    border: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  🔄 新規解析
                </button>
              </div>
            </div>

            {/* Two-column: images left, tasks right */}
            <div className="result-columns" style={{
              display: "flex", gap: 24,
              alignItems: "flex-start",
            }}>
              {/* Left column – source images */}
              <div className="image-column" style={{
                width: 380, flexShrink: 0,
                position: "sticky", top: 20,
                animation: "fadeUp 0.5s ease 0.1s both",
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                  letterSpacing: "0.08em", color: "#999",
                  marginBottom: 10,
                }}>
                  📎 元画像
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {images.map((img, idx) => (
                    <div key={img.id} className="glass-strong" style={{
                      borderRadius: 14, overflow: "hidden",
                      animation: `scaleIn 0.4s ease ${0.1 * idx}s both`,
                    }}>
                      <img
                        src={img.preview}
                        alt={img.name}
                        style={{
                          width: "100%", display: "block",
                          borderRadius: 14,
                        }}
                      />
                      {images.length > 1 && (
                        <div style={{
                          padding: "6px 12px",
                          fontSize: 10, color: "#999", fontWeight: 500,
                          borderTop: "1px solid rgba(0,0,0,0.04)",
                          background: "rgba(255,255,255,0.5)",
                        }}>
                          画像 {idx + 1}: {img.name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right column – tasks */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {resultSections.map((section, si) => {
                  const showSectionHeader = resultSections.length > 1;
                  const taskOffset = resultSections
                    .slice(0, si)
                    .reduce((sum, s) => sum + s.tasks.length, 0);

                  return (
                    <div key={section.imageId} style={{
                      marginBottom: showSectionHeader ? 24 : 0,
                    }}>
                      {showSectionHeader && (
                        <div className="glass" style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 14px", borderRadius: 12,
                          marginBottom: 12,
                          animation: `fadeUp 0.4s ease ${0.1 * si}s both`,
                        }}>
                          <img
                            src={section.preview}
                            alt={section.imageName}
                            style={{
                              width: 36, height: 36, borderRadius: 8,
                              objectFit: "cover",
                            }}
                          />
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>
                              画像 {si + 1}
                            </div>
                            <div style={{ fontSize: 10, color: "#aaa" }}>
                              {section.tasks.length}件のタスク
                            </div>
                          </div>
                        </div>
                      )}

                      {section.error && (
                        <div className="glass" style={{
                          borderRadius: 12, padding: "10px 14px",
                          fontSize: 12, color: "#c0392b",
                          background: "rgba(228,67,50,0.06)",
                          borderColor: "rgba(228,67,50,0.2)",
                          marginBottom: 12,
                        }}>
                          {section.error}
                        </div>
                      )}

                      {section.tasks.map((task, ti) => {
                        const globalIdx = taskOffset + ti;
                        const pc = priorityConfig[task.priority] || priorityConfig[1];
                        return (
                          <div
                            key={ti}
                            className="glass-strong"
                            style={{
                              borderRadius: 16, padding: 20, marginBottom: 12,
                              animation: `scaleIn 0.4s ease ${0.1 * globalIdx}s both`,
                            }}
                          >
                            {/* Title */}
                            <div style={{
                              display: "flex", justifyContent: "space-between",
                              alignItems: "flex-start", gap: 8,
                            }}>
                              <span style={{
                                fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                                letterSpacing: "0.08em", color: "#999",
                                flexShrink: 0, paddingTop: 6,
                              }}>
                                タスク名
                              </span>
                              <CopyButton
                                text={task.title}
                                label="コピー"
                                copiedKey={`title-${globalIdx}`}
                                copiedState={copied}
                                onCopy={markCopied}
                              />
                            </div>
                            <input
                              type="text"
                              value={task.title}
                              onChange={(e) => updateTask(si, ti, "title", e.target.value)}
                              style={{
                                width: "100%", marginTop: 4,
                                padding: "8px 10px", borderRadius: 10,
                                border: "1px solid rgba(0,0,0,0.06)",
                                background: "rgba(255,255,255,0.5)",
                                fontSize: 14, fontWeight: 600, color: "#1a1a2e",
                                fontFamily: "inherit", outline: "none",
                                transition: "border-color 0.2s",
                              }}
                            />

                            {/* Tags */}
                            <div style={{
                              display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap",
                            }}>
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                padding: "3px 9px", borderRadius: 7,
                                fontSize: 11, fontWeight: 600,
                                color: pc.color, background: pc.bg,
                              }}>
                                優先度: {pc.label}
                              </span>
                              {task.due_date && (
                                <span style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  padding: "3px 9px", borderRadius: 7,
                                  fontSize: 11, fontWeight: 600,
                                  color: "#3b82f6", background: "rgba(59,130,246,0.08)",
                                }}>
                                  📅 着手日: {task.due_date}
                                </span>
                              )}
                            </div>

                            {/* Description */}
                            {task.description != null && (
                              <div className="glass-subtle" style={{
                                marginTop: 14, padding: 14, borderRadius: 12,
                              }}>
                                <div style={{
                                  display: "flex", justifyContent: "space-between",
                                  alignItems: "center", marginBottom: 8,
                                }}>
                                  <span style={{
                                    fontSize: 10, fontWeight: 600,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.08em", color: "#999",
                                  }}>
                                    説明
                                  </span>
                                  <CopyButton
                                    text={task.description}
                                    label="コピー"
                                    copiedKey={`desc-${globalIdx}`}
                                    copiedState={copied}
                                    onCopy={markCopied}
                                  />
                                </div>
                                <textarea
                                  value={task.description}
                                  onChange={(e) => updateTask(si, ti, "description", e.target.value)}
                                  rows={Math.max(3, (task.description || "").split("\n").length + 1)}
                                  style={{
                                    width: "100%", padding: "8px 10px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(0,0,0,0.06)",
                                    background: "rgba(255,255,255,0.5)",
                                    fontSize: 13, color: "#555",
                                    lineHeight: 1.7,
                                    fontFamily: "inherit", outline: "none",
                                    resize: "vertical",
                                    transition: "border-color 0.2s",
                                  }}
                                />
                              </div>
                            )}

                            {/* Todoist add button */}
                            {todoistConnected && (
                              <div style={{
                                marginTop: 12, display: "flex", justifyContent: "flex-end",
                              }}>
                                <button
                                  onClick={() => addToTodoist(si, ti)}
                                  disabled={!!todoistAdding[`${si}-${ti}`] || !!todoistAdded[`${si}-${ti}`]}
                                  style={{
                                    display: "inline-flex", alignItems: "center", gap: 6,
                                    padding: "7px 16px", borderRadius: 10,
                                    border: "none",
                                    background: todoistAdded[`${si}-${ti}`]
                                      ? "linear-gradient(135deg, #43a047, #66bb6a)"
                                      : "linear-gradient(135deg, #e44332, #ff7043)",
                                    color: "#fff",
                                    fontSize: 12, fontWeight: 600,
                                    cursor: todoistAdded[`${si}-${ti}`] ? "default" : todoistAdding[`${si}-${ti}`] ? "wait" : "pointer",
                                    boxShadow: todoistAdded[`${si}-${ti}`]
                                      ? "0 2px 10px rgba(67,160,71,0.3)"
                                      : "0 2px 10px rgba(228,67,50,0.3)",
                                    transition: "all 0.3s ease",
                                  }}
                                >
                                  {todoistAdded[`${si}-${ti}`] ? (
                                    <><span style={{ animation: "check-pop 0.3s ease" }}>✓</span> 追加済み</>
                                  ) : todoistAdding[`${si}-${ti}`] ? (
                                    <>
                                      <span style={{
                                        display: "inline-block", width: 12, height: 12,
                                        border: "2px solid rgba(255,255,255,0.3)",
                                        borderTopColor: "#fff",
                                        borderRadius: "50%",
                                        animation: "spin 0.7s linear infinite",
                                      }} />
                                      追加中...
                                    </>
                                  ) : (
                                    <><TodoistIcon size={14} /> Todoistに追加</>
                                  )}
                                </button>
                              </div>
                            )}

                            {/* Save correction button */}
                            {isTaskModified(si, ti) && (
                              <div style={{
                                marginTop: 12, display: "flex", justifyContent: "flex-end",
                              }}>
                                <button
                                  onClick={() => saveTaskCorrection(si, ti)}
                                  disabled={!!savedTasks[`${si}-${ti}`]}
                                  style={{
                                    display: "inline-flex", alignItems: "center", gap: 6,
                                    padding: "7px 16px", borderRadius: 10,
                                    border: "none",
                                    background: savedTasks[`${si}-${ti}`]
                                      ? "linear-gradient(135deg, #43a047, #66bb6a)"
                                      : "linear-gradient(135deg, #5c6bc0, #7c4dff)",
                                    color: "#fff",
                                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                                    boxShadow: savedTasks[`${si}-${ti}`]
                                      ? "0 2px 10px rgba(67,160,71,0.3)"
                                      : "0 2px 10px rgba(124,77,255,0.3)",
                                    transition: "all 0.3s ease",
                                    animation: "scaleIn 0.25s ease both",
                                  }}
                                >
                                  {savedTasks[`${si}-${ti}`] ? (
                                    <><span style={{ animation: "check-pop 0.3s ease" }}>✓</span> 保存しました</>
                                  ) : (
                                    <><span>💾</span> 修正を保存（学習）</>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Learning data indicator – hidden, only managed via clearCorrections */}
              </div>
            </div>
          </div>
        )}

        {/* Version – fixed bottom-left */}
        <div style={{
          position: "fixed", bottom: 20, left: 24,
          zIndex: 10,
          animation: "fadeIn 1.2s ease 0.6s both",
        }}>
          <span style={{
            fontSize: 10, color: "#bbb", fontWeight: 500,
            letterSpacing: "0.04em", opacity: 0.6,
          }}>
            Ver 3.0
          </span>
        </div>

        {/* nonii.ai logo – fixed bottom-right */}
        <div style={{
          position: "fixed", bottom: 20, right: 24,
          zIndex: 10,
          animation: "fadeIn 1.2s ease 0.6s both",
        }}>
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 2, opacity: 0.5,
            transition: "opacity 0.3s ease",
          }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.85"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "0.5"}
          >
            <span style={{ fontSize: 9, color: "#aaa", fontWeight: 500, letterSpacing: "0.04em" }}>Powered by</span>
            <img src="/nonii-logo.png" alt="nonii.ai" style={{ height: 24 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
