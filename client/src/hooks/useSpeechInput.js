import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  SPEECH_INPUT_STATUS,
  canStartSpeechInput,
  downsampleBuffer,
  encodeWav,
  getSpeechInputErrorMessage,
  initialSpeechInputState,
  isSpeechInputBusyStatus,
  isSpeechInputSupported,
  mergeFloat32Chunks,
  speechInputReducer
} from '../utils/speechInput.js';

const OUTPUT_SAMPLE_RATE = 16000;
const DEFAULT_MAX_RECORDING_SECONDS = 30;

export default function useSpeechInput({
  scene,
  onTranscript,
  onBeforeRecord,
  maxRecordingSeconds = DEFAULT_MAX_RECORDING_SECONDS
}) {
  const [state, dispatch] = useReducer(speechInputReducer, initialSpeechInputState);
  const [audioUrl, setAudioUrl] = useState('');
  const audioUrlRef = useRef('');
  const mountedRef = useRef(false);
  const statusRef = useRef(SPEECH_INPUT_STATUS.IDLE);
  const requestSequenceRef = useRef(0);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const startedAtRef = useRef(0);
  const contextRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const silentGainRef = useRef(null);
  const chunksRef = useRef([]);
  const inputSampleRateRef = useRef(48000);
  const transcriptCallbackRef = useRef(onTranscript);
  const beforeRecordCallbackRef = useRef(onBeforeRecord);
  const transcribeAbortRef = useRef(null);

  transcriptCallbackRef.current = onTranscript;
  beforeRecordCallbackRef.current = onBeforeRecord;

  const transition = useCallback((action, nextStatus) => {
    if (nextStatus) statusRef.current = nextStatus;
    if (mountedRef.current) dispatch(action);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const releaseRecorder = useCallback((clearChunks = false) => {
    clearTimer();
    if (processorRef.current) processorRef.current.onaudioprocess = null;
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    silentGainRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    silentGainRef.current = null;
    startedAtRef.current = 0;
    void contextRef.current?.close().catch(() => {});
    contextRef.current = null;
    stopTracks();
    if (clearChunks) chunksRef.current = [];
  }, [clearTimer, stopTracks]);

  const clearAudioUrl = useCallback(() => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = '';
    setAudioUrl('');
  }, []);

  const cancelRecording = useCallback(() => {
    requestSequenceRef.current += 1;
    transcribeAbortRef.current?.abort();
    transcribeAbortRef.current = null;
    releaseRecorder(true);
    transition({ type: 'cancel' }, SPEECH_INPUT_STATUS.IDLE);
  }, [releaseRecorder, transition]);

  const transcribeChunks = useCallback(async () => {
    const sequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = sequence;
    const chunks = chunksRef.current;
    const inputSampleRate = inputSampleRateRef.current;
    const recordedMs = Date.now() - startedAtRef.current;
    releaseRecorder(false);

    try {
      const totalSamples = chunks.reduce((total, chunk) => total + chunk.length, 0);
      if (!totalSamples) throw Object.assign(new Error('EMPTY_AUDIO'), { code: 'EMPTY_AUDIO' });
      if (recordedMs < 300 || totalSamples < inputSampleRate * 0.2) {
        throw Object.assign(new Error('RECORDING_TOO_SHORT'), { code: 'RECORDING_TOO_SHORT' });
      }

      const wavBlob = encodeWav(downsampleBuffer(mergeFloat32Chunks(chunks), inputSampleRate, OUTPUT_SAMPLE_RATE), OUTPUT_SAMPLE_RATE);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = URL.createObjectURL(wavBlob);
      setAudioUrl(audioUrlRef.current);
      transition({ type: 'start_transcribing' }, SPEECH_INPUT_STATUS.TRANSCRIBING);
      const controller = new AbortController();
      transcribeAbortRef.current = controller;
      const response = await fetch('/api/speech/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav', 'X-Speech-Scene': scene || 'unknown' },
        body: wavBlob,
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error('ASR_REQUEST_FAILED'), { status: response.status });
      const transcript = String(data.text || '').trim();
      if (!transcript) throw Object.assign(new Error('EMPTY_TRANSCRIPT'), { code: 'EMPTY_TRANSCRIPT' });
      if (!mountedRef.current || sequence !== requestSequenceRef.current) return;
      transcriptCallbackRef.current?.(transcript);
      transition({ type: 'success' }, SPEECH_INPUT_STATUS.IDLE);
    } catch (error) {
      if (!mountedRef.current || sequence !== requestSequenceRef.current || error?.name === 'AbortError') return;
      transition({ type: 'failure', error: getSpeechInputErrorMessage(error) }, SPEECH_INPUT_STATUS.ERROR);
    } finally {
      if (sequence === requestSequenceRef.current) transcribeAbortRef.current = null;
      chunksRef.current = [];
    }
  }, [releaseRecorder, scene, transition]);

  const stopRecording = useCallback(() => {
    if (statusRef.current !== SPEECH_INPUT_STATUS.RECORDING) return;
    statusRef.current = SPEECH_INPUT_STATUS.TRANSCRIBING;
    clearTimer();
    void transcribeChunks();
  }, [clearTimer, transcribeChunks]);

  const startRecording = useCallback(async () => {
    if (!canStartSpeechInput(statusRef.current)) return;
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      transition({ type: 'failure', error: getSpeechInputErrorMessage({ code: 'INSECURE_CONTEXT' }) }, SPEECH_INPUT_STATUS.ERROR);
      return;
    }
    if (!isSpeechInputSupported()) {
      transition({ type: 'failure', error: getSpeechInputErrorMessage({ code: 'UNSUPPORTED_SPEECH_INPUT' }) }, SPEECH_INPUT_STATUS.ERROR);
      return;
    }

    const sequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = sequence;
    transition({ type: 'request_permission' }, SPEECH_INPUT_STATUS.REQUESTING_PERMISSION);
    try {
      await beforeRecordCallbackRef.current?.();
      if (sequence !== requestSequenceRef.current) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      if (!mountedRef.current || sequence !== requestSequenceRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContextClass();
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const silentGain = context.createGain();
      silentGain.gain.value = 0;
      chunksRef.current = [];
      streamRef.current = stream;
      contextRef.current = context;
      sourceRef.current = source;
      processorRef.current = processor;
      silentGainRef.current = silentGain;
      inputSampleRateRef.current = context.sampleRate;
      startedAtRef.current = Date.now();
      processor.onaudioprocess = (event) => {
        if (statusRef.current !== SPEECH_INPUT_STATUS.RECORDING) return;
        chunksRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(context.destination);
      transition({ type: 'start_recording', message: `正在录音，最多 ${maxRecordingSeconds} 秒。` }, SPEECH_INPUT_STATUS.RECORDING);
      timerRef.current = window.setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
        transition({ type: 'tick', seconds });
        if (seconds >= maxRecordingSeconds) stopRecording();
      }, 500);
    } catch (error) {
      releaseRecorder(true);
      if (!mountedRef.current || sequence !== requestSequenceRef.current) return;
      transition({ type: 'failure', error: getSpeechInputErrorMessage(error) }, SPEECH_INPUT_STATUS.ERROR);
    }
  }, [maxRecordingSeconds, releaseRecorder, stopRecording, transition]);

  const resetError = useCallback(() => {
    if (statusRef.current === SPEECH_INPUT_STATUS.ERROR) transition({ type: 'reset_error' }, SPEECH_INPUT_STATUS.IDLE);
  }, [transition]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
      transcribeAbortRef.current?.abort();
      releaseRecorder(true);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = '';
    };
  }, [releaseRecorder]);

  return {
    ...state,
    audioUrl,
    isRecording: state.status === SPEECH_INPUT_STATUS.RECORDING,
    isTranscribing: state.status === SPEECH_INPUT_STATUS.TRANSCRIBING,
    isBusy: isSpeechInputBusyStatus(state.status),
    startRecording,
    stopRecording,
    cancelRecording,
    resetError,
    clearAudioUrl
  };
}
