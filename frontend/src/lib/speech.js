/**
 * Dictado con el reconocimiento de voz del navegador (Web Speech API), sin React, para poder
 * probarlo con un micrófono simulado. El navegador convierte la voz en texto (Chrome y Edge con
 * servidores de Google o Microsoft, Safari con los de Apple); FinTrack solo recibe el texto.
 */

/**
 * Constructor del reconocimiento de voz, o `null` si el navegador no lo tiene (Firefox).
 * @param {object} [win] Objeto global; en las pruebas se pasa uno falso.
 * @returns {(new () => SpeechRecognition)|null}
 */
export function getSpeechRecognition(win = globalThis) {
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

/**
 * Traduce el error del navegador a los casos que la pantalla sabe explicar.
 * @param {string} error Valor de `SpeechRecognitionErrorEvent.error`.
 * @returns {'denied'|'offline'|'no-speech'|'no-mic'|'unavailable'}
 */
export function speechErrorCode(error) {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'denied';
    case 'network':
      return 'offline';
    case 'no-speech':
      return 'no-speech';
    case 'audio-capture':
      return 'no-mic';
    default:
      return 'unavailable';
  }
}

/**
 * @typedef {object} SpeechState
 * @property {'listening'|'done'|'error'} status
 * @property {string} transcript Lo entendido hasta ahora (se va completando mientras se habla).
 * @property {ReturnType<typeof speechErrorCode>|null} error
 */

/**
 * Empieza a escuchar una frase. Se detiene sola cuando la persona deja de hablar, o antes con
 * `stop()`; `cancel()` la descarta sin avisar nada. Cada cambio llega por `onChange`.
 *
 * @param {object} options
 * @param {(new () => SpeechRecognition)|null} options.Recognition De {@link getSpeechRecognition}.
 * @param {boolean} [options.online] `navigator.onLine`: sin red Chrome no puede dictar.
 * @param {string} [options.lang]
 * @param {(state: SpeechState) => void} options.onChange
 * @returns {{ stop: () => void, cancel: () => void }}
 */
export function startSpeechSession({ Recognition, online = true, lang = 'es-CO', onChange }) {
  const state = { status: 'listening', transcript: '', error: null };
  const emit = (patch) => {
    Object.assign(state, patch);
    onChange({ ...state });
  };
  const fail = (error) => {
    emit({ status: 'error', error });
    return { stop() {}, cancel() {} };
  };

  if (!Recognition) return fail('unavailable');
  if (!online) return fail('offline');

  const recognition = new Recognition();
  recognition.lang = lang;
  recognition.interimResults = true; // el texto aparece mientras se habla
  recognition.continuous = false; // una frase por vez: termina sola con el silencio
  recognition.maxAlternatives = 1;

  let cancelled = false;
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results, (result) => result[0].transcript).join('');
    emit({ transcript: transcript.trim() });
  };
  recognition.onerror = (event) => {
    // `aborted` llega al cancelar: no es un error que haya que mostrar.
    if (!cancelled && event.error !== 'aborted') emit({ status: 'error', error: speechErrorCode(event.error) });
  };
  recognition.onend = () => {
    if (cancelled || state.status !== 'listening') return;
    emit(state.transcript ? { status: 'done' } : { status: 'error', error: 'no-speech' });
  };

  emit({}); // avisa que empezó a escuchar
  try {
    recognition.start();
  } catch {
    return fail('unavailable');
  }

  return {
    stop: () => recognition.stop(),
    cancel: () => {
      cancelled = true;
      recognition.abort();
    },
  };
}
