import { SPEECH_INPUT_STATUS } from '../utils/speechInput.js';

export default function SpeechInputButton({ speech, disabled = false, idleLabel = '语音输入', className = '' }) {
  const isRecording = speech.status === SPEECH_INPUT_STATUS.RECORDING;
  const isRequesting = speech.status === SPEECH_INPUT_STATUS.REQUESTING_PERMISSION;
  const isTranscribing = speech.status === SPEECH_INPUT_STATUS.TRANSCRIBING;
  const label = isRecording
    ? `停止并识别 ${formatDuration(speech.recordingDuration)}`
    : isRequesting
      ? '申请权限中…'
      : isTranscribing
        ? '正在识别…'
        : idleLabel;

  return (
    <button
      type="button"
      className={`speech-input-button ${isRecording ? 'recording' : ''} ${className}`.trim()}
      onClick={isRecording ? speech.stopRecording : speech.startRecording}
      disabled={isRequesting || isTranscribing || (!isRecording && disabled)}
      aria-label={isRecording ? '停止录音' : '开始语音输入'}
      aria-busy={isRequesting || isTranscribing}
      title={isRecording ? '停止录音并识别' : '开始语音输入'}
    >
      <span className="speech-input-icon" aria-hidden="true">{isRecording ? '●' : '🎙'}</span>
      <span>{label}</span>
    </button>
  );
}

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}
