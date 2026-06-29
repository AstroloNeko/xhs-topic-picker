function outputText(response) {
  if (response.output_text) return response.output_text;

  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }

  return "";
}

function compactList(values, limit) {
  return Array.from(new Set((values || []).map((item) => String(item).trim()).filter(Boolean))).slice(
    0,
    limit
  );
}

function buildPrompt({ extraction, categories, settings }) {
  const customPrompt =
    settings.customPrompt?.trim() || globalThis.topicStore.DEFAULT_CUSTOM_PROMPT;
  const focusPoints = settings.focusPoints?.trim() || globalThis.topicStore.DEFAULT_AI_SETTINGS.focusPoints;

  return `
请分析这篇小红书笔记，并只输出合法 JSON。

分析规则：
${customPrompt}

已存在栏目：
${categories.map((category) => `- ${category}`).join("\n")}

需要重点分析：
${focusPoints}

笔记信息：
${JSON.stringify(
  {
    title: extraction.title,
    description: extraction.description,
    url: extraction.url,
    coverUrl: extraction.coverUrl,
    tags: extraction.tags
  },
  null,
  2
)}

JSON 格式必须是：
{
  "categorySuggestion": "从已存在栏目里选择最合适的一项；如果都不合适，给出一个简短新栏目名",
  "keywords": ["3-12个关键词"],
  "coverTakeaways": ["2-6条封面共性或封面可复用策略"],
  "contentTakeaways": ["2-6条内容共性或内容可复用策略"],
  "topicIdeas": ["4-10个可继续创作的选题"],
  "titlePatterns": ["2-6个标题公式"],
  "reason": "一句话说明判断原因"
}
`.trim();
}

async function analyzeNoteWithAi({ extraction, categories, settings }) {
  if (!settings.apiKey) {
    throw new Error("请先在表格库里保存 DeepSeek API Key。");
  }

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: settings.model || globalThis.topicStore.DEFAULT_AI_SETTINGS.model,
      messages: [
        {
          role: "system",
          content:
            "你是一个小红书内容选题分析助手。请用中文分析爆款笔记，提取可复用的封面共性、内容共性、关键词和选题方向。你必须输出合法 json，不要输出 markdown，不要输出解释性前后缀。"
        },
        {
          role: "user",
          content: buildPrompt({ extraction, categories, settings })
        }
      ],
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      max_tokens: settings.maxTokens || globalThis.topicStore.DEFAULT_AI_SETTINGS.maxTokens
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.error?.message || `DeepSeek 请求失败：${response.status}`;
    throw new Error(message);
  }

  const text = payload.choices?.[0]?.message?.content || outputText(payload);
  if (!text) throw new Error("AI 没有返回可解析的分析结果。");

  const parsed = JSON.parse(text);
  return {
    categorySuggestion: parsed.categorySuggestion || "",
    keywords: compactList(parsed.keywords, 12),
    coverTakeaways: compactList(parsed.coverTakeaways, 6),
    contentTakeaways: compactList(parsed.contentTakeaways, 6),
    topicIdeas: compactList(parsed.topicIdeas, 10),
    titlePatterns: compactList(parsed.titlePatterns, 6),
    reason: parsed.reason || ""
  };
}

globalThis.topicAi = {
  analyzeNoteWithAi
};
