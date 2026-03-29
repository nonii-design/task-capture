import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { formatLinePartnerRulesForPrompt } from "../../../lib/linePartnerRules.js";

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    const { base64, mediaType } = await req.json();
    const today = new Date().toISOString().split("T")[0];
    const linePartnerBlock = formatLinePartnerRulesForPrompt();

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: "text",
              text: `あなたは発送TODO管理の専門アシスタントです。スクリーンショットから受注・発送タスクを抽出してください。

今日は ${today} です。

${linePartnerBlock}

■ タスク名のルール
タイトルは以下の順番で記載：
  絵文字 + 納期 + 納品先 + 受注内容・数量

冒頭の絵文字は内容に応じて選択：
  🥔 生芋（生のさつまいも）
  🍠 冷凍焼き芋・ペースト（冷凍品・加工品）
  🍨 スイーツ系（完成品のスイーツ）
  📦 包材・常温品（資材・常温保管品）

タイトル例：
  🍠 3/8 STAY 冷凍焼き芋 15kg
  🥔 3/20 △△農園 紅はるか 10kg
  🍨 3/22 □□カフェ 生とろプリン 20個
  📦 3/25 本店 テイクアウト容器 500枚

■ 説明欄のルール
受注の経緯を記載し、その下に発注内容の詳細を記載。
例：
  2024/03/07 LINE受注
  冷凍焼き芋 15kg（5kg×3箱）
  送料込み ¥○○○○
  配送先：静岡市○○…

■ 予定日のルール
予定日は「納期（期日）」ではなく「着手する日（準備開始日）」を設定。
納品日の1〜2日前を予定日にする。
例：3/8 納品 → 予定日は 3/6 or 3/7

■ 出力形式
JSON配列で返してください。各オブジェクト：
- "title": 上記ルールに従ったタスク名（絵文字+納期+納品先+内容・数量）
- "description": 受注経緯と詳細（説明欄用）
- "due_date": 着手日（準備開始日）。"today", "tomorrow", "2026-04-15" 等。不明ならnull
- "priority": 1（通常）〜 4（緊急）

発送・納品に関係ない一般タスクの場合は、通常のタスクタイトルで絵文字なしでも構いません。

Respond ONLY with valid JSON array, no markdown fences, no explanation.`,
            },
          ],
        },
      ],
    });

    const text = message.content.map((c) => c.text || "").join("");
    const tasks = JSON.parse(text.replace(/```json|```/g, "").trim());

    return NextResponse.json({ tasks });
  } catch (err) {
    console.error("Analyze error:", err);
    return NextResponse.json(
      { error: "Failed to analyze screenshot" },
      { status: 500 }
    );
  }
}
