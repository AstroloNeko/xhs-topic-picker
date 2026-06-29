const STORAGE_KEYS = {
  notes: "notes",
  categories: "categories",
  aiSettings: "aiSettings",
  updateSettings: "updateSettings",
  uiSettings: "uiSettings",
  promptTemplates: "promptTemplates"
};

const DEFAULT_CATEGORIES = ["绘画教程", "稿件展示", "素材参考", "运营拆解"];
const DEFAULT_CUSTOM_PROMPT = `你是一个小红书内容选题分析助手，尤其擅长拆解绘画、插画、稿件展示、教程类爆款笔记。

请优先分析这些点：
1. 封面为什么有点击欲：主体、文字、对比、完成图、信息密度、情绪价值。
2. 标题用了什么公式：人群、痛点、结果承诺、数字、反差、低门槛。
3. 内容为什么容易收藏或转发：步骤、清单、案例、避坑、模板、前后对比。
4. 这篇笔记适合归到哪个栏目，并说明理由。
5. 输出的选题要能直接拿来继续创作，不要写空泛建议。

如果正文或封面信息不足，请基于标题、标签和可见摘要谨慎判断，不要编造具体画面细节。`;
const DEFAULT_AI_SETTINGS = {
  apiKey: "",
  model: "deepseek-v4-flash",
  maxTokens: 1600,
  focusPoints: "封面结构、标题公式、内容共性、可复用选题、适合归档栏目",
  customPrompt: DEFAULT_CUSTOM_PROMPT
};

const DEFAULT_PROMPT_TEMPLATES = [
  {
    id: "drawing_tutorial",
    name: "绘画教程拆解",
    prompt: DEFAULT_CUSTOM_PROMPT
  },
  {
    id: "portfolio_showcase",
    name: "稿件展示拆解",
    prompt: `你是一个小红书稿件展示和作品集运营分析助手。

请重点分析：
1. 作品展示的第一眼吸引力：主体、完成度、风格辨识度、前后对比。
2. 标题如何制造信任感：接稿、案例、成长、价格感、客户反馈。
3. 内容如何引导收藏、咨询或关注。
4. 适合复用成哪些稿件展示选题。
5. 输出要偏实战，少写空泛夸奖。`
  },
  {
    id: "cover_only",
    name: "封面结构专用",
    prompt: `你是小红书封面拆解助手。

请优先分析封面：
1. 封面主体和视觉中心。
2. 大字标题、关键词、结果承诺。
3. 对比、箭头、框线、步骤、完成图等视觉组件。
4. 用户为什么会点进来。
5. 可以复用的封面模板。`
  },
  {
    id: "title_formula",
    name: "爆款标题公式",
    prompt: `你是小红书标题公式分析助手。

请重点提取：
1. 标题的目标人群。
2. 痛点、利益点、结果承诺。
3. 数字、反差、低门槛、稀缺感等结构。
4. 可复用标题公式。
5. 基于原笔记生成同赛道新标题。`
  }
];

const DEFAULT_UPDATE_SETTINGS = {
  enabled: false,
  githubOwner: "",
  githubRepo: "",
  intervalDays: 3,
  lastCheckedAt: "",
  latestVersion: "",
  latestUrl: "",
  latestZipUrl: "",
  notifiedVersion: ""
};

const DEFAULT_UI_SETTINGS = {
  pinned: false
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

async function getStored(key, fallback) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? fallback;
}

async function getCategories() {
  const categories = await getStored(STORAGE_KEYS.categories, DEFAULT_CATEGORIES);
  return categories.length ? categories : DEFAULT_CATEGORIES;
}

async function saveCategories(categories) {
  const cleaned = Array.from(
    new Set(categories.map((item) => item.trim()).filter(Boolean))
  );
  await chrome.storage.local.set({ [STORAGE_KEYS.categories]: cleaned });
  return cleaned;
}

async function getNotes() {
  return getStored(STORAGE_KEYS.notes, []);
}

async function saveNote(note) {
  const notes = await getNotes();
  const normalized = {
    id: note.id || uid(),
    title: note.title || "",
    category: note.category || DEFAULT_CATEGORIES[0],
    coverUrl: note.coverUrl || "",
    coverDataUrl: note.coverDataUrl || "",
    url: note.url || "",
    keywords: Array.isArray(note.keywords) ? note.keywords : [],
    coverTakeaways: Array.isArray(note.coverTakeaways) ? note.coverTakeaways : [],
    contentTakeaways: Array.isArray(note.contentTakeaways) ? note.contentTakeaways : [],
    topicIdeas: Array.isArray(note.topicIdeas) ? note.topicIdeas : [],
    notes: note.notes || "",
    capturedAt: note.capturedAt || new Date().toISOString()
  };
  const existingIndex = normalized.url
    ? notes.findIndex((item) => item.url === normalized.url)
    : -1;

  if (existingIndex >= 0) {
    const updated = [...notes];
    updated[existingIndex] = {
      ...updated[existingIndex],
      ...normalized,
      id: updated[existingIndex].id,
      capturedAt: updated[existingIndex].capturedAt || normalized.capturedAt,
      updatedAt: new Date().toISOString()
    };
    await chrome.storage.local.set({ [STORAGE_KEYS.notes]: updated });
    return updated[existingIndex];
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.notes]: [normalized, ...notes]
  });
  return normalized;
}

async function updateNote(id, patch) {
  const notes = await getNotes();
  const updated = notes.map((note) => (note.id === id ? { ...note, ...patch } : note));
  await chrome.storage.local.set({ [STORAGE_KEYS.notes]: updated });
  return updated.find((note) => note.id === id);
}

async function deleteNote(id) {
  const notes = await getNotes();
  await chrome.storage.local.set({
    [STORAGE_KEYS.notes]: notes.filter((note) => note.id !== id)
  });
}

