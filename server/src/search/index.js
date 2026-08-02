import { searchAnySearch } from './anysearch.js';

export async function searchEvidence({
  queries,
  signal,
  fetchImpl,
  apiKey,
  supplementalQueryFactory,
  provider: requestedProvider,
  sensitiveValues = []
} = {}) {
  const provider = String(requestedProvider || process.env.SEARCH_PROVIDER || 'anysearch').trim().toLowerCase();
  if (provider !== 'anysearch') {
    const error = new Error('联网搜索供应商尚不受支持。');
    error.code = 'UNSUPPORTED_SEARCH_PROVIDER';
    throw error;
  }
  let selected = normalizeQueries(queries, sensitiveValues).slice(0, 3);
  const primary = selected.filter((item) => item.phase === 'primary');
  let supplemental = selected.filter((item) => item.phase === 'supplemental');
  const firstRound = await dispatchQueries(primary.length ? primary : selected.filter((item) => item.language === 'zh-CN'), {
    signal, fetchImpl, apiKey
  });
  const chineseAssessment = assessChineseEvidence(firstRound.successful);
  const needsForeignSupplement = firstRound.successful.length > 0 && chineseAssessment.credibleCount < 3;
  let supplementalGenerationError = null;
  if (needsForeignSupplement && supplemental.length === 0 && typeof supplementalQueryFactory === 'function') {
    try {
      const generated = await supplementalQueryFactory(chineseAssessment);
      supplemental = normalizeQueries([generated], sensitiveValues)
        .filter((item) => item.phase === 'supplemental')
        .slice(0, 1);
      selected = [...selected, ...supplemental];
    } catch (error) {
      supplementalGenerationError = error;
    }
  }
  const secondRound = needsForeignSupplement && supplemental.length
    ? await dispatchQueries(supplemental, { signal, fetchImpl, apiKey })
    : { successful: [], failed: [] };
  const successful = [...firstRound.successful, ...secondRound.successful];
  const failed = [
    ...firstRound.failed,
    ...secondRound.failed,
    ...(supplementalGenerationError ? [{ code: 'supplemental_query_failed', status: 0 }] : [])
  ];
  const foreignSupplementQueried = secondRound.successful.length > 0;
  const usedForeignSupplement = secondRound.successful.some((response) => response.results.length > 0);
  return {
    provider,
    status: successful.length === 0 ? 'fallback' : failed.length ? 'partial' : 'success',
    queries: selected,
    results: successful.flatMap((response) => response.results.map((result, resultIndex) => ({
      ...result,
      query: response.query.searchQuery,
      displayQuery: response.query.displayQuery,
      queryLanguage: response.query.language,
      queryPhase: response.query.phase,
      sourceLanguage: detectSourceLanguage(result),
      sourceQuality: scoreEvidenceResult(result, resultIndex)
    }))),
    requestIds: successful.map((response) => response.requestId).filter(Boolean),
    errors: failed.map((error) => ({ code: error?.code || 'search_error', status: error?.status || 0 })),
    usedForeignSupplement,
    foreignSupplementQueried,
    foreignSupplementNeeded: needsForeignSupplement,
    chineseAssessment
  };
}

export function normalizeQueries(value, sensitiveValues = []) {
  return (Array.isArray(value) ? value : [])
    .map((item) => {
      const language = item?.language === 'en' ? 'en' : 'zh-CN';
      return {
        displayQuery: sanitizeQuery(item?.displayQuery || item?.query, sensitiveValues),
        searchQuery: sanitizeQuery(item?.searchQuery || item?.query || item?.displayQuery, sensitiveValues),
        zone: item?.zone === 'intl' ? 'intl' : 'cn',
        language,
        phase: item?.phase === 'supplemental' || language === 'en' ? 'supplemental' : 'primary',
        max_results: 6
      };
    })
    .filter((item) => item.searchQuery);
}

async function dispatchQueries(queries, options) {
  const settled = await Promise.allSettled(queries.map((query) => searchAnySearch(query, options)));
  return {
    successful: settled.filter((item) => item.status === 'fulfilled').map((item) => item.value),
    failed: settled.filter((item) => item.status === 'rejected').map((item) => item.reason)
  };
}

export function assessChineseEvidence(responses) {
  const unique = new Map();
  for (const response of Array.isArray(responses) ? responses : []) {
    for (const result of Array.isArray(response?.results) ? response.results : []) {
      const url = String(result?.url || '').trim();
      if (!url || unique.has(url)) continue;
      unique.set(url, result);
    }
  }
  const results = [...unique.values()];
  const chinese = results.filter((item) => detectSourceLanguage(item) === 'zh-CN');
  const credible = chinese.filter((item, index) => scoreEvidenceResult(item, index) >= 3);
  return {
    resultCount: results.length,
    chineseCount: chinese.length,
    credibleCount: credible.length,
    sufficient: credible.length >= 3
  };
}

function detectSourceLanguage(result) {
  const text = `${result?.title || ''} ${result?.snippet || ''} ${result?.content || ''}`;
  const chinese = (text.match(/[\u3400-\u9FFF]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return chinese >= 8 || chinese >= Math.ceil(latin * 0.2) ? 'zh-CN' : 'foreign';
}

function scoreEvidenceResult(result, index = 0) {
  const domain = domainOf(result?.url);
  if (!domain || isLowQualityDomain(domain)) return 0;
  let score = Math.max(0, 2 - Math.floor(index / 3));
  if (isAuthoritativeDomain(domain)) score += 3;
  if (['official', 'academic', 'organization'].includes(result?.sourceType)) score += 2;
  if (String(result?.content || '').trim().length >= 120) score += 1;
  const publishedAt = new Date(result?.publishedAt || result?.published_at || result?.date || '').getTime();
  if (Number.isFinite(publishedAt)) {
    const ageYears = (Date.now() - publishedAt) / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears <= 5) score += 1;
    else if (ageYears > 10) score -= 1;
  }
  return score;
}

function domainOf(value) {
  try { return new URL(String(value || '')).hostname.toLowerCase(); } catch { return ''; }
}

function isAuthoritativeDomain(domain) {
  return /(?:^|\.)(?:gov\.cn|edu\.cn|ac\.cn)$/.test(domain)
    || /(?:^|\.)(?:stats\.gov\.cn|cas\.cn|cssn\.cn|cnki\.net|wanfangdata\.com\.cn|xinhuanet\.com|people\.com\.cn|chinanews\.com\.cn|thepaper\.cn|caixin\.com)$/.test(domain);
}

function isLowQualityDomain(domain) {
  return /(?:^|\.)(?:zhihu\.com|baijiahao\.baidu\.com|toutiao\.com|wukong\.com|csdn\.net)$/.test(domain);
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
