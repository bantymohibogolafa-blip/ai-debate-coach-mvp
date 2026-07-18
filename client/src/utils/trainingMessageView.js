const AI_ROLES = new Set(['ai', 'assistant']);

export function buildTrainingMessageView(history, isTraining) {
  const source = Array.isArray(history) ? history : [];
  const latestIndex = source.length - 1;
  const latestMessage = latestIndex >= 0 ? source[latestIndex] : null;
  const currentAiMessageIndex = isTraining && AI_ROLES.has(latestMessage?.role)
    ? latestIndex
    : -1;

  return {
    historyEntries: source
      .map((message, originalIndex) => ({ message, originalIndex }))
      .filter(({ originalIndex }) => originalIndex !== currentAiMessageIndex),
    currentAiMessage: currentAiMessageIndex >= 0 ? latestMessage : null,
    currentAiMessageIndex
  };
}
