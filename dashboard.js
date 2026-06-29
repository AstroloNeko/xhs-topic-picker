const categoryFilter = document.querySelector("#categoryFilter");
const searchInput = document.querySelector("#search");
const coverFilter = document.querySelector("#coverFilter");
const aiFilter = document.querySelector("#aiFilter");
const newCategoryInput = document.querySelector("#newCategory");
const addCategoryButton = document.querySelector("#addCategory");
const apiKeyInput = document.querySelector("#apiKey");
const modelNameInput = document.querySelector("#modelName");
const promptTemplateSelect = document.querySelector("#promptTemplate");
const maxTokensInput = document.querySelector("#maxTokens");
const focusPointsInput = document.querySelector("#focusPoints");
const customPromptInput = document.querySelector("#customPrompt");
const saveAiSettingsButton = document.querySelector("#saveAiSettings");
const resetPromptButton = document.querySelector("#resetPrompt");
const aiSettingsState = document.querySelector("#aiSettingsState");
const experimentVideoCoverInput = document.querySelector("#experimentVideoCover");
const experimentScreenshotFallbackInput = document.querySelector("#experimentScreenshotFallback");
const experimentOverlayMediaInput = document.querySelector("#experimentOverlayMedia");
const saveExperimentalSettingsButton = document.querySelector("#saveExperimentalSettings");
const experimentalSettingsState = document.querySelector("#experimentalSettingsState");
const updateEnabledInput = document.querySelector("#updateEnabled");
const githubOwnerInput = document.querySelector("#githubOwner");
const githubRepoInput = document.querySelector("#githubRepo");
const intervalDaysInput = document.querySelector("#intervalDays");
const saveUpdateSettingsButton = document.querySelector("#saveUpdateSettings");
const checkUpdatesButton = document.querySelector("#checkUpdates");
const openUpdateDownloadButton = document.querySelector("#openUpdateDownload");
const versionState = document.querySelector("#versionState");
const updateState = document.querySelector("#updateState");
const summary = document.querySelector("#summary");
const noteRows = document.querySelector("#noteRows");
const emptyState = document.querySelector("#emptyState");
const detailDialog = document.querySelector("#detailDialog");
const detailCategory = document.querySelector("#detailCategory");
const detailTitle = document.querySelector("#detailTitle");
const detailBody = document.querySelector("#detailBody");
const detailState = document.querySelector("#detailState");
const reanalyzeDetailButton = document.querySelector("#reanalyzeDetail");
const copyTopicsButton = document.querySelector("#copyTopics");
const copyTitlePatternsButton = document.querySelector("#copyTitlePatterns");
const closeDetailButton = document.querySelector("#closeDetail");
const editDialog = document.querySelector("#editDialog");
const editForm = document.querySelector("#editForm");
const closeEditButton = document.querySelector("#closeEdit");
const editCategoryInput = document.querySelector("#editCategory");
const editTitleInput = document.querySelector("#editTitle");
const editKeywordsInput = document.querySelector("#editKeywords");
const editCoverTakeawaysInput = document.querySelector("#editCoverTakeaways");
const editContentTakeawaysInput = document.querySelector("#editContentTakeaways");
const editTopicIdeasInput = document.querySelector("#editTopicIdeas");
const editNotesInput = document.querySelector("#editNotes");
const batchDialog = document.querySelector("#batchDialog");
const batchBody = document.querySelector("#batchBody");
const closeBatchButton = document.querySelector("#closeBatch");
const selectAllRowsInput = document.querySelector("#selectAllRows");
const selectionCount = document.querySelector("#selectionCount");
const bulkCategory = document.querySelector("#bulkCategory");
const bulkMoveButton = document.querySelector("#bulkMove");
const bulkAnalyzeButton = document.querySelector("#bulkAnalyze");
const bulkDeleteButton = document.querySelector("#bulkDelete");
const exportJsonButton = document.querySelector("#exportJson");
const importJsonButton = document.querySelector("#importJson");
const importJsonFile = document.querySelector("#importJsonFile");
const exportButton = document.querySelector("#exportCsv");
const clearButton = document.querySelector("#clearAll");

let notes = [];
let categories = [];
let promptTemplates = [];
let selectedIds = new Set();
let editingNoteId = null;
let detailNoteId = null;

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

