// Base64 "encryption" only — matches lib/mailbos.js's encodeMailbosKey/
// decodeMailbosKey exactly. The value never reaches the client; it's only
// ever decoded server-side inside a Server Action.
export function decodeOpenAIKey(value) {
  if (!value) return null;
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export function encodeOpenAIKey(value) {
  return Buffer.from(value, "utf8").toString("base64");
}

function responseText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  return (payload?.output || [])
    .flatMap((item) => item?.content || [])
    .map((item) => (item?.type === "output_text" ? item.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

// Same conversation-insight shape as HubConnect iOS's on-device
// CallSummarizer.summarizeConversation — summary + key points + action
// items — but via a real OpenAI call using the viewing user's own key,
// since Windows has no on-device equivalent to Apple Intelligence.
export async function requestConversationInsights(apiKey, transcript) {
  if (!apiKey || !transcript) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_CALL_SUMMARY_MODEL || "gpt-5-nano",
        instructions:
          "Sen bir toplantı asistanısın. Sana iki kişi arasındaki bir görüşmenin konuşmacı " +
          "isimleriyle etiketlenmiş dökümü verilecek. SADECE geçerli bir JSON nesnesi döndür, " +
          "başka hiçbir metin ekleme. Format: " +
          '{"summary": "2-3 cümlelik Türkçe özet", "keyPoints": ["madde", ...], "actionItems": ["madde", ...]} ' +
          "— aksiyon maddesi yoksa actionItems boş dizi olsun.",
        input: transcript,
        max_output_tokens: 500,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return null;
    const text = responseText(await response.json());
    if (!text) return null;
    const parsed = JSON.parse(text);
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.filter((item) => typeof item === "string") : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.filter((item) => typeof item === "string") : [],
    };
  } catch {
    return null;
  }
}
