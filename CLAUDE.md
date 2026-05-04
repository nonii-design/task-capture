# task-capture

## プロジェクト概要
スクリーンショットからAIがタスクを自動抽出し、Todoist に追加する Web アプリ。

## 技術スタック
- Next.js (App Router)
- Anthropic Claude SDK（画像からタスク抽出）
- Todoist API 連携

## 機能
- スクショをドロップ or タップで読み込み
- Claude AI がタスク内容・期日・優先度を自動判定
- ワンクリックで Todoist に追加（個別 or 一括）
- 追加先プロジェクト選択
- タスクタイトル編集

## 開発
```bash
npm install && npm run dev
```
