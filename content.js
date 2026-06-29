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

function firstImage() {
  const ogImage = normalizeUrl(getMeta("og:image"));
  if (ogImage) return ogImage;

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
      height: img.naturalHeight || img.height
    }))
    .filter((img) => img.src && img.width >= 180 && img.height >= 180)
    .sort((a, b) => b.width * b.height - a.width * a.height);

  if (images[0]?.src) return images[0].src;

  const backgroundCandidates = Array.from(document.querySelectorAll("[style], .swiper-slide, .note-slider, .media-container"))
    .map((el) => normalizeUrl(backgroundImageUrl(el)))
    .filter(Boolean);

  return backgroundCandidates[0] || "";
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "XHS_EXTRACT_NOTE") return;

  const title = extractTitle();
  const description = extractDescription();
  const fullText = `${title} ${description}`;

  sendResponse({
    title,
    description,
    coverUrl: firstImage(),
    url: location.href,
    tags: extractTags(fullText),
    capturedAt: new Date().toISOString()
  });
});