function dateLabel(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function filteredNotes() {
  const category = categoryFilter.value;
  const query = searchInput.value.trim().toLowerCase();
  const cover = coverFilter.value;
  const ai = aiFilter.value;

  return notes.filter((note) => {
    const categoryMatch = category === "全部" || note.category === category;
    const hasCover = Boolean(note.coverDataUrl || note.coverUrl);
    const abnormalCover = isAbnormalNote(note);
    const coverMatch =
      cover === "全部" ||
      (cover === "有封面" && hasCover) ||
      (cover === "无封面" && !hasCover) ||
      (cover === "封面异常" && abnormalCover);
    const hasAi = Boolean(
      (note.coverTakeaways || []).length ||
        (note.contentTakeaways || []).length ||
        (note.topicIdeas || []).length ||
        (note.notes || "").includes("AI 判断")
    );
    const aiMatch = ai === "全部" || (ai === "已分析" && hasAi) || (ai === "未分析" && !hasAi);
    const text = [
      note.title,
      note.category,
      note.notes,
      ...(note.keywords || []),
      ...(note.coverTakeaways || []),
      ...(note.contentTakeaways || []),
      ...(note.topicIdeas || [])
    ]
      .join(" ")
      .toLowerCase();
    return categoryMatch && coverMatch && aiMatch && (!query || text.includes(query));
  });
}

function isGenericCoverUrl(value) {
  return /favicon|logo|xhslink|redbook|icon|小红书/i.test(value || "");
}

function isAbnormalNote(note) {
  const source = note.coverDataUrl || note.coverUrl || "";
  if (!note.title?.trim()) return true;
  if (!source) return true;
  if (!note.coverUrl) return true;
  if (isGenericCoverUrl(note.coverUrl)) return true;
  if (note.coverDataUrl && note.coverDataUrl.length < 1200) return true;
  return false;
}

function abnormalReason(note) {
  if (!note.title?.trim()) return "标题为空";
  if (!(note.coverDataUrl || note.coverUrl)) return "无封面";
  if (!note.coverUrl) return "截图兜底";
  if (isGenericCoverUrl(note.coverUrl)) return "疑似默认图";
  if (note.coverDataUrl && note.coverDataUrl.length < 1200) return "封面过小";
  return "";
}

function renderFilters() {
  const categoryOptions = ["全部", ...categories]
    .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
    .join("");
  categoryFilter.innerHTML = categoryOptions;
  bulkCategory.innerHTML = categories
    .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
    .join("");
  editCategoryInput.innerHTML = categories
    .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
    .join("");
  promptTemplateSelect.innerHTML = promptTemplates
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
    .join("");
}

function renderSummary() {
  const counts = categories.map((category) => ({
    category,
    count: notes.filter((note) => note.category === category).length
  }));

  summary.innerHTML = counts
    .map(
      (item) => `
        <button class="summary-card" data-category="${escapeHtml(item.category)}">
          <span>${escapeHtml(item.category)}</span>
          <strong>${item.count}</strong>
        </button>
      `
    )
    .join("");
}

function firstItems(items, limit) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  return {
    shown: list.slice(0, limit),
    hiddenCount: Math.max(0, list.length - limit)
  };
}

function renderTags(items, limit = 5) {
  const { shown, hiddenCount } = firstItems(items, limit);
  const tags = shown.map((word) => `<span class="tag">${escapeHtml(word)}</span>`).join("");
  return hiddenCount ? `${tags}<span class="more-chip">+${hiddenCount}</span>` : tags;
}

function renderPreviewList(items, limit = 3) {
  const { shown, hiddenCount } = firstItems(items, limit);
  if (!shown.length) return "<span class=\"muted-text\">无</span>";
  const lines = shown.map((item) => `<p>${escapeHtml(item)}</p>`).join("");
  return `<div class="clamp-list">${lines}${hiddenCount ? `<p class="muted-text">还有 ${hiddenCount} 条...</p>` : ""}</div>`;
}

function renderNoteText(value) {
  return value ? `<div class="clamp-text">${escapeHtml(value)}</div>` : "<span class=\"muted-text\">无</span>";
}

