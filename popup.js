const form = document.querySelector("#captureForm");
const captureState = document.querySelector("#captureState");
const categorySelect = document.querySelector("#category");
const titleInput = document.querySelector("#title");
const cover = document.querySelector("#cover");
const coverFallback = document.querySelector("#coverFallback");
const keywordsInput = document.querySelector("#keywords");
const coverTakeawaysInput = document.querySelector("#coverTakeaways");
const contentTakeawaysInput = document.querySelector("#contentTakeaways");
const topicIdeasInput = document.querySelector("#topicIdeas");
const notesInput = document.querySelector("#notes");
const refreshButton = document.querySelector("#refresh");
const aiAnalyzeButton = document.querySelector("#aiAnalyze");
const saveNoteButton = document.querySelector("#saveNote");
const dashboardButton = document.querySelector("#openDashboard");
const pinPanelButton = document.querySelector("#pinPanel");

let currentExtraction = null;
let currentCategories = [];
let currentTabId = null;
const isSidePanel = document.body.classList.contains("sidepanel-body");

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return map[char];
  });
}

function splitList(value) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function loadCategories(selected) {
  const categories = await window.topicStore.getCategories();
  currentCategories = categories;
  categorySelect.innerHTML = categories
    .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
    .join("");
  if (selected && categories.includes(selected)) categorySelect.value = selected;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function draftKey(tabId) {
  return `draft:${tabId}`;
}

async function getCachedDraft(tabId) {
  if (!chrome.storage.session || !tabId) return null;
  const result = await chrome.storage.session.get(draftKey(tabId));
  return result[draftKey(tabId)] || null;
}

async function setCachedDraft() {
  if (!chrome.storage.session || !currentTabId || !currentExtraction) return;
  await chrome.storage.session.set({
    [draftKey(currentTabId)]: {
      extraction: currentExtraction,
      form: getFormNote(),
      updatedAt: new Date().toISOString()
    }
  });
}

async function extractFromPage() {
  captureState.textContent = "正在读取当前页面...";
  captureState.classList.remove("error");
  form.classList.add("hidden");

  const tab = await getActiveTab();
  if (!tab?.id || !/^https:\/\/www\.xiaohongshu\.com\//.test(tab.url || "")) {
    throw new Error("请先打开一篇小红书笔记页面，再点击插件。");
  }
  currentTabId = tab.id;

  const cached = await getCachedDraft(tab.id);
  if (cached?.extraction?.url === tab.url) {
    return { ...cached.extraction, cachedForm: cached.form };
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, { type: "XHS_EXTRACT_NOTE" });
  } catch (_error) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
    return chrome.tabs.sendMessage(tab.id, { type: "XHS_EXTRACT_NOTE" });
  }
}

function renderExtraction(data) {
  currentExtraction = data;
  if (data.cachedForm) {
    applyFormNote(data.cachedForm);
    renderCover(data.coverUrl, data.title);
    captureState.textContent = "已恢复刚才的分析草稿。";
    captureState.classList.remove("hidden", "error");
    form.classList.remove("hidden");
    return;
  }

  const keywords = window.topicKeywords.extractKeywords(
    `${data.title} ${data.description}`,
    data.tags
  );
  const topicIdeas = window.topicKeywords.suggestTopicIdeas(data.title, keywords);
  const takeaways = window.topicKeywords.suggestTakeaways(
    data.title,
    data.description,
    keywords
  );

  titleInput.value = data.title || "";
  keywordsInput.value = keywords.join("，");
  coverTakeawaysInput.value = takeaways.coverTakeaways.join("\n");
  contentTakeawaysInput.value = takeaways.contentTakeaways.join("\n");
  topicIdeasInput.value = topicIdeas.join("\n");
  notesInput.value = "";

  renderCover(data.coverUrl, data.title);

  captureState.classList.add("hidden");
  form.classList.remove("hidden");
  ensureCoverCache();
  setCachedDraft();
}

async function ensureCoverCache() {
  if (!currentExtraction?.coverUrl || currentExtraction.coverDataUrl) return;
  currentExtraction.coverDataUrl = await window.topicCover.cacheCoverImage(
    currentExtraction.coverUrl
  );
  await setCachedDraft();
}

function renderCover(coverUrl, title) {
  if (coverUrl) {
    cover.src = coverUrl;
    cover.alt = title || "封面预览";
    cover.classList.remove("hidden");
    coverFallback.classList.add("hidden");
  } else {
    cover.removeAttribute("src");
    cover.classList.add("hidden");
    coverFallback.classList.remove("hidden");
  }
}

