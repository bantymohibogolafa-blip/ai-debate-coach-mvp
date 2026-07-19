export function createPolishRequestSnapshot({
  answer,
  polishType,
  requestId,
  trainingMode,
  modeDisplayName
}) {
  return {
    sourceText: String(answer || '').trim(),
    polishType,
    requestId,
    trainingMode,
    modeDisplayName
  };
}

export function createPendingPolishResult(request) {
  return {
    sourceText: request.sourceText,
    generatedDraft: '',
    generatedLabel: '',
    generatedType: '',
    polishType: request.polishType,
    requestId: request.requestId,
    trainingMode: request.trainingMode,
    selectedSource: 'original',
    modeDisplayName: request.modeDisplayName,
    tip: '',
    error: ''
  };
}

export function shouldApplyPolishResponse({
  activeRequestId,
  request,
  currentAnswer,
  currentTrainingMode
}) {
  return activeRequestId === request.requestId
    && String(currentAnswer || '').trim() === request.sourceText
    && currentTrainingMode === request.trainingMode;
}

export function createCompletedPolishResult(request, {
  generatedDraft,
  generatedLabel,
  generatedType,
  modeDisplayName,
  tip
}) {
  return {
    ...createPendingPolishResult(request),
    generatedDraft,
    generatedLabel,
    generatedType,
    modeDisplayName: modeDisplayName || request.modeDisplayName,
    tip
  };
}

export function getPolishSelectionText(polishResult, source) {
  if (!polishResult) return '';
  return source === 'generated'
    ? polishResult.generatedDraft || ''
    : polishResult.sourceText || '';
}
