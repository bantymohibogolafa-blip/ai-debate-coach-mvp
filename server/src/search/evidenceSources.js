const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'mc_cid', 'mc_eid'
]);

const MEDIA_DOMAINS = [
  'bbc.com', 'reuters.com', 'apnews.com', 'nytimes.com', 'theguardian.com',
  'xinhuanet.com', 'people.com.cn', 'chinanews.com.cn', 'thepaper.cn', 'caixin.com'
];

export const EVIDENCE_LIBRARY_LIMIT = 40;
export const SEARCH_SOURCE_LIMIT = 12;
export const SEARCH_CONTEXT_LIMIT = 12000;

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

  for (const raw of Array.isArray(rawResults) ? rawResults : []) {
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
      query: clean(raw?.query, 200),
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
    domain: domainOf(url),
    snippet: clean(source?.snippet, 500),
    sourceType: normalizeSourceType(source?.sourceType, url)
  };
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