function mergeNotesWithAi(analysis) {
  const parts = [];
  if (analysis.titlePatterns?.length) {
    parts.push(`标题公式：${analysis.titlePatterns.join(" / ")}`);
  }
  if (analysis.reason) {
    parts.push(`AI 判断：${analysis.reason}`);
  }
  notesInput.value = parts.join("\n");
}

function applyAiAnalysis(analysis) {
  const matchedCategory = currentCategories.find(
    (category) => category === analysis.categorySuggestion
  );
  if (matchedCategory) categorySelect.value = matchedCategory;

  keywordsInput.value = analysis.keywords.join("，");
  coverTakeawaysInput.value = analysis.coverTakeaways.join("\n");
  contentTakeawaysInput.value = analysis.contentTakeaways.join("\n");
  topicIdeasInput.value = analysis.topicIdeas.join("\n");
  mergeNotesWithAi(analysis);
}

function getFormNote() {
  return {
    title: titleInput.value.trim(),
    category: categorySelect.value,
    keywords: splitList(keywordsInput.value),
    coverTakeaways: splitList(coverTakeawaysInput.value),
    contentTakeaways: splitList(contentTakeawaysInput.value),
    topicIdeas: splitList(topicIdeasInput.value),
    notes: notesInput.value.trim()
  };
}

function applyFormNote(note) {
  if (note.category && currentCategories.includes(note.category)) {
    categorySelect.value = note.category;
  }
  titleInput.value = note.title || "";
  keywordsInput.value = (note.keywords || []).join("，");
  coverTakeawaysInput.value = (note.coverTakeaways || []).join("\n");
  contentTakeawaysInput.value = (note.contentTakeaways || []).join("\n");
  topicIdeasInput.value = (note.topicIdeas || []).join("\n");
  notesInput.value = note.notes || "";
}

async function saveCurrentNote() {
  if (!currentExtraction) return;
  await ensureCoverCache();
  await window.topicStore.saveNote({
    ...currentExtraction,
    ...getFormNote()
  });

  captureState.textContent = "已保存。可以继续采集下一篇，或打开表格库查看。";
  captureState.classList.remove("hidden", "error");
  await setCachedDraft();
}

async function capture() {
  try {
    await loadCategories();
    renderExtraction(await extractFromPage());
  } catch (error) {
    captureState.textContent = error.message || "读取失败，请刷新页面后再试。";
    captureState.classList.add("error");
    captureState.classList.remove("hidden");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveCurrentNote();
});

refreshButton.addEventListener("click", capture);
saveNoteButton.addEventListener("click", saveCurrentNote);
aiAnalyzeButton.addEventListener("click", async () => {
  if (!currentExtraction) return;

  aiAnalyzeButton.disabled = true;
  aiAnalyzeButton.textContent = "分析中";
  captureState.textContent = "AI 正在分析标题、正文和封面...";
  captureState.classList.remove("hidden", "error");

  try {
    const settings = await window.topicStore.getAiSettings();
    const analysis = await window.topicAi.analyzeNoteWithAi({
      extraction: currentExtraction,
      categories: currentCategories,
      settings
    });
    applyAiAnalysis(analysis);
    await setCachedDraft();
    captureState.textContent = "AI 分析完成，已回填到表单。";
  } catch (error) {
    captureState.textContent = error.message || "AI 分析失败。";
    captureState.classList.add("error");
  } finally {
    aiAnalyzeButton.disabled = false;
    aiAnalyzeButton.textContent = "AI 分析";
  }
});
dashboardButton.addEventListener("click", () => chrome.runtime.openOptionsPage());

async function setPinnedMode(pinned) {
  await window.topicStore.saveUiSettings({ pinned });
  await chrome.runtime.sendMessage({ type: "SET_PINNED_MODE", pinned }).catch(() => {});
}

pinPanelButton.addEventListener("click", async () => {
  if (isSidePanel) {
    await setPinnedMode(false);
    pinPanelButton.textContent = "钉";
    pinPanelButton.title = "已取消钉住，下次点击图标打开小窗口";
    setTimeout(() => window.close(), 150);
    return;
  }

  await setPinnedMode(true);
  const currentWindow = await chrome.windows.getCurrent();
  if (chrome.sidePanel?.open && currentWindow?.id) {
    await chrome.sidePanel.open({ windowId: currentWindow.id });
  }
  window.close();
});

form.addEventListener("input", setCachedDraft);
form.addEventListener("change", setCachedDraft);
capture();
