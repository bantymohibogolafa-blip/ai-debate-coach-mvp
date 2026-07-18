export const SPEECH_INPUT_STATUS = Object.freeze({
  IDLE: 'idle',
  REQUESTING_PERMISSION: 'requesting_permission',
  RECORDING: 'recording',
  TRANSCRIBING: 'transcribing',
  ERROR: 'error'
});

export const initialSpeechInputState = Object.freeze({
  status: SPEECH_INPUT_STATUS.IDLE,
  recordingDuration: 0,
  message: '',
  error: ''
});

export function speechInputReducer(state, action) {
  switch (action.type) {
    case 'request_permission':
      return { ...state, status: SPEECH_INPUT_STATUS.REQUESTING_PERMISSION, recordingDuration: 0, message: '正在申请麦克风权限…', error: '' };
    case 'start_recording':
      return { ...state, status: SPEECH_INPUT_STATUS.RECORDING, recordingDuration: 0, message: action.message || '正在录音', error: '' };
    case 'tick':
      return { ...state, recordingDuration: Math.max(0, Number(action.seconds) || 0) };
    case 'start_transcribing':
      return { ...state, status: SPEECH_INPUT_STATUS.TRANSCRIBING, message: '正在识别…', error: '' };
    case 'success':
      return { ...state, status: SPEECH_INPUT_STATUS.IDLE, message: action.message || '识别完成，请检查文字后发送。', error: '' };
    case 'failure':
      return { ...state, status: SPEECH_INPUT_STATUS.ERROR, message: '', error: action.error || '语音识别暂时失败，请稍后重试。' };
    case 'reset_error':
      return { ...state, status: SPEECH_INPUT_STATUS.IDLE, error: '', message: '' };
    case 'cancel':
      return { ...state, status: SPEECH_INPUT_STATUS.IDLE, recordingDuration: 0, message: '', error: '' };
    default:
      return state;
  }
}

export function appendSpeechTranscript(existingText, transcript) {
  const existing = String(existingText || '');
  const cleanTranscript = String(transcript || '').trim();
  if (!cleanTranscript) return existing;
  if (!existing.trim()) return cleanTranscript;
  return /\s$/u.test(existing) ? `${existing}${cleanTranscript}` : `${existing}\n${cleanTranscript}`;
}

export function canStartSpeechInput(status) {
  return [SPEECH_INPUT_STATUS.IDLE, SPEECH_INPUT_STATUS.ERROR].includes(status);
}

export function isSpeechInputBusyStatus(status) {
  return [
    SPEECH_INPUT_STATUS.REQUESTING_PERMISSION,
    SPEECH_INPUT_STATUS.RECORDING,
    SPEECH_INPUT_STATUS.TRANSCRIBING
  ].includes(status);
}

export function stopPlaybackBeforeSpeechInput({ stopStream, stopAudio }) {
  stopStream?.();
  stopAudio?.();
}

export function getSpeechInputErrorMessage(error) {
  if (error?.name === 'AbortError' || error?.code === 'SPEECH_CANCELLED') return '';
  if (error?.code === 'INSECURE_CONTEXT') return '语音输入需要在 HTTPS 环境中使用。';
  if (error?.code === 'UNSUPPORTED_SPEECH_INPUT') return '当前浏览器暂不支持语音输入，请使用文字输入或更换浏览器。';
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
    return '未获得麦克风权限，请在浏览器设置中允许后重试。';
  }
  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
    return '没有检测到可用麦克风，请连接麦克风后重试。';
  }
  if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
    return '麦克风当前被其他应用占用，请关闭占用后重试。';
  }
  if (error?.code === 'EMPTY_AUDIO' || error?.code === 'RECORDING_TOO_SHORT') {
    return '没有识别到有效内容，请靠近麦克风后重试。';
  }
  if (error?.code === 'EMPTY_TRANSCRIPT' || error?.status === 422) {
    return '没有识别到有效内容，请靠近麦克风后重试。';
  }
  return '语音识别暂时失败，请稍后重试。';
}

export function isSpeechInputSupported() {
  const AudioContextClass = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && Boolean(AudioContextClass);
}

export function mergeFloat32Chunks(chunks) {
  const totalLength = chunks.reduce((length, chunk) => length + chunk.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });
  return result;
}

export function downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
  if (inputSampleRate === outputSampleRate) return buffer;
  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  for (let index = 0; index < newLength; index += 1) {
    const start = Math.floor(index * sampleRateRatio);
    const end = Math.min(Math.floor((index + 1) * sampleRateRatio), buffer.length);
    let sum = 0;
    let count = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      sum += buffer[sampleIndex];
      count += 1;
    }
    result[index] = count ? sum / count : 0;
  }
  return result;
}

export function encodeWav(samples, sampleRate) {
  const bytesPerSample = 2;
  const dataLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  let offset = 44;
  samples.forEach((sample) => {
    const clampedSample = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clampedSample < 0 ? clampedSample * 0x8000 : clampedSample * 0x7fff, true);
    offset += 2;
  });
  return new Blob([view], { type: 'audio/wav' });
}

function writeAscii(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
}
