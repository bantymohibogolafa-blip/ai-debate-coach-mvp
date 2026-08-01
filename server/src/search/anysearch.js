const RETRYABLE_STATUSES = new Set([429, 500, 503, 504]);

export class AnySearchError extends Error {
  constructor(code, status = 0, details = {}) {
    super(userMessage(code));
    this.name = 'AnySearchError';
    this.code = code;
    this.status = status;
    this.requestId = details.requestId || '';
  }
}

export async function searchAnySearch(query, options = {}) {
  const apiKey = options.apiKey ?? process.env.ANYSEARCH_API_KEY;
  if (!apiKey) throw new AnySearchError('missing_key');
  const apiUrl = options.apiUrl || process.env.ANYSEARCH_API_URL || 'https://api.anysearch.com/v1/search';
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = clamp(Number(options.timeoutMs ?? process.env.ANYSEARCH_TIMEOUT_MS ?? 18000), 1000, 30000);
  const maxResults = clamp(Number(query?.max_results ?? 6), 1, 10);
  const body = {
    query: cleanQuery(query?.query),
    max_results: maxResults,
    zone: query?.zone === 'intl' ? 'intl' : 'cn',
    language: query?.language === 'en' ? 'en' : 'zh-CN',
    format: 'json'
  };
  if (!body.query) throw new AnySearchError('invalid_query', 400);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const onAbort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      const requestId = String(data?.request_id || '');
      if (!response.ok) {
        if (attempt === 0 && RETRYABLE_STATUSES.has(response.status)) {
          await wait(retryDelay(response.headers.get('retry-after')));
          continue;
        }
        throw new AnySearchError(mapStatus(response.status), response.status, { requestId });
      }
      if (data?.code !== 0) throw new AnySearchError('provider_error', 502, { requestId });
      return {
        query: body,
        requestId,
        results: Array.isArray(data?.data?.results) ? data.data.results : [],
        metadata: data?.data?.metadata && typeof data.data.metadata === 'object' ? data.data.metadata : {}
      };
    } catch (error) {
      if (error instanceof AnySearchError) throw error;
      if (controller.signal.aborted) throw new AnySearchError('timeout', 504);
      if (attempt === 0) continue;
      throw new AnySearchError('network_error', 502);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }
  }
  throw new AnySearchError('network_error', 502);
}

function cleanQuery(value) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
}

function mapStatus(status) {
  if ([401, 403].includes(status)) return 'invalid_credentials';
  if (status === 402) return 'quota_exhausted';
  if (status === 429) return 'rate_limited';
  if ([500, 503, 504].includes(status)) return 'service_unavailable';
  return status === 400 ? 'invalid_query' : 'provider_error';
}

function userMessage(code) {
  return ({
    missing_key: '联网搜索尚未配置。',
    invalid_credentials: '联网搜索配置无效或 Key 不可用。',
    quota_exhausted: '联网搜索额度已用尽。',
    rate_limited: '联网搜索请求过于频繁。',
    service_unavailable: '联网搜索服务暂时不可用。',
    timeout: '联网搜索请求超时。'
  })[code] || '联网搜索暂时不可用。';
}

function retryDelay(value) {
  if (!value) return 250;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return clamp(seconds * 1000, 0, 1500);
  const date = new Date(value).getTime();
  return Number.isFinite(date) ? clamp(date - Date.now(), 0, 1500) : 250;
}

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)); }