function renderRows() {
  const rows = filteredNotes();
  selectedIds = new Set([...selectedIds].filter((id) => rows.some((note) => note.id === id)));
  emptyState.classList.toggle("hidden", rows.length > 0);
  noteRows.innerHTML = rows
    .map(
      (note) => `
        <tr class="note-row">
          <td class="select-cell">
            <input class="row-select" type="checkbox" data-select="${escapeHtml(note.id)}" ${selectedIds.has(note.id) ? "checked" : ""} />
          </td>
          <td class="cover-cell">${
            note.coverDataUrl || note.coverUrl
              ? `<img src="${escapeHtml(note.coverDataUrl || note.coverUrl)}" alt="${escapeHtml(note.title)}" referrerpolicy="no-referrer" loading="lazy" />`
              : "<span class=\"no-cover\">无</span>"
          }${isAbnormalNote(note) ? `<span class="warning-chip">${escapeHtml(abnormalReason(note))}</span>` : ""}</td>
          <td><span class="pill">${escapeHtml(note.category)}</span></td>
          <td class="title-cell">
            <a href="${escapeHtml(note.url)}" target="_blank" rel="noreferrer">${escapeHtml(note.title || "未命名笔记")}</a>
          </td>
          <td class="tags-cell">${renderTags(note.keywords)}</td>
          <td class="preview-cell">${renderPreviewList(note.coverTakeaways)}</td>
          <td class="preview-cell">${renderPreviewList(note.contentTakeaways)}</td>
          <td class="preview-cell wide-preview">${renderPreviewList(note.topicIdeas, 2)}</td>
          <td class="note-cell">${renderNoteText(note.notes)}</td>
          <td>${dateLabel(note.capturedAt)}</td>
          <td class="action-cell">
            <button class="text-button detail-button" data-detail="${escapeHtml(note.id)}">详情</button>
            <button class="text-button" data-edit="${escapeHtml(note.id)}">编辑</button>
            <button class="text-button" data-delete="${escapeHtml(note.id)}">删除</button>
          </td>
        </tr>
      `
    )
    .join("");
  noteRows.querySelectorAll(".cover-cell img").forEach((img) => {
    img.addEventListener("error", () => {
      img.replaceWith(Object.assign(document.createElement("span"), {
        className: "no-cover",
        textContent: "封面失效"
      }));
    });
  });
  updateSelectionUi(rows);
}

function updateSelectionUi(rows = filteredNotes()) {
  selectionCount.textContent = `已选择 ${selectedIds.size} 条`;
  selectAllRowsInput.checked = rows.length > 0 && rows.every((note) => selectedIds.has(note.id));
  selectAllRowsInput.indeterminate =
    rows.some((note) => selectedIds.has(note.id)) && !selectAllRowsInput.checked;
}

function renderDetailSection(title, content) {
  return `
    <section class="detail-section">
      <h3>${escapeHtml(title)}</h3>
      ${content}
    </section>
  `;
}

