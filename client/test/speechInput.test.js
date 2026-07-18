import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPEECH_INPUT_STATUS,
  appendSpeechTranscript,
  canStartSpeechInput,
  getSpeechInputErrorMessage,
  initialSpeechInputState,
  isSpeechInputBusyStatus,
  speechInputReducer,
  stopPlaybackBeforeSpeechInput
} from '../src/utils/speechInput.js';

test('appendSpeechTranscript 追加且不覆盖现有草稿', () => {
  assert.equal(appendSpeechTranscript('', '  新问题  '), '新问题');
  assert.equal(appendSpeechTranscript('原问题', '补充内容'), '原问题\n补充内容');
  assert.equal(appendSpeechTranscript('原问题\n', '补充内容'), '原问题\n补充内容');
  assert.equal(appendSpeechTranscript('原问题 ', '补充内容'), '原问题 补充内容');
  assert.equal(appendSpeechTranscript('原问题', '   '), '原问题');
  assert.equal(appendSpeechTranscript(appendSpeechTranscript('第一段', '第二段'), '第三段'), '第一段\n第二段\n第三段');
});

test('语音输入状态按权限、录音、识别、成功顺序转换', () => {
  const requesting = speechInputReducer(initialSpeechInputState, { type: 'request_permission' });
  const recording = speechInputReducer(requesting, { type: 'start_recording' });
  const transcribing = speechInputReducer(recording, { type: 'start_transcribing' });
  const completed = speechInputReducer(transcribing, { type: 'success' });
  assert.equal(requesting.status, SPEECH_INPUT_STATUS.REQUESTING_PERMISSION);
  assert.equal(recording.status, SPEECH_INPUT_STATUS.RECORDING);
  assert.equal(transcribing.status, SPEECH_INPUT_STATUS.TRANSCRIBING);
  assert.equal(completed.status, SPEECH_INPUT_STATUS.IDLE);
});

test('失败、取消和重试状态清晰', () => {
  const failed = speechInputReducer(initialSpeechInputState, { type: 'failure', error: '失败' });
  assert.equal(failed.status, SPEECH_INPUT_STATUS.ERROR);
  assert.equal(failed.error, '失败');
  assert.equal(speechInputReducer(failed, { type: 'cancel' }).status, SPEECH_INPUT_STATUS.IDLE);
  assert.equal(speechInputReducer(failed, { type: 'reset_error' }).error, '');
});

test('忙碌状态阻止快速重复启动并可作为 TTS 门禁', () => {
  assert.equal(canStartSpeechInput(SPEECH_INPUT_STATUS.IDLE), true);
  assert.equal(canStartSpeechInput(SPEECH_INPUT_STATUS.ERROR), true);
  assert.equal(canStartSpeechInput(SPEECH_INPUT_STATUS.REQUESTING_PERMISSION), false);
  assert.equal(canStartSpeechInput(SPEECH_INPUT_STATUS.RECORDING), false);
  assert.equal(canStartSpeechInput(SPEECH_INPUT_STATUS.TRANSCRIBING), false);
  assert.equal(isSpeechInputBusyStatus(SPEECH_INPUT_STATUS.RECORDING), true);
  assert.equal(isSpeechInputBusyStatus(SPEECH_INPUT_STATUS.IDLE), false);
});

test('权限、环境和空结果错误映射为安全文案', () => {
  assert.equal(getSpeechInputErrorMessage({ name: 'NotAllowedError' }), '未获得麦克风权限，请在浏览器设置中允许后重试。');
  assert.equal(getSpeechInputErrorMessage({ code: 'INSECURE_CONTEXT' }), '语音输入需要在 HTTPS 环境中使用。');
  assert.equal(getSpeechInputErrorMessage({ code: 'UNSUPPORTED_SPEECH_INPUT' }), '当前浏览器暂不支持语音输入，请使用文字输入或更换浏览器。');
  assert.equal(getSpeechInputErrorMessage({ code: 'EMPTY_TRANSCRIPT' }), '没有识别到有效内容，请靠近麦克风后重试。');
});

test('开始录音前停止 TTS 流和当前播放但不操作缓存', () => {
  const calls = [];
  const cache = new Map([['voice-1', { ready: true }]]);
  stopPlaybackBeforeSpeechInput({
    stopStream: () => calls.push('stream'),
    stopAudio: () => calls.push('audio')
  });
  assert.deepEqual(calls, ['stream', 'audio']);
  assert.equal(cache.has('voice-1'), true);
});
