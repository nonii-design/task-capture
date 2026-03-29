# 📸 Task Capture

スクリーンショットをアップロードするだけで、AIがタスクを自動抽出し、Todoistに追加するWebアプリ。

## 機能

- 📱 スクショをドロップ or タップで読み込み
- 🤖 Claude AI がタスク内容・期日・優先度を自動判定
- ✅ ワンクリックでTodoistに追加（個別 or 一括）
- 📂 追加先プロジェクトを選択可能
- ✏️ タスクタイトルは追加前に編集OK

## セットアップ

### 1. クローン & インストール

```bash
git clone https://github.com/yourname/task-capture.git
cd task-capture
npm install
```

### 2. 環境変数を設定

```bash
cp .env.example .env.local
```

`.env.local` を編集して Anthropic API キーを入力：

```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
```

### 3. ローカルで起動

```bash
npm run dev
```

http://localhost:3000 で開きます。

### 4. Todoistトークンの設定

アプリの初回アクセス時に、Todoist API トークンの入力を求められます。

**取得方法:** Todoist → 設定 → 連携 → 開発者

## Vercelへのデプロイ

### 方法A: Vercel CLIを使う

```bash
npm i -g vercel
vercel
```

### 方法B: GitHubリポジトリ連携

1. このプロジェクトをGitHubにpush
2. [vercel.com](https://vercel.com) でリポジトリをImport
3. Environment Variables に `ANTHROPIC_API_KEY` を追加
4. Deploy!

> ⚠️ **重要:** Vercelの Environment Variables に `ANTHROPIC_API_KEY` を必ず追加してください。

## 技術構成

- **フロントエンド:** Next.js 14 (App Router) + React
- **AI解析:** Claude Sonnet (Anthropic API) - サーバーサイドで実行
- **タスク管理:** Todoist REST API v2
- **デプロイ:** Vercel

## ファイル構成

```
task-capture/
├── app/
│   ├── api/
│   │   └── analyze/
│   │       └── route.js    ← AI解析APIルート（APIキーはここで安全に管理）
│   ├── globals.css
│   ├── layout.js
│   └── page.js             ← メインUI
├── .env.example
├── .gitignore
├── next.config.js
├── package.json
└── README.md
```