function renderFullList(items) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return "<p class=\"muted-text\">无</p>";
  return `<ul>${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function openDetail(note) {
  detailNoteId = note.id;
  detailState.textContent = "";
  detailCategory.textContent = note.category || "未分类";
  detailTitle.textContent = note.title || "未命名笔记";
  detailBody.innerHTML = `
    <div class="detail-cover-block">
      ${
        note.coverDataUrl || note.coverUrl
          ? `<img src="${escapeHtml(note.coverDataUrl || note.coverUrl)}" alt="${escapeHtml(note.title)}" referrerpolicy="no-referrer" />`
          : "<span class=\"no-cover\">无封面</span>"
      }
      <div>
        <a class="detail-link" href="${escapeHtml(note.url)}" target="_blank" rel="noreferrer">打开原笔记</a>
        <p class="muted-text">采集时间：${dateLabel(note.capturedAt)}</p>
        ${isAbnormalNote(note) ? `<p class="warning-text">封面异常：${escapeHtml(abnormalReason(note))}</p>` : ""}
      </div>
    </div>
    ${renderDetailSection("关键词", `<div class="detail-tags">${renderTags(note.keywords, 30)}</div>`)}
    ${renderDetailSection("封面共性", renderFullList(note.coverTakeaways))}
    ${renderDetailSection("内容共性", renderFullList(note.contentTakeaways))}
    ${renderDetailSection("选题内容", renderFullList(note.topicIdeas))}
    ${renderDetailSection("备注", note.notes ? `<p>${escapeHtml(note.notes).replace(/\n/g, "<br>")}</p>` : "<p class=\"muted-text\">无</p>")}
  `;
  detailBody.querySelectorAll("img").forEach((img) => {
    img.addEventListener("error", () => {
      img.replaceWith(Object.assign(document.createElement("span"), {
        className: "no-cover",
        textContent: "封面失效"
      }));
    });
  });
  detailDialog.showModal();
}

function splitList(value) {
  return String(value || "")
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function openEdit(note) {
  editingNoteId = note.id;
  editCategoryInput.value = note.category || categories[0];
  editTitleInput.value = note.title || "";
  editKeywordsInput.value = (note.keywords || []).join("，");
  editCoverTakeawaysInput.value = (note.coverTakeaways || []).join("\n");
  editContentTakeawaysInput.value = (note.contentTakeaways || []).join("\n");
  editTopicIdeasInput.value = (note.topicIdeas || []).join("\n");
  editNotesInput.value = note.notes || "";
  editDialog.showModal();
}

async function load() {
  categories = await window.topicStore.getCategories();
  notes = await window.topicStore.getNotes();
  promptTemplates = await window.topicStore.getPromptTemplates();
  const settings = await window.topicStore.getAiSettings();
  const updateSettings = await window.topicStore.getUpdateSettings();
  const experimentalSettings = await window.topicStore.getExperimentalSettings();
  apiKeyInput.value = settings.apiKey;
  modelNameInput.value = settings.model;
  maxTokensInput.value = settings.maxTokens;
  focusPointsInput.value = settings.focusPoints;
  customPromptInput.value = settings.customPrompt;
  aiSettingsState.textContent = settings.apiKey ? "已保存" : "未设置";
  renderExperimentalSettings(experimentalSettings);
  renderUpdateSettings(updateSettings);
  const selected = categoryFilter.value || "全部";
  renderFilters();
  if (["全部", ...categories].includes(selected)) categoryFilter.value = selected;
  renderSummary();
  renderRows();
}

function renderExperimentalSettings(settings) {
  experimentVideoCoverInput.checked = settings.videoCover;
  experimentScreenshotFallbackInput.checked = settings.screenshotFallback;
  experimentOverlayMediaInput.checked = settings.overlayMedia;
  experimentalSettingsState.textContent = settings.videoCover || settings.screenshotFallback || settings.overlayMedia
    ? "实验功能已开启"
    : "默认关闭";
}

function renderUpdateSettings(settings) {
  const currentVersion = chrome.runtime.getManifest().version;
  versionState.textContent = `当前版本：v${currentVersion}`;
  updateEnabledInput.checked = settings.enabled;
  githubOwnerInput.value = settings.githubOwner;
  githubRepoInput.value = settings.githubRepo;
  intervalDaysInput.value = settings.intervalDays;
  updateState.innerHTML = updateStateLabel(settings);
}

function updateStateLabel(settings) {
  const parts = [];
  if (settings.latestVersion) {
    const currentVersion = chrome.runtime.getManifest().version;
    const latest = escapeHtml(settings.latestVersion);
    parts.push(`最新版本：${latest}${settings.latestVersion.replace(/^v/i, "") !== currentVersion ? "（可能有更新）" : ""}`);
  }
  if (settings.lastCheckedAt) {
    parts.push(`上次检查：${dateLabel(settings.lastCheckedAt)}`);
  }
  if (settings.latestUrl) {
    parts.push(`<a href="${escapeHtml(settings.latestUrl)}" target="_blank" rel="noreferrer">打开 Release</a>`);
  }
  if (settings.latestZipUrl) {
    parts.push(`<a href="${escapeHtml(settings.latestZipUrl)}" target="_blank" rel="noreferrer">下载 zip</a>`);
  }
  return parts.join(" · ") || "未配置 GitHub 更新检查。";
}

function parseVersion(value) {
  return String(value || "")
    .replace(/^v/i, "")
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10) || 0);
}

function isNewerVersion(remote, current) {
  const a = parseVersion(remote);
  const b = parseVersion(current);
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

function zipAssetUrl(release) {
  const asset = (release.assets || []).find((item) => /\.zip$/i.test(item.name || ""));
  return asset?.browser_download_url || release.zipball_url || release.html_url || "";
}

function timeout(ms, message) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

async function checkReleaseDirectly() {
  const githubOwner = githubOwnerInput.value.trim();
  const githubRepo = githubRepoInput.value.trim();
  if (!githubOwner || !githubRepo) {
    throw new Error("请先填写 GitHub 用户和仓库名。");
  }

  const response = await Promise.race([
    fetch(`https://api.github.com/repos/${githubOwner}/${githubRepo}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" }
    }),
    timeout(12000, "检查超时，请确认网络能访问 GitHub。")
  ]);
  const release = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("没有找到最新 Release。请先在 GitHub 发布一个 Release，并上传 zip 附件。");
    }
    throw new Error(release.message || `GitHub 检查失败：${response.status}`);
  }

  const currentVersion = chrome.runtime.getManifest().version;
  const latestVersion = release.tag_name || "";
  const latestUrl = release.html_url || `https://github.com/${githubOwner}/${githubRepo}/releases`;
  const latestZipUrl = zipAssetUrl(release);
  const settings = await window.topicStore.saveUpdateSettings({
    enabled: updateEnabledInput.checked,
    githubOwner,
    githubRepo,
    intervalDays: intervalDaysInput.value,
    lastCheckedAt: new Date().toISOString(),
    latestVersion,
    latestUrl,
    latestZipUrl
  });

  return {
    hasUpdate: isNewerVersion(latestVersion, currentVersion),
    settings
  };
}

