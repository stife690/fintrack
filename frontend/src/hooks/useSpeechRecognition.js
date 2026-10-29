import { useCallback, useEffect, useRef, useState } from 'react';
import { getSpeechRecognition, startSpeechSession } from '@/lib/speech';

const IDLE = { status: 'idle', transcript: '', error: null };

/**
 * Dictado de una frase para el registro por voz (FT-0013). La lógica vive en `lib/speech.js`;
 * aquí solo se guarda el estado para React y se apaga el micrófono al salir de la pantalla.
 *
 * `supported` es `false` en navegadores sin dictado (Firefox): la pantalla no muestra el botón.
 * @returns {{
 *   status: 'idle'|'listening'|'done'|'error',
 *   transcript: string,
 *   error: import('@/lib/speech').SpeechState['error'],
 *   supported: boolean,
 *   start: () => void,
 *   stop: () => void,
 *   reset: () => void,
 * }}
 */
export default function useSpeechRecognition() {
  const [state, setState] = useState(IDLE);
  const session = useRef(null);

  const start = useCallback(() => {
    session.current?.cancel();
    session.current = startSpeechSession({
      Recognition: getSpeechRecognition(),
      online: navigator.onLine,
      onChange: setState,
    });
  }, []);

  const stop = useCallback(() => session.current?.stop(), []);

  const reset = useCallback(() => {
    session.current?.cancel();
    session.current = null;
    setState(IDLE);
  }, []);

  // Si la pantalla se cierra mientras escucha, el micrófono no queda encendido.
  useEffect(() => () => session.current?.cancel(), []);

  return { ...state, supported: getSpeechRecognition() !== null, start, stop, reset };
}
