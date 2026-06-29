const COVER_CACHE_MAX_BYTES = 2 * 1024 * 1024;

function blobToDataUrl(blob) {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return `data:${blob.type || "image/jpeg"};base64,${btoa(binary)}`;
  });
}

async function cacheCoverImage(url) {
  if (!url || url.startsWith("data:")) return "";

  try {
    const response = await fetch(url, {
      credentials: "omit",
      cache: "force-cache",
      referrerPolicy: "no-referrer"
    });
    if (!response.ok) return "";

    const blob = await response.blob();
    if (!blob.type.startsWith("image/") || blob.size > COVER_CACHE_MAX_BYTES) {
      return "";
    }

    return blobToDataUrl(blob);
  } catch (_error) {
    return "";
  }
}

globalThis.topicCover = {
  cacheCoverImage
};
