function textFrom(selector) {
  const el = document.querySelector(selector);
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
    height: rect.height
  };
}

function isLikelyMainMediaRect(rect) {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  if (!rect || rect.width < 180 || rect.height < 180) return false;
  if (rect.x > viewportWidth * 0.62) return false;
  if (rect.y > viewportHeight * 0.75) return false;
  return true;
}

function mainMediaRect() {
  const candidates = [
    ...Array.from(document.querySelectorAll("video, canvas")),
    ...Array.from(document.images),
    ...Array.from(document.querySelectorAll("[style], .swiper-slide, .note-slider, .media-container"))
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
  return Array.from(document.querySelectorAll("video"))
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

  const images = Array.from(document.images)
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

  const backgroundCandidates = Array.from(document.querySelectorAll("body *"))
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "XHS_EXTRACT_NOTE") return;

  extractNoteWithRetry().then(sendResponse);
  return true;
});
