"use client";
import { useState, useRef, useCallback, useEffect } from "react";

async function analyzeScreenshot(base64, mediaType) {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, mediaType }),
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
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 10px",
        borderRadius: 8,
        border: "1px solid",
        borderColor: isCopied ? "rgba(76,175,80,0.3)" : "rgba(0,0,0,0.08)",
        background: isCopied ? "rgba(76,175,80,0.06)" : "rgba(0,0,0,0.02)",
        color: isCopied ? "#2e7d32" : "#666",
        fontSize: 11,
        fontWeight: 500,
        cursor: "pointer",
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

export default function Home() {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [copied, setCopied] = useState({});
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);
  const fileRef = useRef();

  useEffect(() => setMounted(true), []);

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
    } catch (e) {
      setError(e?.message || "画像の解析に失敗しました。もう一度お試しください。");
    }
    setAnalyzing(false);
  };

  const markCopied = (key) => {
    setCopied((p) => ({ ...p, [key]: true }));
    setTimeout(() => setCopied((p) => ({ ...p, [key]: false })), 2000);
  };

  const copyAll = async () => {
    const text = tasks
      .map((t, i) => {
        const pc = priorityConfig[t.priority] || priorityConfig[1];
        const lines = [`── タスク ${i + 1} ──`, `タスク名: ${t.title}`];
        if (t.due_date) lines.push(`予定日（着手日）: ${t.due_date}`);
        lines.push(`優先度: ${pc.label}`);
        if (t.description) lines.push(`説明:\n${t.description}`);
        return lines.join("\n");
      })
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      markCopied("all");
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
          width: 500, height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(228,67,50,0.06) 0%, transparent 70%)",
          filter: "blur(60px)",
        }} />
        <div style={{
          position: "absolute", bottom: "-5%", left: "-10%",
          width: 400, height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(96,165,250,0.05) 0%, transparent 70%)",
          filter: "blur(60px)",
        }} />
      </div>

      <div style={{
        position: "relative", zIndex: 1,
        maxWidth: 640, margin: "0 auto", padding: "32px 20px 80px",
      }}>
        {/* Header */}
        <header style={{
          textAlign: "center",
          marginBottom: 36,
          animation: "fadeUp 0.7s ease both",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12,
          }}>
            <div style={{ animation: "float 3s ease-in-out infinite" }}>
              <TodoistIcon size={48} />
            </div>
          </div>
          <h1 style={{
            fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em",
            margin: "8px 0 0",
            background: "linear-gradient(135deg, #1a1a2e 0%, #e44332 50%, #ff7043 100%)",
            backgroundSize: "200% auto",
            animation: "shimmer 4s linear infinite",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            Task Capture
          </h1>
          <p style={{
            fontSize: 13, color: "#888", marginTop: 4, fontWeight: 400,
          }}>
            スクショ → AI解析 → Todoistタスク提案
          </p>
        </header>

        {error && (
          <div
            className="glass"
            style={{
              borderRadius: 12, padding: "12px 16px",
              fontSize: 13, color: "#c0392b",
              borderColor: "rgba(228,67,50,0.2)",
              background: "rgba(228,67,50,0.06)",
              marginBottom: 16,
              animation: "scaleIn 0.3s ease both",
            }}
          >
            {error}
          </div>
        )}

        {/* Dropzone */}
        <div
          className="glass-strong"
          style={{
            borderRadius: 20,
            padding: imagePreview ? 0 : "52px 24px",
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
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {imagePreview ? (
            <img
              src={imagePreview}
              alt="Preview"
              style={{
                width: "100%", maxHeight: 340,
                objectFit: "contain", display: "block",
                borderRadius: 18,
              }}
            />
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
              <p style={{
                margin: 0, fontSize: 14, fontWeight: 500, color: "#555",
              }}>
                スクリーンショットをドロップ / タップして選択
              </p>
              <p style={{
                margin: "8px 0 0", fontSize: 12, color: "#aaa",
              }}>
                PNG, JPG, WEBP 対応
              </p>
            </div>
          )}
        </div>

        {/* Analyze button */}
        {image && tasks.length === 0 && (
          <div style={{ marginTop: 16, animation: "fadeUp 0.4s ease both" }}>
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
                  AI解析中...
                </>
              ) : (
                "🔍 タスクを解析する"
              )}
            </button>
          </div>
        )}

        {/* Task list */}
        {tasks.length > 0 && (
          <div style={{ marginTop: 28, animation: "fadeUp 0.5s ease both" }}>
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
                  抽出されたタスク（{tasks.length}件）
                </span>
              </div>
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
            </div>

            {tasks.map((task, i) => {
              const pc = priorityConfig[task.priority] || priorityConfig[1];
              return (
                <div
                  key={i}
                  className="glass-strong"
                  style={{
                    borderRadius: 16, padding: 20, marginBottom: 12,
                    animation: `scaleIn 0.4s ease ${0.1 * i}s both`,
                  }}
                >
                  {/* Title row */}
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "flex-start", gap: 10,
                  }}>
                    <div style={{
                      fontWeight: 600, fontSize: 15, color: "#1a1a2e",
                      lineHeight: 1.5, flex: 1, wordBreak: "break-word",
                    }}>
                      {task.title}
                    </div>
                    <CopyButton
                      text={task.title}
                      label="タスク名"
                      copiedKey={`title-${i}`}
                      copiedState={copied}
                      onCopy={markCopied}
                    />
                  </div>

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
                  {task.description && (
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
                          label="説明"
                          copiedKey={`desc-${i}`}
                          copiedState={copied}
                          onCopy={markCopied}
                        />
                      </div>
                      <div style={{
                        fontSize: 13, color: "#555",
                        lineHeight: 1.7, whiteSpace: "pre-wrap",
                      }}>
                        {task.description}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <button
              className="glass"
              onClick={resetForNew}
              style={{
                marginTop: 16, width: "100%",
                padding: "12px 20px", borderRadius: 12,
                fontSize: 13, fontWeight: 500,
                color: "#666", cursor: "pointer",
                border: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              別のスクショを読み込む
            </button>
          </div>
        )}

        {/* nonii.ai logo – fixed bottom-right */}
        <div style={{
          position: "fixed", bottom: 16, right: 20,
          zIndex: 10,
          animation: "fadeIn 1.2s ease 0.6s both",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            opacity: 0.45,
            transition: "opacity 0.3s ease",
          }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.8"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "0.45"}
          >
            <span style={{ fontSize: 10, color: "#999", fontWeight: 500 }}>Powered by</span>
            <img src="/nonii-logo.png" alt="nonii.ai" style={{ height: 13, mixBlendMode: "multiply" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
