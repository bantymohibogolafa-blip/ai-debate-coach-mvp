export const EVIDENCE_CARD_TITLE_LIMIT = 30;
export const EVIDENCE_CARD_SUMMARY_LIMIT = 180;
export const EVIDENCE_CARD_SUMMARY_FALLBACK = '暂未生成有效摘要，请查看原始来源。';

export function evidenceCardTitle(source) {
  return cleanLegacyEvidenceText(
    source?.evidenceTitle || source?.coreConclusion || source?.title || '可核验论据',
    EVIDENCE_CARD_TITLE_LIMIT
  ) || '可核验论据';
}

export function evidenceDisplaySummary(source) {
  const generatedSummary = cleanLegacyEvidenceText(
    source?.displaySummary,
    EVIDENCE_CARD_SUMMARY_LIMIT
  );
  if (/[\u3400-\u9FFF]/.test(generatedSummary)) return generatedSummary;

  // Historical records predate displaySummary. Their legacy AI fields are
  // sanitized and bounded; raw search/snippet/excerpt fields are never read.
  const legacyCandidates = [
    [source?.evidenceContent, source?.applicationAnalysis].filter(Boolean).join(' '),
    source?.chineseExplanation
  ];
  for (const candidate of legacyCandidates) {
    const cleaned = cleanLegacyEvidenceText(candidate, EVIDENCE_CARD_SUMMARY_LIMIT);
    if (/[\u3400-\u9FFF]/.test(cleaned)) return cleaned;
  }
  return EVIDENCE_CARD_SUMMARY_FALLBACK;
}

export function cleanLegacyEvidenceText(value, limit) {
  let text = String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/(?:^|\s)(?:references|参考文献)\s*[:：]?[\s\S]*$/i, ' ')
    .replace(/\b(?:https?:\/\/)?(?:dx\.)?doi\.org\/\S+|\bdoi\s*[:：]?\s*10\.\d{4,9}\/\S+/gi, ' ')
    .replace(/(?:作者(?:单位)?|单位|通讯作者|通信作者|地址|邮编|发布日期|发布时间|收稿日期|接受日期|published(?: at| on)?|keywords?|关键词)\s*[:：][^。；;]{0,300}[。；;]?/gi, ' ')
    .replace(/#{1,6}\s*(?:abstract|摘要|doi|keywords?|references|参考文献)\s*[:：]?/gi, ' ')
    .replace(/(?:请升级浏览器|浏览器版本过低|下载全文|立即下载|登录后查看|请登录|订阅后阅读|subscribe|sign in|log in)/gi, ' ')
    .replace(/[|_*~`]{2,}|(?:[-=—]{3,}|[◆◇■□●○▶►]{2,})/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const characters = Array.from(text);
  if (characters.length > limit) {
    text = `${characters.slice(0, Math.max(0, limit - 1)).join('')}…`;
  }
  return text;
}
