/**
 * Graba una frase con el micrófono para transcribirla en el servidor (registro por voz, FT-0013).
 * A diferencia del dictado del navegador, aquí sí se pide el micrófono con control automático de
 * volumen y supresión de ruido: no hace falta hablar fuerte. Termina sola con el silencio.
 */

/** Formatos en orden de preferencia: Chrome, Edge y Firefox graban webm; Safari, mp4. */
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

/** Una frase nunca dura más que esto: el servidor acepta hasta ~15 s. */
export const MAX_RECORDING_MS = 14_000;
/** Tras empezar a hablar, este silencio termina la grabación. */
const SILENCE_MS = 1_500;
/** Nivel (0 a 1) desde el que se considera que hay voz. */
const SPEECH_LEVEL = 0.12;
/** Cada cuánto se mide el volumen (con setInterval sigue midiendo si la pestaña pierde el foco). */
const TICK_MS = 80;

/**
 * @param {object} [win] Objeto global; en las pruebas se pasa uno falso.
 * @returns {boolean} `true` si el navegador puede grabar audio (todos los modernos, incluido Firefox).
 */
export function canRecord(win = globalThis) {
  return Boolean(win.MediaRecorder && win.navigator?.mediaDevices?.getUserMedia);
}

/**
 * Traduce el error de `getUserMedia` a los casos que la pantalla sabe explicar.
 * @param {{ name?: string }} err
 * @returns {'denied'|'no-mic'|'unavailable'}
 */
export function recorderErrorCode(err) {
  if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') return 'denied';
  if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') return 'no-mic';
  return 'unavailable';
}

/**
 * Pide el micrófono y empieza a grabar.
 * @param {object} options
 * @param {(level: number) => void} [options.onLevel] Volumen de 0 a 1, para dibujar la onda.
 * @param {(audio: Blob) => void} options.onStop Recibe la grabación al terminar (no si se cancela).
 * @returns {Promise<{ stop: () => void, cancel: () => void }>}
 * @throws {DOMException} Si se niega el permiso o no hay micrófono (ver {@link recorderErrorCode}).
 */
export async function startRecording({ onLevel, onStop }) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
  const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported?.(type));
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  let cancelled = false;

  // Volumen para la onda y para detectar el silencio. Si el navegador no deja medirlo, se graba
  // igual y termina con "Listo" o al llegar al máximo.
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  const audioContext = AudioContextClass ? new AudioContextClass() : null;
  let analyser = null;
  if (audioContext) {
    audioContext.resume?.().catch(() => {});
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    audioContext.createMediaStreamSource(stream).connect(analyser);
  }
  const samples = new Float32Array(analyser?.fftSize ?? 0);
  const startedAt = Date.now();
  let spoke = false;
  let quietSince = null;

  const timer = setInterval(() => {
    const elapsed = Date.now() - startedAt;
    if (analyser) {
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length);
      const level = Math.min(1, rms * 8);
      onLevel?.(level);
      if (level >= SPEECH_LEVEL) {
        spoke = true;
        quietSince = null;
      } else if (spoke) {
        quietSince ??= Date.now();
        if (Date.now() - quietSince >= SILENCE_MS) stop();
      }
    }
    if (elapsed >= MAX_RECORDING_MS) stop();
  }, TICK_MS);

  const release = () => {
    clearInterval(timer);
    stream.getTracks().forEach((track) => track.stop()); // apaga el ícono de grabación del sistema
    audioContext?.close().catch(() => {});
  };

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.onstop = () => {
    release();
    if (!cancelled) onStop(new Blob(chunks, { type: (recorder.mimeType || mimeType || 'audio/webm').split(';')[0] }));
  };
  recorder.start();

  function stop() {
    if (recorder.state !== 'inactive') recorder.stop();
  }

  return {
    stop,
    cancel: () => {
      cancelled = true;
      stop();
      release();
    },
  };
}
