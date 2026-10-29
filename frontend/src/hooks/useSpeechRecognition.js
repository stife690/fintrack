import { useCallback, useEffect, useRef, useState } from 'react';
import { CONNECTION_ERROR } from '@/lib/apiRequest';
import { canRecord, recorderErrorCode, startRecording } from '@/lib/recorder';
import { getSpeechRecognition, startSpeechSession } from '@/lib/speech';
import { transcribeVoice } from '@/services/voiceService';

const IDLE = { status: 'idle', transcript: '', error: null, level: 0, mode: null };

/**
 * Si el servidor responde que no tiene el servicio (sin `GROQ_API_KEY`), el resto de la sesión
 * usa el dictado del navegador sin volver a intentarlo.
 */
let serverUnavailable = false;

/**
 * Dictado de una frase para el registro por voz (FT-0013).
 *
 * Primero graba con el micrófono (volumen automático y sin ruido) y el servidor la convierte en
 * texto con Whisper: funciona igual en iPhone, Android y computador. Si el navegador no puede
 * grabar, o el servidor no tiene el servicio, usa el dictado del propio navegador.
 *
 * @returns {{
 *   status: 'idle'|'listening'|'transcribing'|'done'|'error',
 *   transcript: string,
 *   error: 'denied'|'offline'|'no-speech'|'no-mic'|'busy'|'unavailable'|null,
 *   level: number,
 *   mode: 'server'|'browser'|null,
 *   supported: boolean,
 *   start: () => void,
 *   stop: () => void,
 *   reset: () => void,
 * }} `level` (0 a 1) es el volumen mientras graba, para dibujar la onda (solo en modo `server`).
 */
export default function useSpeechRecognition() {
  const [state, setState] = useState(IDLE);
  const session = useRef(null);

  const start = useCallback(() => {
    session.current?.cancel();
    if (!navigator.onLine) {
      setState({ ...IDLE, status: 'error', error: 'offline' });
      return;
    }

    if (serverUnavailable || !canRecord()) {
      session.current = startSpeechSession({
        Recognition: getSpeechRecognition(),
        online: navigator.onLine,
        onChange: (speech) => setState({ ...IDLE, ...speech, mode: 'browser' }),
      });
      return;
    }

    // Se puede cancelar antes de que el navegador entregue el micrófono: por eso un objeto propio.
    let cancelled = false;
    const controller = { stop: () => {}, cancel: () => (cancelled = true) };
    session.current = controller;
    setState({ ...IDLE, status: 'listening', mode: 'server' });

    const fail = (error) => !cancelled && setState({ ...IDLE, status: 'error', error, mode: 'server' });

    startRecording({
      onLevel: (level) => !cancelled && setState((s) => (s.status === 'listening' ? { ...s, level } : s)),
      onStop: async (audio) => {
        if (cancelled) return;
        setState((s) => ({ ...s, status: 'transcribing', level: 0 }));
        try {
          const { text } = await transcribeVoice(audio);
          if (cancelled) return;
          if (text.trim()) setState({ ...IDLE, status: 'done', transcript: text.trim(), mode: 'server' });
          else fail('no-speech');
        } catch (err) {
          if (err.code === 'TRANSCRIPTION_UNAVAILABLE') serverUnavailable = true;
          if (err.code === 'RATE_LIMITED') fail('busy');
          else if (err.message === CONNECTION_ERROR) fail('offline');
          else fail('unavailable');
        }
      },
    })
      .then((recording) => {
        if (cancelled) return recording.cancel();
        controller.stop = recording.stop;
        controller.cancel = () => {
          cancelled = true;
          recording.cancel();
        };
      })
      .catch((err) => fail(recorderErrorCode(err)));
  }, []);

  const stop = useCallback(() => session.current?.stop(), []);

  const reset = useCallback(() => {
    session.current?.cancel();
    session.current = null;
    setState(IDLE);
  }, []);

  // Si la pantalla se cierra mientras escucha, el micrófono no queda encendido.
  useEffect(() => () => session.current?.cancel(), []);

  return { ...state, supported: canDictate(), start, stop, reset };
}

/** `true` si este navegador puede dictar de alguna forma (grabar o reconocer voz). */
export function canDictate() {
  return canRecord() || getSpeechRecognition() !== null;
}
