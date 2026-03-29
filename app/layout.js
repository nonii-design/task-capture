import "./globals.css";

export const metadata = {
  title: "Task Capture - スクショ → Todoist",
  description: "スクリーンショットからAIでタスクを抽出し、Todoistに自動追加",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, background: "#f7f8fa" }}>{children}</body>
    </html>
  );
}