function toCsvValue(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportCsv() {
  const header = ["栏目", "标题", "关键词", "封面共性", "内容共性", "选题内容", "备注", "链接", "封面", "封面已缓存", "采集时间"];
  const rows = filteredNotes().map((note) => [
    note.category,
    note.title,
    (note.keywords || []).join(" / "),
    (note.coverTakeaways || []).join(" / "),
    (note.contentTakeaways || []).join(" / "),
    (note.topicIdeas || []).join(" / "),
    note.notes,
    note.url,
    note.coverUrl,
    note.coverDataUrl ? "是" : "否",
    note.capturedAt
  ]);
  const csv = [header, ...rows].map((row) => row.map(toCsvValue).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `小红书选题库-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

categoryFilter.addEventListener("change", renderRows);
searchInput.addEventListener("input", renderRows);
coverFilter.addEventListener("change", renderRows);
aiFilter.addEventListener("change", renderRows);
exportButton.addEventListener("click", exportCsv);

summary.addEventListener("click", (event) => {
  const card = event.target.closest("[data-category]");
  if (!card) return;
  categoryFilter.value = card.dataset.category;
  renderRows();
});

noteRows.addEventListener("click", async (event) => {
  const selectInput = event.target.closest("[data-select]");
  if (selectInput) {
    if (selectInput.checked) selectedIds.add(selectInput.dataset.select);
    else selectedIds.delete(selectInput.dataset.select);
    updateSelectionUi();
    return;
  }

  const detailButton = event.target.closest("[data-detail]");
  if (detailButton) {
    const note = notes.find((item) => item.id === detailButton.dataset.detail);
    if (note) openDetail(note);
    return;
  }

  const editButton = event.target.closest("[data-edit]");
  if (editButton) {
    const note = notes.find((item) => item.id === editButton.dataset.edit);
    if (note) openEdit(note);
    return;
  }

  const button = event.target.closest("[data-delete]");
  if (!button) return;
  await window.topicStore.deleteNote(button.dataset.delete);
  await load();
});

closeDetailButton.addEventListener("click", () => detailDialog.close());
detailDialog.addEventListener("click", (event) => {
  if (event.target === detailDialog) detailDialog.close();
});

closeEditButton.addEventListener("click", () => editDialog.close());
editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editingNoteId) return;
  await window.topicStore.updateNote(editingNoteId, {
    category: editCategoryInput.value,
    title: editTitleInput.value.trim(),
    keywords: splitList(editKeywordsInput.value),
    coverTakeaways: splitList(editCoverTakeawaysInput.value),
    contentTakeaways: splitList(editContentTakeawaysInput.value),
    topicIdeas: splitList(editTopicIdeasInput.value),
    notes: editNotesInput.value.trim(),
    updatedAt: new Date().toISOString()
  });
  editDialog.close();
  await load();
});

async function copyText(value, label) {
  const text = String(value || "").trim();
  if (!text) {
    detailState.textContent = `没有可复制的${label}`;
    return;
  }
  await navigator.clipboard.writeText(text);
  detailState.textContent = `已复制${label}`;
}

function titlePatternsFromNote(note) {
  const match = String(note.notes || "").match(/标题公式[:：]\s*([^\n]+)/);
  if (!match) return [];
  return match[1].split(/\s*\/\s*|[,，]/).map((item) => item.trim()).filter(Boolean);
}

function analysisPatch(analysis) {
  const parts = [];
  if (analysis.titlePatterns?.length) {
    parts.push(`标题公式：${analysis.titlePatterns.join(" / ")}`);
  }
  if (analysis.reason) {
    parts.push(`AI 判断：${analysis.reason}`);
  }
  return {
    category: categories.includes(analysis.categorySuggestion) ? analysis.categorySuggestion : undefined,
    keywords: analysis.keywords || [],
    coverTakeaways: analysis.coverTakeaways || [],
    contentTakeaways: analysis.contentTakeaways || [],
    topicIdeas: analysis.topicIdeas || [],
    notes: parts.join("\n"),
    updatedAt: new Date().toISOString()
  };
}

reanalyzeDetailButton.addEventListener("click", async () => {
  const note = notes.find((item) => item.id === detailNoteId);
  if (!note) return;
  reanalyzeDetailButton.disabled = true;
  detailState.textContent = "AI 分析中...";
  try {
    const settings = await window.topicStore.getAiSettings();
    const analysis = await window.topicAi.analyzeNoteWithAi({
      extraction: {
        title: note.title,
        description: note.description || "",
        url: note.url,
        coverUrl: note.coverUrl,
        tags: note.keywords || []
      },
      categories,
      settings
    });
    const patch = analysisPatch(analysis);
    Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);
    const updated = await window.topicStore.updateNote(note.id, patch);
    notes = await window.topicStore.getNotes();
    detailState.textContent = "已重新分析";
    openDetail(updated);
    renderSummary();
    renderRows();
  } catch (error) {
    detailState.textContent = error.message || "重新分析失败";
  } finally {
    reanalyzeDetailButton.disabled = false;
  }
});

copyTopicsButton.addEventListener("click", async () => {
  const note = notes.find((item) => item.id === detailNoteId);
  await copyText((note?.topicIdeas || []).join("\n"), "选题");
});

copyTitlePatternsButton.addEventListener("click", async () => {
  const note = notes.find((item) => item.id === detailNoteId);
  await copyText(titlePatternsFromNote(note).join("\n"), "标题公式");
});

closeBatchButton.addEventListener("click", () => batchDialog.close());

addCategoryButton.addEventListener("click", async () => {
  const value = newCategoryInput.value.trim();
  if (!value) return;
  categories = await window.topicStore.saveCategories([...categories, value]);
  newCategoryInput.value = "";
  await load();
});

saveAiSettingsButton.addEventListener("click", async () => {
  const settings = await window.topicStore.saveAiSettings({
    apiKey: apiKeyInput.value,
    model: modelNameInput.value,
    maxTokens: maxTokensInput.value,
    focusPoints: focusPointsInput.value,
    customPrompt: customPromptInput.value
  });
  aiSettingsState.textContent = settings.apiKey ? "已保存" : "未设置";
});

saveExperimentalSettingsButton.addEventListener("click", async () => {
  const settings = await window.topicStore.saveExperimentalSettings({
    videoCover: experimentVideoCoverInput.checked,
    screenshotFallback: experimentScreenshotFallbackInput.checked,
    overlayMedia: experimentOverlayMediaInput.checked
  });
  renderExperimentalSettings(settings);
});

promptTemplateSelect.addEventListener("change", () => {
  const template = promptTemplates.find((item) => item.id === promptTemplateSelect.value);
  if (template) customPromptInput.value = template.prompt;
});

resetPromptButton.addEventListener("click", () => {
  customPromptInput.value = window.topicStore.DEFAULT_CUSTOM_PROMPT;
  aiSettingsState.textContent = "已恢复默认 Prompt，记得保存";
});

selectAllRowsInput.addEventListener("change", () => {
  const rows = filteredNotes();
  if (selectAllRowsInput.checked) {
    rows.forEach((note) => selectedIds.add(note.id));
  } else {
    rows.forEach((note) => selectedIds.delete(note.id));
  }
  renderRows();
});

bulkMoveButton.addEventListener("click", async () => {
  if (!selectedIds.size) return alert("请先选择记录。");
  await window.topicStore.updateNotes([...selectedIds], { category: bulkCategory.value });
  selectedIds.clear();
  await load();
});

bulkDeleteButton.addEventListener("click", async () => {
  if (!selectedIds.size) return alert("请先选择记录。");
  if (!confirm(`确定删除选中的 ${selectedIds.size} 条记录吗？`)) return;
  await window.topicStore.deleteNotes([...selectedIds]);
  selectedIds.clear();
  await load();
});

function renderBatchResult(result) {
  batchBody.innerHTML = `
    ${renderDetailSection("一句话总结", `<p>${escapeHtml(result.summary || "")}</p>`)}
    ${renderDetailSection("高频关键词", `<div class="detail-tags">${renderTags(result.commonKeywords || [], 40)}</div>`)}
    ${renderDetailSection("封面套路", renderFullList(result.coverPatterns || []))}
    ${renderDetailSection("标题公式", renderFullList(result.titleFormulas || []))}
    ${renderDetailSection("内容共性", renderFullList(result.contentPatterns || []))}
    ${renderDetailSection("下一步选题", renderFullList(result.nextTopics || []))}
  `;
  batchDialog.showModal();
}

bulkAnalyzeButton.addEventListener("click", async () => {
  const selected = notes.filter((note) => selectedIds.has(note.id));
  if (selected.length < 2) return alert("请至少选择 2 条记录做批量总结。");
  batchBody.innerHTML = "<p class=\"muted-text\">AI 正在总结选中记录...</p>";
  batchDialog.showModal();
  try {
    const settings = await window.topicStore.getAiSettings();
    renderBatchResult(await window.topicAi.summarizeNotesWithAi({ notes: selected, settings }));
  } catch (error) {
    batchBody.innerHTML = `<p class="muted-text">${escapeHtml(error.message || "批量总结失败。")}</p>`;
  }
});

exportJsonButton.addEventListener("click", async () => {
  const backup = await window.topicStore.exportBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `小红书选题库备份-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
});

importJsonButton.addEventListener("click", () => importJsonFile.click());
importJsonFile.addEventListener("change", async () => {
  const file = importJsonFile.files?.[0];
  if (!file) return;
  try {
    const backup = JSON.parse(await file.text());
    await window.topicStore.importBackup(backup);
    selectedIds.clear();
    await load();
  } catch (error) {
    alert(error.message || "导入失败。");
  } finally {
    importJsonFile.value = "";
  }
});

saveUpdateSettingsButton.addEventListener("click", async () => {
  const settings = await window.topicStore.saveUpdateSettings({
    enabled: updateEnabledInput.checked,
    githubOwner: githubOwnerInput.value,
    githubRepo: githubRepoInput.value,
    intervalDays: intervalDaysInput.value
  });
  renderUpdateSettings(settings);
  chrome.runtime.sendMessage({ type: "CONFIGURE_UPDATE_ALARM" });
});

checkUpdatesButton.addEventListener("click", async () => {
  updateState.textContent = "正在检查 GitHub Release...";
  try {
    const response = await checkReleaseDirectly();
    renderUpdateSettings(response.settings);
    if (response.hasUpdate && confirm(`发现新版 ${response.settings.latestVersion}，要打开下载页吗？`)) {
      chrome.runtime.sendMessage({ type: "OPEN_UPDATE_DOWNLOAD" });
    }
  } catch (error) {
    updateState.textContent = error.message || "检查更新失败。";
    return;
  }
});

openUpdateDownloadButton.addEventListener("click", async () => {
  const settings = await window.topicStore.getUpdateSettings();
  const url = settings.latestZipUrl || settings.latestUrl;
  if (!url) {
    updateState.textContent = "还没有下载链接，请先点“立即检查”。";
    return;
  }
  window.open(url, "_blank", "noopener");
  window.open("chrome://extensions/", "_blank", "noopener");
});

clearButton.addEventListener("click", async () => {
  if (!confirm("确定清空所有本地采集内容吗？")) return;
  await window.topicStore.clearNotes();
  await load();
});

load();
