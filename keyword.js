const STOP_WORDS = new Set([
  "一个",
  "这个",
  "那个",
  "可以",
  "就是",
  "不是",
  "没有",
  "自己",
  "真的",
  "因为",
  "所以",
  "但是",
  "然后",
  "小红书",
  "教程",
  "分享",
  "笔记",
  "图片",
  "视频"
]);

function tokenize(text) {
  const words = [];
  const latin = text.match(/[a-zA-Z][a-zA-Z0-9_-]{2,}/g) || [];
  words.push(...latin.map((word) => word.toLowerCase()));

  const chinese = text.replace(/[^\u4e00-\u9fa5]/g, "");
  for (let size = 4; size >= 2; size -= 1) {
    for (let i = 0; i <= chinese.length - size; i += 1) {
      words.push(chinese.slice(i, i + size));
    }
  }

  return words.filter((word) => !STOP_WORDS.has(word));
}

function extractKeywords(text, tags = []) {
  const counts = new Map();
  for (const word of tokenize(text)) {
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  for (const tag of tags) {
    counts.set(tag, (counts.get(tag) || 0) + 4);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([word]) => word)
    .filter((word, index, list) => {
      const before = list.slice(0, index);
      return !before.some((item) => item.includes(word) || word.includes(item));
    })
    .slice(0, 10);
}

function suggestTopicIdeas(title, keywords) {
  const main = keywords.slice(0, 5);
  if (!main.length && !title) return [];

  const seed = main[0] || title;
  return [
    `${seed}的3个关键步骤`,
    `新手也能看懂的${seed}拆解`,
    `${seed}前后对比/案例合集`,
    `常见误区：为什么你的${seed}不出效果`
  ];
}

function suggestTakeaways(title, description, keywords) {
  const text = `${title} ${description}`;
  const main = keywords[0] || title || "主题";
  const coverTakeaways = [];
  const contentTakeaways = [];

  if (/新手|零基础|入门/.test(text)) {
    coverTakeaways.push("突出新手友好、低门槛");
    contentTakeaways.push("适合拆成步骤型教程");
  }
  if (/对比|前后|变化/.test(text)) {
    coverTakeaways.push("用前后对比强化效果");
    contentTakeaways.push("适合做案例拆解");
  }
  if (/步骤|过程|教程|画法/.test(text)) {
    coverTakeaways.push("封面可放关键步骤或完成图");
    contentTakeaways.push("内容按流程拆解更清晰");
  }
  if (/合集|整理|模板|素材/.test(text)) {
    coverTakeaways.push("强调合集感和信息密度");
    contentTakeaways.push("适合延展成系列内容");
  }

  if (!coverTakeaways.length) {
    coverTakeaways.push(`围绕“${main}”做强识别标题`);
  }
  if (!contentTakeaways.length) {
    contentTakeaways.push(`从“${main}”提炼可复用角度`);
  }

  return {
    coverTakeaways: coverTakeaways.slice(0, 4),
    contentTakeaways: contentTakeaways.slice(0, 4)
  };
}

globalThis.topicKeywords = {
  extractKeywords,
  suggestTopicIdeas,
  suggestTakeaways
};
