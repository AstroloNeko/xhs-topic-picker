importScripts("storage.js", "keyword.js", "ai.js", "cover.js");

const MENU_ID = "xhs-ai-save";
const UPDATE_ALARM = "xhs-update-check";
const UPDATE_NOTIFICATION_ID = "xhs-update-available";

function isXhsUrl(url) {
  return /^https:\/\/www\.xiaohongshu\.com\//.test(url || "");
}

function draftKey(tabId) {
  return `draft:${tabId}`;
}

async function setBadge(tabId, text, color = "#d7374a") {
  await chrome.action.setBadgeBackgroundColor({ tabId, color });
  await chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => {
    chrome.action.setBadgeText({ tabId, text: "" });
  }, 3500);
}

async function extractFromTab(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "XHS_EXTRACT_NOTE" });
  } catch (_error) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
    return chrome.tabs.sendMessage(tabId, { type: "XHS_EXTRACT_NOTE" });
  }
}

function noteFromAnalysis(extraction, analysis, category) {
  const notes = [];
  if (analysis.titlePatterns?.length) {
    notes.push(`标题公式：${analysis.titlePatterns.join(" / ")}`);
  }
  if (analysis.reason) {
    notes.push(`AI 判断：${analysis.reason}`);
  }

  return {
    ...extraction,
    category,
    keywords: analysis.keywords,
    coverTakeaways: analysis.coverTakeaways,
    contentTakeaways: analysis.contentTakeaways,
    topicIdeas: analysis.topicIdeas,
    notes: notes.join("\n")
  };
}

async function analyzeAndSave(tab) {
  if (!tab?.id || !isXhsUrl(tab.url)) return;

  await setBadge(tab.id, "AI", "#9a6700");

  try {
    const [settings, categories] = await Promise.all([
      globalThis.topicStore.getAiSettings(),
      globalThis.topicStore.getCategories()
    ]);
    const extraction = await extractFromTab(tab.id);
    extraction.coverDataUrl = await globalThis.topicCover.cacheCoverImage(extraction.coverUrl);
    const analysis = await globalThis.topicAi.analyzeNoteWithAi({
      extraction,
      categories,
      settings
    });

    const suggested = analysis.categorySuggestion?.trim();
    const category = suggested || categories[0];
    if (suggested && !categories.includes(suggested)) {
      await globalThis.topicStore.saveCategories([...categories, suggested]);
    }

    await globalThis.topicStore.saveNote(noteFromAnalysis(extraction, analysis, category));
    await chrome.storage.session.set({
      [draftKey(tab.id)]: {
        extraction,
        form: noteFromAnalysis(extraction, analysis, category),
        updatedAt: new Date().toISOString()
      }
    });
    await setBadge(tab.id, "OK", "#187d59");
  } catch (_error) {
    await setBadge(tab.id, "ERR", "#a21d2b");
  }
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

async function openUpdatePages(settings) {
  const url = settings.latestZipUrl || settings.latestUrl;
  if (!url) throw new Error("还没有可用下载链接，请先检查更新。");
  await chrome.tabs.create({ url });
  await chrome.tabs.create({ url: "chrome://extensions/" }).catch(() => {});
}

async function notifyUpdateAvailable(settings) {
  if (!settings.latestVersion || settings.notifiedVersion === settings.latestVersion) return;

  await chrome.notifications.create(UPDATE_NOTIFICATION_ID, {
    type: "basic",
    iconUrl: "icon.png",
    title: "小红书选题器有新版",
    message: `发现 ${settings.latestVersion}，是否打开下载页？`,
    buttons: [{ title: "下载新版" }, { title: "稍后" }],
    priority: 2
  });

  await globalThis.topicStore.saveUpdateSettings({
    ...settings,
    notifiedVersion: settings.latestVersion
  });
}

async function configureUpdateAlarm() {
  const settings = await globalThis.topicStore.getUpdateSettings();
  await chrome.alarms.clear(UPDATE_ALARM);
  if (!settings.enabled || !settings.githubOwner || !settings.githubRepo) return;

  chrome.alarms.create(UPDATE_ALARM, {
    delayInMinutes: 1,
    periodInMinutes: settings.intervalDays * 24 * 60
  });
}

async function checkForUpdates({ force = false } = {}) {
  const settings = await globalThis.topicStore.getUpdateSettings();
  if (!settings.enabled || !settings.githubOwner || !settings.githubRepo) {
    return { skipped: true };
  }

  if (!force && settings.lastCheckedAt) {
    const last = new Date(settings.lastCheckedAt).getTime();
    const intervalMs = settings.intervalDays * 24 * 60 * 60 * 1000;
    if (Date.now() - last < intervalMs) return { skipped: true };
  }

  const response = await fetch(
    `https://api.github.com/repos/${settings.githubOwner}/${settings.githubRepo}/releases/latest`,
    { headers: { Accept: "application/vnd.github+json" } }
  );
  const release = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(release.message || `GitHub 检查失败：${response.status}`);

  const latestVersion = release.tag_name || "";
  const latestUrl = release.html_url || `https://github.com/${settings.githubOwner}/${settings.githubRepo}/releases`;
  const latestZipUrl = zipAssetUrl(release);
  const updatedSettings = await globalThis.topicStore.saveUpdateSettings({
    ...settings,
    lastCheckedAt: new Date().toISOString(),
    latestVersion,
    latestUrl,
    latestZipUrl
  });

  const hasUpdate = isNewerVersion(latestVersion, chrome.runtime.getManifest().version);
  await chrome.action.setBadgeText({ text: hasUpdate ? "NEW" : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#187d59" });
  if (hasUpdate) await notifyUpdateAvailable(updatedSettings);

  return { hasUpdate, settings: updatedSettings };
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "AI 分析并保存到选题器",
      contexts: ["page", "selection", "image", "link"],
      documentUrlPatterns: ["https://www.xiaohongshu.com/*"]
    });
  });
  configureUpdateAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  configureUpdateAlarm();
  checkForUpdates().catch(() => {});
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID) analyzeAndSave(tab);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_ALARM) checkForUpdates({ force: true }).catch(() => {});
});

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (notificationId !== UPDATE_NOTIFICATION_ID) return;
  const settings = await globalThis.topicStore.getUpdateSettings();
  if (buttonIndex === 0) await openUpdatePages(settings);
  chrome.notifications.clear(notificationId);
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (notificationId !== UPDATE_NOTIFICATION_ID) return;
  const settings = await globalThis.topicStore.getUpdateSettings();
  await openUpdatePages(settings);
  chrome.notifications.clear(notificationId);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "CHECK_FOR_UPDATES") {
    checkForUpdates({ force: true })
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message || "检查更新失败" }));
    return true;
  }
  if (message?.type === "CONFIGURE_UPDATE_ALARM") {
    configureUpdateAlarm()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ error: error.message || "更新检查设置失败" }));
    return true;
  }
  if (message?.type === "OPEN_UPDATE_DOWNLOAD") {
    globalThis.topicStore.getUpdateSettings()
      .then(openUpdatePages)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ error: error.message || "打开下载页失败" }));
    return true;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    chrome.storage.session.remove(draftKey(tabId));
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(draftKey(tabId));
});
