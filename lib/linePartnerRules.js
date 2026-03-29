/**
 * LINE トーク画面スクリーンショット用: ヘッダー表示名 → タスクの「納品先」表記。
 * 上から順に評価し、最初にマッチしたルールのみ適用（プロンプトに埋め込む）。
 *
 * allOf: ヘッダー表示名（必要ならサブテキストも）に、列挙した部分文字列がすべて含まれるときマッチ。
 * 今後ルールを足す場合は、この配列にオブジェクトを追加する。
 */
export const linePartnerRules = [
  {
    id: "lally-oimo-coco-food-truck",
    allOf: ["oimo&coco", "東京フードトラック"],
    displayAs: "らりぃ",
    note: "表示例: oimo&coco. 東京フードトラック 矢野貴丈…（株式会社らりぃ）",
  },
];

/**
 * 解析プロンプト用のテキストブロックを生成する。
 */
export function formatLinePartnerRulesForPrompt() {
  if (!linePartnerRules.length) return "";

  const rows = linePartnerRules.map((r) => {
    const cond = r.allOf.map((s) => `「${s}」`).join(" かつ ");
    return `- 条件: ${cond} がすべてヘッダー付近の文言に含まれる → 納品先表記は「${r.displayAs}」`;
  });

  return `■ LINEトーク画面の場合（取引先名）
- 画面上部のトーク相手の表示名が取引先名です。ヘッダー直下のサブテキスト（会社名など）も参照してよい。
- 次のルールは上から順に評価し、最初に一致したものだけを適用してください。一致した場合、タスク名の「納品先」には必ず下記の表記を使い、長い表示名をそのままタイトルに入れないでください。
${rows.join("\n")}
- どの条件にも当てはまらない場合は、ヘッダー表示名を要約して納品先に使ってください（長いときは会社名・店舗名を優先）。
- 説明欄には、必要なら元のLINE表示名や会社名を1行追記してよい。`;
}
