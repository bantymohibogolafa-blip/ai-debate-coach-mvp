import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const REVIEW_AUDIENCE = 'fengbian.training-records';
const REVIEW_ISSUER = 'fengbian.review';
const RECEIPT_TTL_SECONDS = 60 * 60;

// This authenticates a model-produced round assessment, not the provenance of
// the conversation supplied by the client. Bind each assessment to its prefix.
export function defenseRoundContext(identity, session, messages) {
  return crypto.createHash('sha256').update(JSON.stringify({
    identity,
    topic: session.topic, userSide: session.userSide,
    difficulty: session.difficulty, styleId: session.celebrityDebater,
    rounds: session.rounds, sourcePrepTaskId: session.sourcePrepTaskId,
    messagesDigest: fingerprintReviewMessages(messages)
  })).digest('hex');
}

export function signDefenseRoundReceipt(state, context, secret) {
  return jwt.sign({ type: 'defense_round_v1', state, context }, secret, {
    algorithm: 'HS256', audience: 'fengbian.defense-round',
    issuer: REVIEW_ISSUER, expiresIn: 24 * RECEIPT_TTL_SECONDS
  });
}

export function verifyDefenseRoundReceipt(receipt, context, secret) {
  try {
    const payload = jwt.verify(receipt, secret, {
      algorithms: ['HS256'], audience: 'fengbian.defense-round', issuer: REVIEW_ISSUER
    });
    if (payload.type !== 'defense_round_v1' || payload.context !== context || !payload.state) throw new Error();
    return payload.state;
  } catch {
    throw receiptError(403, '防守逐轮评分凭证与本次回答不匹配，请重新开始训练。');
  }
}

// Only the actual conversational content is compared at save time. Defense round
// states and all score-bearing fields are taken from the signed server result.
export function fingerprintReviewMessages(messages = []) {
  const normalized = Array.isArray(messages) ? messages.map((item) => ({
    role: item?.role === 'assistant' ? 'ai' : String(item?.role || ''),
    content: String(item?.content || '').trim()
  })) : [];
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export function signReviewReceipt({ identity, session, review }, secret) {
  if (!secret || String(secret).length < 24) throw new Error('Review signing key unavailable.');
  const reviewId = crypto.randomUUID();
  const reviewReceipt = jwt.sign({
    type: 'training_review_v1',
    reviewId,
    identity,
    session,
    review
  }, secret, {
    algorithm: 'HS256',
    audience: REVIEW_AUDIENCE,
    issuer: REVIEW_ISSUER,
    expiresIn: RECEIPT_TTL_SECONDS
  });
  if (reviewReceipt.length > 200000) {
    throw receiptError(413, '本次训练内容过长，无法生成可保存的复盘凭证，请缩短训练内容。');
  }
  return { reviewId, reviewReceipt };
}

export function verifyReviewReceipt(receipt, secret) {
  if (typeof receipt !== 'string' || !receipt || receipt.length > 200000) {
    throw receiptError(400, '训练记录缺少有效的服务端复盘凭证，请重新生成复盘。');
  }
  try {
    const payload = jwt.verify(receipt, secret, {
      algorithms: ['HS256'],
      audience: REVIEW_AUDIENCE,
      issuer: REVIEW_ISSUER
    });
    if (
      payload?.type !== 'training_review_v1'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.reviewId || '')
      || !payload.identity || !payload.session || !payload.review
      || !Array.isArray(payload.session.messages)
      || !Array.isArray(payload.review.dimensionScores) || payload.review.dimensionScores.length === 0
      || !Number.isFinite(Number(payload.review.score))
      || typeof payload.review.content !== 'string' || !payload.review.content.trim()
    ) {
      throw receiptError(403, '复盘凭证内容无效，请重新生成复盘。');
    }
    return payload;
  } catch (error) {
    if (error?.code === 'REVIEW_RECEIPT_INVALID') throw error;
    if (error instanceof jwt.TokenExpiredError) {
      throw receiptError(410, '本次复盘凭证已过期，请重新生成复盘。');
    }
    throw receiptError(403, '复盘凭证校验失败，请重新生成复盘。');
  }
}

function receiptError(status, message) {
  const error = new Error(message);
  error.code = 'REVIEW_RECEIPT_INVALID';
  error.status = status;
  return error;
}
