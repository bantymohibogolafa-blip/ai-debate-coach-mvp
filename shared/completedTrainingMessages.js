export function isMeaningfulUserInput(value) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return Boolean(text && /[\p{L}\p{N}]/u.test(text));
}

export function getLastMeaningfulUserIndex(messages) {
  if (!Array.isArray(messages)) return -1;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'user' && isMeaningfulUserInput(message.content)) return index;
  }

  return -1;
}

// Canonical completed-training boundary: keep everything through the final
// meaningful user answer and discard every later message without mutating input.
export function buildReviewableMessages(messages) {
  const lastMeaningfulUserIndex = getLastMeaningfulUserIndex(messages);
  return lastMeaningfulUserIndex < 0 ? [] : messages.slice(0, lastMeaningfulUserIndex + 1);
}

export function hasUnansweredAssistantTail(messages) {
  const lastMeaningfulUserIndex = getLastMeaningfulUserIndex(messages);
  return lastMeaningfulUserIndex >= 0 && messages.slice(lastMeaningfulUserIndex + 1).some((message) => (
    message?.role === 'ai' || message?.role === 'assistant'
  ));
}

export function countMeaningfulUserMessages(messages) {
  return Array.isArray(messages)
    ? messages.filter((message) => message?.role === 'user' && isMeaningfulUserInput(message.content)).length
    : 0;
}

export function withCompletedTrainingMessages(record) {
  if (!record || typeof record !== 'object') return record;
  return {
    ...record,
    messages: buildReviewableMessages(Array.isArray(record.messages) ? record.messages : [])
  };
}
