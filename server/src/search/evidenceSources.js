const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'mc_cid', 'mc_eid'
]);

const MEDIA_DOMAINS = [
  'bbc.com', 'reuters.com', 'apnews.com', 'nytimes.com', 'theguardian.com',
  'xinhuanet.com', 'people.com.cn', 'chinanews.com.cn', 'thepaper.cn', 'caixin.com'
];

export const EVIDENCE_LIBRARY_LIMIT = 40;
export const SEARCH_SOURCE_LIMIT = 5;
export const SEARCH_CONTEXT_LIMIT = 12000;
export const EVIDENCE_TITLE_LIMIT = 30;
export const EVIDENCE_SUMMARY_LIMIT = 180;
export const EVIDENCE_SUMMARY_FALLBACK = '暂未生成有效摘要，请查看原始来源。';

export function cleanEvidenceSummaryInput(value, limit = 2400) {
  let text = String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(?:^|\n)\s*#{0,6}\s*(?:references\b|参考文献)[\s\S]*$/gim, ' ')
    .replace(/(?:^|\n)\s*#{0,6}\s*(?:doi\b|keywords?\b|关键词)\s*[:：]?[^\n]*/gim, ' ')
    .replace(/(?:^|\n)\s*(?:作者(?:单位)?|单位|通讯作者|通信作者|地址|邮编|发布日期|发布时间|收稿日期|接受日期|authors?|affiliations?|corresponding author|published(?: at| on)?)\s*[:：][^\n]*/gim, ' ')
    .replace(/\b(?:https?:\/\/)?(?:dx\.)?doi\.org\/\S+|\bdoi\s*[:：]?\s*10\.\d{4,9}\/\S+/gi, ' ')
    .replace(/(?:作者(?:单位)?|单位|通讯作者|通信作者|地址|邮编|发布日期|发布时间|收稿日期|接受日期)\s*[:：][^。；;]{0,300}[。；;]/g, ' ')
    .replace(/#{1,6}\s*(?:abstract|摘要)\s*[:：]?/gi, ' ')
    .replace(/\b(?:keywords?|abstract)\s*[:：]/gi, ' ')
    .replace(/(?:请升级浏览器|浏览器版本过低|下载全文|立即下载|登录后查看|请登录|订阅后阅读|subscribe|sign in|log in)/gi, ' ')
    .replace(/[|_*~`]{2,}/g, ' ')
    .replace(/(?:[-=—]{3,}|[◆◇■□●○▶►]{2,})/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const referencesIndex = text.search(/(?:^|\s)(?:references|参考文献)\s*[:：]?/i);
  if (referencesIndex >= 0) text = text.slice(0, referencesIndex).trim();
  return sliceCharacters(text, limit);
}

export function sanitizeEvidenceTitle(value) {
  return sliceCharacters(cleanEvidenceSummaryInput(value, 200), EVIDENCE_TITLE_LIMIT);
}

export function sanitizeEvidenceDisplaySummary(value) {
  const summary = cleanEvidenceSummaryInput(value, EVIDENCE_SUMMARY_LIMIT);
  if (!/[\u3400-\u9FFF]/.test(summary)) return '';
  return summary;
}

export function resolveEvidenceDisplaySummary(displaySummary, legacyFields = []) {
  const primary = sanitizeEvidenceDisplaySummary(displaySummary);
  if (primary) return primary;
  for (const legacy of Array.isArray(legacyFields) ? legacyFields : []) {
    const cleanedLegacy = sanitizeEvidenceDisplaySummary(legacy);
    if (cleanedLegacy) return cleanedLegacy;
  }
  return EVIDENCE_SUMMARY_FALLBACK;
}

export function canonicalizeEvidenceUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
        url.searchParams.delete(key);
      }
    }
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    url.searchParams.sort();
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeEvidenceLibrary(value) {
  const rows = Array.isArray(value) ? value : [];
  const seen = new Set();
  const normalized = [];
  for (const row of rows) {
    const url = canonicalizeEvidenceUrl(row?.url);
    if (!url || seen.has(url)) continue;
    const id = /^E[1-9]\d*$/.test(String(row?.id || '')) ? String(row.id) : '';
    if (!id) continue;
    seen.add(url);
    normalized.push({
      id,
      title: clean(row?.title, 240),
      url,
      domain: domainOf(url),
      snippet: clean(row?.snippet, 500),
      sourceType: normalizeSourceType(row?.sourceType, url),
      publisher: clean(row?.publisher, 240),
      publishedAt: normalizeIso(row?.publishedAt),
      query: clean(row?.query, 200),
      retrievedAt: normalizeIso(row?.retrievedAt)
    });
  }
  return normalized
    .sort((a, b) => evidenceNumber(a.id) - evidenceNumber(b.id))
    .slice(-EVIDENCE_LIBRARY_LIMIT);
}

export function cleanEvidenceResults(rawResults, options = {}) {
  const existing = normalizeEvidenceLibrary(options.existingLibrary);
  const byUrl = new Map(existing.map((item) => [item.url, item]));
  let nextId = existing.reduce((max, item) => Math.max(max, evidenceNumber(item.id)), 0) + 1;
  const retrievedAt = normalizeIso(options.retrievedAt) || new Date().toISOString();
  const sources = [];
  let contextLength = 0;

  const rankedResults = (Array.isArray(rawResults) ? rawResults : [])
    .map((raw, index) => ({ raw, index, rank: evidenceRank(raw, index) }))
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map((item) => item.raw);

  for (const raw of rankedResults) {
    if (sources.length >= (options.limit || SEARCH_SOURCE_LIMIT)) break;
    const url = canonicalizeEvidenceUrl(raw?.url);
    if (!url || sources.some((item) => item.url === url)) continue;
    const title = clean(raw?.title, 240);
    const snippet = clean(raw?.snippet, 500);
    let contentExcerpt = clean(raw?.content, 1800);
    if (!title && !snippet && !contentExcerpt) continue;
    const remaining = Math.max(0, (options.contextLimit || SEARCH_CONTEXT_LIMIT) - contextLength);
    contentExcerpt = contentExcerpt.slice(0, remaining);
    contextLength += title.length + snippet.length + contentExcerpt.length;
    const saved = byUrl.get(url);
    sources.push({
      id: saved?.id || `E${nextId++}`,
      title: title || saved?.title || domainOf(url),
      url,
      domain: domainOf(url),
      snippet: snippet || saved?.snippet || contentExcerpt.slice(0, 500),
      contentExcerpt,
      sourceType: normalizeSourceType(raw?.sourceType, url),
      publisher: clean(raw?.publisher || raw?.publisherName || raw?.organization || raw?.source, 240),
      publishedAt: normalizeIso(raw?.publishedAt || raw?.published_at || raw?.date),
      query: clean(raw?.query, 200),
      sourceLanguage: normalizeSourceLanguage(raw?.sourceLanguage, title, snippet, contentExcerpt),
      isPrimarySource: isPrimaryEvidenceSource(raw?.sourceType, url),
      retrievedAt
    });
  }
  return sources;
}

export function mergeEvidenceLibrary(currentValue, incomingValue) {
  const current = normalizeEvidenceLibrary(currentValue);
  const merged = [...current];
  const byUrl = new Map(current.map((item) => [item.url, item]));
  let nextId = current.reduce((max, item) => Math.max(max, evidenceNumber(item.id)), 0) + 1;
  for (const item of Array.isArray(incomingValue) ? incomingValue : []) {
    const url = canonicalizeEvidenceUrl(item?.url);
    if (!url || byUrl.has(url)) continue;
    const stored = {
      id: `E${nextId++}`,
      title: clean(item?.title, 240) || domainOf(url),
      url,
      domain: domainOf(url),
      snippet: clean(item?.snippet, 500),
      sourceType: normalizeSourceType(item?.sourceType, url),
      publisher: clean(item?.publisher, 240),
      publishedAt: normalizeIso(item?.publishedAt),
      query: clean(item?.query, 200),
      retrievedAt: normalizeIso(item?.retrievedAt) || new Date().toISOString()
    };
    byUrl.set(url, stored);
    merged.push(stored);
  }
  return merged.slice(-EVIDENCE_LIBRARY_LIMIT);
}

export function publicEvidenceSource(source) {
  const url = canonicalizeEvidenceUrl(source?.url);
  if (!url) return null;
  return {
    id: /^E[1-9]\d*$/.test(String(source?.id || '')) ? String(source.id) : '',
    title: clean(source?.title, 240) || domainOf(url),
    url,
    sourceTitle: clean(source?.sourceTitle, 240) || clean(source?.sourceName, 240) || clean(source?.title, 240) || domainOf(url),
    sourceUrl: url,
    domain: domainOf(url),
    snippet: clean(source?.snippet, 500),
    contentExcerpt: clean(source?.contentExcerpt || source?.originalExcerpt, 1800),
    sourceExcerpt: clean(source?.sourceExcerpt || source?.contentExcerpt || source?.originalExcerpt, 1800),
    sourceType: normalizeSourceType(source?.sourceType, url),
    sourceName: clean(source?.sourceName, 240) || clean(source?.title, 240) || domainOf(url),
    publisher: clean(source?.publisher, 240),
    publishedAt: normalizeIso(source?.publishedAt),
    evidenceTitle: sanitizeEvidenceTitle(source?.evidenceTitle),
    displaySummary: sanitizeEvidenceDisplaySummary(source?.displaySummary),
    coreConclusion: clean(source?.coreConclusion, 500),
    evidenceContent: clean(source?.evidenceContent, 1200),
    chineseExplanation: clean(source?.chineseExplanation, 1200),
    applicationAnalysis: clean(source?.applicationAnalysis, 1200),
    sourceLanguage: normalizeSourceLanguage(
      source?.sourceLanguage,
      source?.title,
      source?.snippet,
      source?.contentExcerpt || source?.originalExcerpt
    ),
    sourceLanguageLabel: normalizeSourceLanguage(
      source?.sourceLanguage,
      source?.title,
      source?.snippet,
      source?.contentExcerpt || source?.originalExcerpt
    ) === 'zh-CN' ? '简体中文资料' : '外文原始资料',
    isPrimarySource: Boolean(source?.isPrimarySource) || isPrimaryEvidenceSource(source?.sourceType, url)
  };
}

function evidenceRank(raw, index) {
  const quality = Number(raw?.sourceQuality) || 0;
  const relevance = Number(raw?.score ?? raw?.relevanceScore ?? raw?.relevance_score) || 0;
  const languageBonus = raw?.sourceLanguage === 'zh-CN' ? 12 : 0;
  const primaryBonus = isPrimaryEvidenceSource(raw?.sourceType, raw?.url) ? 18 : 0;
  return quality * 100 + primaryBonus + languageBonus + relevance - index * 0.01;
}

function normalizeSourceLanguage(value, ...parts) {
  if (value === 'zh-CN') return 'zh-CN';
  if (value === 'foreign') return 'foreign';
  const text = parts.join(' ');
  const chinese = (text.match(/[\u3400-\u9FFF]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return chinese >= 8 || chinese >= Math.ceil(latin * 0.2) ? 'zh-CN' : 'foreign';
}

function isPrimaryEvidenceSource(value, url) {
  const type = normalizeSourceType(value, url);
  return type === 'official' || type === 'academic';
}

function normalizeSourceType(value, url) {
  if (['official', 'academic', 'media', 'organization', 'other'].includes(value)) return value;
  const hostname = domainOf(url);
  if (/\.(gov|gov\.cn)$/.test(hostname) || /(^|\.)un\.org$/.test(hostname) || /(^|\.)who\.int$/.test(hostname)) return 'official';
  if (/\.(edu|edu\.cn)$/.test(hostname) || /(^|\.)(arxiv\.org|doi\.org|pubmed\.ncbi\.nlm\.nih\.gov)$/.test(hostname)) return 'academic';
  if (MEDIA_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) return 'media';
  return 'other';
}

function domainOf(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

function evidenceNumber(id) {
  return Number(String(id || '').slice(1)) || 0;
}

function normalizeIso(value) {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function clean(value, limit) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function sliceCharacters(value, limit) {
  return Array.from(String(value || '')).slice(0, limit).join('');
}