async function deleteNotes(ids) {
  const idSet = new Set(ids);
  const notes = await getNotes();
  await chrome.storage.local.set({
    [STORAGE_KEYS.notes]: notes.filter((note) => !idSet.has(note.id))
  });
}

async function updateNotes(ids, patch) {
  const idSet = new Set(ids);
  const notes = await getNotes();
  const updated = notes.map((note) =>
    idSet.has(note.id) ? { ...note, ...patch, updatedAt: new Date().toISOString() } : note
  );
  await chrome.storage.local.set({ [STORAGE_KEYS.notes]: updated });
}

async function clearNotes() {
  await chrome.storage.local.set({ [STORAGE_KEYS.notes]: [] });
}

async function getAiSettings() {
  const settings = {
    ...DEFAULT_AI_SETTINGS,
    ...(await getStored(STORAGE_KEYS.aiSettings, DEFAULT_AI_SETTINGS))
  };
  if (!settings.customPrompt?.trim()) settings.customPrompt = DEFAULT_CUSTOM_PROMPT;
  return settings;
}

async function saveAiSettings(settings) {
  const cleaned = {
    apiKey: settings.apiKey?.trim() || "",
    model: settings.model?.trim() || DEFAULT_AI_SETTINGS.model,
    maxTokens: Math.max(400, Math.min(Number(settings.maxTokens) || DEFAULT_AI_SETTINGS.maxTokens, 4000)),
    focusPoints: settings.focusPoints?.trim() || DEFAULT_AI_SETTINGS.focusPoints,
    customPrompt: settings.customPrompt?.trim() || DEFAULT_CUSTOM_PROMPT
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.aiSettings]: cleaned });
  return cleaned;
}

async function getUpdateSettings() {
  return {
    ...DEFAULT_UPDATE_SETTINGS,
    ...(await getStored(STORAGE_KEYS.updateSettings, DEFAULT_UPDATE_SETTINGS))
  };
}

async function saveUpdateSettings(settings) {
  const cleaned = {
    enabled: Boolean(settings.enabled),
    githubOwner: settings.githubOwner?.trim() || "",
    githubRepo: settings.githubRepo?.trim() || "",
    intervalDays: Math.max(1, Math.min(Number(settings.intervalDays) || DEFAULT_UPDATE_SETTINGS.intervalDays, 30)),
    lastCheckedAt: settings.lastCheckedAt || "",
    latestVersion: settings.latestVersion || "",
    latestUrl: settings.latestUrl || "",
    latestZipUrl: settings.latestZipUrl || "",
    notifiedVersion: settings.notifiedVersion || ""
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.updateSettings]: cleaned });
  return cleaned;
}

async function getUiSettings() {
  return {
    ...DEFAULT_UI_SETTINGS,
    ...(await getStored(STORAGE_KEYS.uiSettings, DEFAULT_UI_SETTINGS))
  };
}

async function saveUiSettings(settings) {
  const cleaned = {
    pinned: Boolean(settings.pinned)
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.uiSettings]: cleaned });
  return cleaned;
}

async function getPromptTemplates() {
  const templates = await getStored(STORAGE_KEYS.promptTemplates, DEFAULT_PROMPT_TEMPLATES);
  return templates.length ? templates : DEFAULT_PROMPT_TEMPLATES;
}

async function exportBackup() {
  const [notes, categories, aiSettings, updateSettings, uiSettings, promptTemplates] = await Promise.all([
    getNotes(),
    getCategories(),
    getAiSettings(),
    getUpdateSettings(),
    getUiSettings(),
    getPromptTemplates()
  ]);
  return {
    schema: "xhs-topic-picker-backup-v1",
    exportedAt: new Date().toISOString(),
    notes,
    categories,
    aiSettings: { ...aiSettings, apiKey: "" },
    updateSettings,
    uiSettings,
    promptTemplates
  };
}

async function importBackup(backup) {
  if (!backup || !Array.isArray(backup.notes)) {
    throw new Error("备份文件格式不正确。");
  }
  const currentSettings = await getAiSettings();
  await chrome.storage.local.set({
    [STORAGE_KEYS.notes]: backup.notes,
    [STORAGE_KEYS.categories]: Array.isArray(backup.categories) ? backup.categories : DEFAULT_CATEGORIES,
    [STORAGE_KEYS.aiSettings]: {
      ...DEFAULT_AI_SETTINGS,
      ...(backup.aiSettings || {}),
      apiKey: currentSettings.apiKey
    },
    [STORAGE_KEYS.updateSettings]: {
      ...DEFAULT_UPDATE_SETTINGS,
      ...(backup.updateSettings || {})
    },
    [STORAGE_KEYS.uiSettings]: {
      ...DEFAULT_UI_SETTINGS,
      ...(backup.uiSettings || {})
    },
    [STORAGE_KEYS.promptTemplates]: Array.isArray(backup.promptTemplates)
      ? backup.promptTemplates
      : DEFAULT_PROMPT_TEMPLATES
  });
}

globalThis.topicStore = {
  DEFAULT_CATEGORIES,
  DEFAULT_AI_SETTINGS,
  DEFAULT_CUSTOM_PROMPT,
  DEFAULT_UPDATE_SETTINGS,
  DEFAULT_UI_SETTINGS,
  DEFAULT_PROMPT_TEMPLATES,
  getCategories,
  saveCategories,
  getNotes,
  saveNote,
  updateNote,
  deleteNote,
  deleteNotes,
  updateNotes,
  clearNotes,
  getAiSettings,
  saveAiSettings,
  getUpdateSettings,
  saveUpdateSettings,
  getUiSettings,
  saveUiSettings,
  getPromptTemplates,
  exportBackup,
  importBackup
};
