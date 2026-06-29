function textFrom(selector) {
  const el = activeRoot().querySelector(selector) || document.querySelector(selector);
  return el ? el.textContent.trim().replace(/\s+/g, " ") : "";
}

function getMeta(nameOrProperty) {
  const escaped = CSS.escape(nameOrProperty);
  const el = document.querySelector(
    `meta[name="${escaped}"], meta[property="${escaped}"]`
  );
  return el ? el.getAttribute("content") || "" : "";
}

function normalizeUrl(url) {
  if (!url) return "";
  if (/^(blob:|data:)/i.test(url)) return "";
  try {
    return new URL(url, location.href).href;
  } catch (_error) {
    return "";
  }
}

function bestFromSrcset(srcset) {
  if (!srcset) return "";
  return srcset
    .split(",")
    .map((item) => item.trim().split(/\s+/)[0])
    .filter(Boolean)
    .pop() || "";
}

function backgroundImageUrl(el) {
  const value = getComputedStyle(el).backgroundImage;
  const match = value && value.match(/url\(["']?(.+?)["']?\)/);
  return match ? match[1] : "";
}

function activeRoot() {
  const candidates = Array.from(document.querySelectorAll("body *"))
    .map((el) => ({
      el,
      rect: el.getBoundingClientRect(),
      style: getComputedStyle(el)
    }))
    .filter(({ rect, style }) => {
      const area = rect.width * rect.height;
      const fixedLike = style.position === "fixed" || style.position === "sticky";
      return area > window.innerWidth * window.innerHeight * 0.25 && rect.width > 420 && rect.height > 360 && (fixedLike || rect.left > 120);
    })
    .map(({ el, rect, style }) => {
      const text = el.textContent || "";
      const mediaCount = el.querySelectorAll("img, video, canvas").length;
      const detailWords = /(评论|点赞|收藏|关注|回复|作者|分享)/.test(text) ? 1 : 0;
      const z = Number.parseInt(style.zIndex, 10) || 0;
      const centerBonus = rect.left > window.innerWidth * 0.08 && rect.right < window.innerWidth * 0.95 ? 20 : 0;
      return { el, score: mediaCount * 30 + detailWords * 30 + z + centerBonus + rect.width * rect.height / 100000 };
    })
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.el || document;
}

function currentActiveRoot() {
  return activeRoot() === document ? document.body : activeRoot();
}

function isGenericImage(url) {
  return /sns-avatar|avatar|favicon|logo|xhslink|小红书|redbook|icon|data:image\/svg/i.test(url || "");
}

function imageScore(item) {
  const area = (item.width || 0) * (item.height || 0);
  const urlBonus = /xhscdn|sns-webpic|sns-img|spectrum/.test(item.src) ? 100000 : 0;
  const ratio = item.width && item.height ? item.width / item.height : 1;
  const ratioBonus = ratio > 0.45 && ratio < 2.4 ? 50000 : 0;
  const rectBonus = item.rect && isLikelyMainMediaRect(item.rect) ? 1000000 : 0;
  return area + urlBonus + ratioBonus + rectBonus;
}

function rectFromElement(el) {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    viewportWidth: window.innerWidth || document.documentElement.clientWidth,
    viewportHeight: window.innerHeight || document.documentElement.clientHeight
  };
}

function isLikelyMainMediaRect(rect) {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  if (!rect || rect.width < 180 || rect.height < 180) return false;
  const rootRect = activeRoot() === document ? null : activeRoot().getBoundingClientRect();
  const rightLimit = rootRect ? rootRect.left + rootRect.width * 0.55 : viewportWidth * 0.62;
  if (rect.x > rightLimit) return false;
  if (rect.y > viewportHeight * 0.75) return false;
  return true;
}

function mainMediaRect() {
  const candidates = [
    ...Array.from(activeRoot().querySelectorAll("video, canvas")),
    ...Array.from(activeRoot().querySelectorAll("img")),
    ...Array.from(activeRoot().querySelectorAll("[style], .swiper-slide, .note-slider, .media-container"))
  ]
    .map((el) => ({
      el,
      rect: rectFromElement(el),
      src:
        el.tagName === "IMG"
          ? normalizeUrl(el.currentSrc || bestFromSrcset(el.srcset) || el.src)
          : normalizeUrl(backgroundImageUrl(el))
    }))
    .filter((item) => isLikelyMainMediaRect(item.rect) && !isGenericImage(item.src))
    .sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height);

  return candidates[0]?.rect || null;
}

function videoPosterCandidates() {
  return Array.from(activeRoot().querySelectorAll("video"))
    .map((video) => ({
      src: normalizeUrl(
        video.getAttribute("poster") ||
          video.poster ||
          video.getAttribute("data-poster") ||
          video.getAttribute("x5-video-poster")
      ),
      width: video.videoWidth || video.clientWidth || 0,
      height: video.videoHeight || video.clientHeight || 0,
      rect: rectFromElement(video)
    }))
    .filter((item) => item.src && !isGenericImage(item.src) && isLikelyMainMediaRect(item.rect));
}

function firstImage() {
  const videoPosters = videoPosterCandidates();
  if (videoPosters.length) {
    return videoPosters.sort((a, b) => imageScore(b) - imageScore(a))[0].src;
  }

  const images = Array.from(activeRoot().querySelectorAll("img"))
    .map((img) => ({
      src: normalizeUrl(
        img.currentSrc ||
          bestFromSrcset(img.srcset) ||
          img.getAttribute("data-src") ||
          img.getAttribute("data-original") ||
          img.src
      ),
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      rect: rectFromElement(img)
    }))
    .filter((img) => img.src && !isGenericImage(img.src) && img.width >= 180 && img.height >= 180 && isLikelyMainMediaRect(img.rect))
    .sort((a, b) => imageScore(b) - imageScore(a));

  if (images[0]?.src) return images[0].src;

  const ogImage = normalizeUrl(getMeta("og:image"));
  if (ogImage && !isGenericImage(ogImage)) return ogImage;

  const backgroundCandidates = Array.from(activeRoot().querySelectorAll("*"))
    .map((el) => ({
      src: normalizeUrl(backgroundImageUrl(el)),
      width: el.clientWidth || 0,
      height: el.clientHeight || 0,
      rect: rectFromElement(el)
    }))
    .filter((item) => item.src && !isGenericImage(item.src) && item.width >= 160 && item.height >= 120 && isLikelyMainMediaRect(item.rect))
    .sort((a, b) => imageScore(b) - imageScore(a));

  return backgroundCandidates[0]?.src || "";
}

function extractTitle() {
  const candidates = [
    getMeta("og:title"),
    getMeta("twitter:title"),
    textFrom("#detail-title"),
    textFrom(".title"),
    textFrom("h1"),
    document.title
  ];

  return candidates.find(Boolean)?.replace(/- 小红书$/, "").trim() || "";
}

function extractDescription() {
  const candidates = [
    getMeta("description"),
    getMeta("og:description"),
    textFrom("#detail-desc"),
    textFrom(".desc"),
    textFrom("article")
  ];

  return candidates.find(Boolean)?.slice(0, 1200) || "";
}

function extractTags(text) {
  const fromHashtags = Array.from(text.matchAll(/#([^\s#，。,.!?！？]+)/g))
    .map((match) => match[1])
    .filter(Boolean);

  return Array.from(new Set(fromHashtags)).slice(0, 12);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function extractNoteWithRetry() {
  const title = extractTitle();
  const description = extractDescription();
  const fullText = `${title} ${description}`;
  let coverUrl = firstImage();
  let coverRect = mainMediaRect();

  if (!coverUrl) {
    await sleep(1200);
    coverUrl = firstImage();
    coverRect = mainMediaRect();
  }

  if (!coverUrl) {
    await sleep(1800);
    coverUrl = firstImage();
    coverRect = mainMediaRect();
  }

  return {
    title,
    description,
    coverUrl,
    coverRect,
    url: location.href,
    tags: extractTags(fullText),
    capturedAt: new Date().toISOString()
  };
}

let pickerOverlay = null;
let pickerBox = null;

function removePicker() {
  if (pickerOverlay) pickerOverlay.remove();
  if (pickerBox) pickerBox.remove();
  pickerOverlay = null;
  pickerBox = null;
  document.querySelectorAll("[data-xhs-picker-bound]").forEach((el) => {
    el.removeAttribute("data-xhs-picker-bound");
  });
}

function selectableCoverElements() {
  return [
    ...Array.from(currentActiveRoot().querySelectorAll("img, video, canvas")),
    ...Array.from(currentActiveRoot().querySelectorAll("[style]"))
  ].filter((el) => {
    const rect = rectFromElement(el);
    return rect.width >= 80 && rect.height >= 80 && isLikelyMainMediaRect(rect);
  });
}

function elementCoverUrl(el) {
  if (el.tagName === "IMG") {
    return normalizeUrl(el.currentSrc || bestFromSrcset(el.srcset) || el.getAttribute("data-src") || el.src);
  }
  if (el.tagName === "VIDEO") {
    return normalizeUrl(el.getAttribute("poster") || el.poster || el.getAttribute("data-poster"));
  }
  return normalizeUrl(backgroundImageUrl(el));
}

function startCoverPicker(sendResponse) {
  removePicker();
  pickerOverlay = document.createElement("div");
  pickerOverlay.style.cssText = "position:fixed;inset:0;cursor:crosshair;background:rgba(0,0,0,.08);z-index:2147483646";
  pickerBox = document.createElement("div");
  pickerBox.style.cssText = "position:fixed;pointer-events:none;border:3px solid #d7374a;background:rgba(215,55,74,.16);z-index:2147483647;border-radius:8px;display:none";
  document.documentElement.appendChild(pickerOverlay);
  document.documentElement.appendChild(pickerBox);

  const cleanup = () => {
    document.removeEventListener("mousedown", onDown, true);
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("mouseup", onUp, true);
    document.removeEventListener("keydown", onKey, true);
    removePicker();
  };
  const hint = document.createElement("div");
  hint.textContent = "按住拖出封面范围，松开保存；Esc 取消";
  hint.style.cssText = "position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483647;background:#202124;color:#fff;border-radius:999px;padding:9px 14px;font:14px -apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.24)";
  pickerOverlay.appendChild(hint);

  let start = null;
  let current = null;
  const draw = () => {
    if (!start || !current) return;
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const width = Math.abs(start.x - current.x);
    const height = Math.abs(start.y - current.y);
    pickerBox.style.display = "block";
    pickerBox.style.left = `${x}px`;
    pickerBox.style.top = `${y}px`;
    pickerBox.style.width = `${width}px`;
    pickerBox.style.height = `${height}px`;
  };
  const onDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    start = { x: event.clientX, y: event.clientY };
    current = { ...start };
    draw();
  };
  const onMove = (event) => {
    if (!start) return;
    event.preventDefault();
    event.stopPropagation();
    current = { x: event.clientX, y: event.clientY };
    draw();
  };
  const onUp = (event) => {
    if (!start || !current) return;
    event.preventDefault();
    event.stopPropagation();
    current = { x: event.clientX, y: event.clientY };
    const rect = {
      x: Math.min(start.x, current.x),
      y: Math.min(start.y, current.y),
      width: Math.abs(start.x - current.x),
      height: Math.abs(start.y - current.y),
      viewportWidth: window.innerWidth || document.documentElement.clientWidth,
      viewportHeight: window.innerHeight || document.documentElement.clientHeight
    };
    if (rect.width < 40 || rect.height < 40) {
      sendResponse({ canceled: true });
      cleanup();
      return;
    }
    sendResponse({ coverUrl: "", coverRect: rect, screenshotOnly: true });
    cleanup();
  };
  const onKey = (event) => {
    if (event.key === "Escape") {
      sendResponse({ canceled: true });
      cleanup();
    }
  };
  document.addEventListener("mousedown", onDown, true);
  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("mouseup", onUp, true);
  document.addEventListener("keydown", onKey, true);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "XHS_PICK_COVER") {
    startCoverPicker(sendResponse);
    return true;
  }
  if (message?.type !== "XHS_EXTRACT_NOTE") return;

  extractNoteWithRetry().then(sendResponse);
  return true;
});
