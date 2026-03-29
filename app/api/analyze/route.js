import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { formatLinePartnerRulesForPrompt } from "../../../lib/linePartnerRules.js";

export const maxDuration = 60;

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    const { base64, mediaType, partnerName, corrections } = await req.json();
    const today = new Date().toISOString().split("T")[0];
    const linePartnerBlock = formatLinePartnerRulesForPrompt();
    const partnerOverride = partnerName?.trim()
      ? `\n■ 取引先の指定\nユーザーが取引先名を「${partnerName.trim()}」と指定しています。タスク名の納品先にはこの名前を使ってください（LINEヘッダーの自動判定より優先）。\n`
      : "";

    let correctionsBlock = "";
    if (Array.isArray(corrections) && corrections.length > 0) {
      const recent = corrections.slice(-15);
      const examples = recent.map((c, i) => {
        const lines = [`例${i + 1}:`];
        if (c.partnerName) {
          lines.push(`  指定された取引先名: 「${c.partnerName}」`);
        }
        if (c.original.title !== c.corrected.title) {
          lines.push(`  タスク名: 「${c.original.title}」→「${c.corrected.title}」`);
        }
        if (c.original.description !== c.corrected.description) {
          const origDesc = c.original.description || "(空)";
          const corrDesc = c.corrected.description || "(空)";
          lines.push(`  説明: 「${origDesc}」→「${corrDesc}」`);
        }
        return lines.join("\n");
      }).join("\n");
      correctionsBlock = `\n■ ユーザーの過去の修正（学習データ）
以下はユーザーがAI出力を手動修正した履歴です。取引先名の指定がある場合はその名前の使い方を学び、タスク名・説明の修正パターンに合わせてください：
${examples}\n`;
    }

    const client = new Anthropic({ apiKey, timeout: 55000 });

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
${partnerOverride}
${linePartnerBlock}
${correctionsBlock}

■ タスク名のルール
タイトルは以下の順番で記載：
  絵文字 + 納期 + 納品先 + 受注内容・数量

冒頭の絵文字は内容に応じて選択（複数該当する場合はすべて並べる）：
  🥔 生芋（生のさつまいも）
  🍠 冷凍焼き芋・ペースト（冷凍品・加工品）
  🍨 スイーツ系（完成品のスイーツ）
  📦 包材・常温品・パウダー類（資材・常温保管品・焼き芋パウダー・ほうじ茶ラテパウダー等）

タイトル例：
  🍠 3/8 STAY 冷凍焼き芋 15kg
  🥔 3/20 △△農園 紅はるか 10kg
  🍨 3/22 □□カフェ 生とろプリン 20個
  📦 3/25 本店 テイクアウト容器 500枚
  📦 3/27 ○○店 焼き芋パウダー×3 ほうじ茶ラテパウダー×3
  🍠🍨 3/28 ○○店 冷凍焼き芋10kg＋芋プリン20個

■ 説明欄のルール
受注の経緯を記載し、その下に発注内容の詳細を記載。
例：
  2024/03/07 LINE受注
  冷凍焼き芋 15kg（5kg×3箱）
  送料込み ¥○○○○
  配送先：静岡市○○…

■ 予定日のルール
予定日は「納期（期日）」ではなく「着手する日（準備開始日）」を設定。
商品カテゴリと数量に応じて、納品日から逆算：
  🍠 冷凍焼き芋・ペースト → 納品日の4日前から着手
     ただし合計20kg以上の場合 → 納品日の7日前（1週間前）から着手
  🥔 生芋 → 到着日（納品日）の3日前から着手
  🍨 スイーツ系 → 納品日の2日前から着手
  📦 包材・常温品 → 納品日の1〜2日前から着手
※ 算出した着手日が今日より過去になる場合は "today" を設定。
例：
  冷凍焼き芋 15kg → 3/29 納品 → 着手日 3/25（4日前）
  冷凍焼き芋 25kg → 3/29 納品 → 着手日 3/22（7日前）
  生芋 10kg → 3/29 到着 → 着手日 3/26（3日前）

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
    const msg = err?.message || String(err);
    return NextResponse.json(
      { error: `解析エラー: ${msg}` },
      { status: 500 }
    );
  }
}
