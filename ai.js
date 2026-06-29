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
  "keywords": ["6-10个具体关键词，避免泛词"],
  "coverTakeaways": ["4-6条封面共性或封面可复用策略，每条必须能指导做封面"],
  "contentTakeaways": ["4-6条内容共性或内容可复用策略，每条必须能指导写内容"],
  "topicIdeas": ["6-10个可继续创作的选题，每条都要能改成小红书标题"],
  "titlePatterns": ["3-6个标题公式，保留可替换槽位"],
  "reason": "一句话说明判断原因"
}

质量要求：
- 不要输出“吸引眼球、内容丰富、视觉冲击强”这类空话，必须说清楚怎么做。
- 如果信息不足，请写“基于标题/标签推测”，不要编造封面细节。
- 所有数组里的句子都要短、具体、可执行。
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

async function summarizeNotesWithAi({ notes, settings }) {
  if (!settings.apiKey) {
    throw new Error("请先在表格库里保存 DeepSeek API Key。");
  }
  const compactNotes = notes.slice(0, 30).map((note) => ({
    title: note.title,
    category: note.category,
    keywords: note.keywords,
    coverTakeaways: note.coverTakeaways,
    contentTakeaways: note.contentTakeaways,
    topicIdeas: note.topicIdeas,
    notes: note.notes
  }));

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
            "你是小红书选题资料库分析助手。请基于多条已采集笔记，总结共性、标题公式、封面套路和下一步选题。输出合法 JSON。"
        },
        {
          role: "user",
          content: `请分析这些笔记：\n${JSON.stringify(compactNotes, null, 2)}\n\n输出 JSON：{\n  "commonKeywords": ["高频关键词"],\n  "coverPatterns": ["封面共性"],\n  "titleFormulas": ["标题公式"],\n  "contentPatterns": ["内容共性"],\n  "nextTopics": ["可继续创作的选题"],\n  "summary": "一句话总结"\n}`
        }
      ],
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      max_tokens: Math.max(settings.maxTokens || 1600, 1800)
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || `DeepSeek 请求失败：${response.status}`);
  }
  const text = payload.choices?.[0]?.message?.content || outputText(payload);
  if (!text) throw new Error("AI 没有返回可解析的批量总结。");
  return JSON.parse(text);
}

globalThis.topicAi = {
  analyzeNoteWithAi,
  summarizeNotesWithAi
};
