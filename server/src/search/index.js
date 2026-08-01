import { searchAnySearch } from './anysearch.js';

export async function searchEvidence({
  queries,
  signal,
  fetchImpl,
  apiKey,
  provider: requestedProvider,
  sensitiveValues = []
} = {}) {
  const provider = String(requestedProvider || process.env.SEARCH_PROVIDER || 'anysearch').trim().toLowerCase();
  if (provider !== 'anysearch') {
    const error = new Error('联网搜索供应商尚不受支持。');
    error.code = 'UNSUPPORTED_SEARCH_PROVIDER';
    throw error;
  }
  const selected = normalizeQueries(queries, sensitiveValues).slice(0, 3);
  const settled = await Promise.allSettled(selected.map((query) => searchAnySearch(query, {
    signal,
    fetchImpl,
    apiKey
  })));
  const successful = settled.filter((item) => item.status === 'fulfilled').map((item) => item.value);
  const failed = settled.filter((item) => item.status === 'rejected').map((item) => item.reason);
  return {
    provider,
    status: successful.length === 0 ? 'fallback' : failed.length ? 'partial' : 'success',
    queries: selected,
    results: successful.flatMap((response) => response.results.map((result) => ({ ...result, query: response.query.query }))),
    requestIds: successful.map((response) => response.requestId).filter(Boolean),
    errors: failed.map((error) => ({ code: error?.code || 'search_error', status: error?.status || 0 }))
  };
}

export function normalizeQueries(value, sensitiveValues = []) {
  return (Array.isArray(value) ? value : [])
    .map((item) => ({
      query: sanitizeQuery(item?.query, sensitiveValues),
      zone: item?.zone === 'intl' ? 'intl' : 'cn',
      language: item?.language === 'en' ? 'en' : 'zh-CN',
      max_results: 6
    }))
    .filter((item) => item.query);
}

function sanitizeQuery(value, sensitiveValues) {
  let query = String(value || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, ' ')
    .replace(/\bBearer\s+\S+/gi, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ');
  for (const raw of Array.isArray(sensitiveValues) ? sensitiveValues : []) {
    const sensitive = String(raw || '').trim();
    if (sensitive.length < 2) continue;
    query = query.split(sensitive).join(' ');
  }
  return query.replace(/\s+/g, ' ').trim().slice(0, 200);
}
