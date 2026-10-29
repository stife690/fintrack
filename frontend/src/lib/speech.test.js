import { describe, expect, it } from 'vitest';
import { getSpeechRecognition, speechErrorCode, startSpeechSession } from '@/lib/speech';

/** Micrófono simulado: guarda la instancia para disparar sus eventos desde la prueba. */
function fakeRecognition() {
  const created = [];
  class FakeRecognition {
    constructor() {
      this.started = false;
      this.aborted = false;
      created.push(this);
    }
    start() {
      this.started = true;
    }
    stop() {
      this.onend?.();
    }
    abort() {
      this.aborted = true;
      this.onerror?.({ error: 'aborted' });
      this.onend?.();
    }
    /** Simula lo que el navegador entendió: cada texto es un tramo de la frase. */
    say(...parts) {
      this.onresult?.({ results: parts.map((text) => [{ transcript: text }]) });
    }
  }
  return { FakeRecognition, last: () => created.at(-1) };
}

/** Inicia una sesión y guarda cada estado que avisa. */
function listen(options) {
  const states = [];
  const session = startSpeechSession({ onChange: (s) => states.push(s), ...options });
  return { session, states, last: () => states.at(-1) };
}

describe('getSpeechRecognition', () => {
  it('usa la versión estándar, la de Safari/Chrome con prefijo o ninguna', () => {
    const Std = function Std() {};
    const Webkit = function Webkit() {};
    expect(getSpeechRecognition({ SpeechRecognition: Std, webkitSpeechRecognition: Webkit })).toBe(Std);
    expect(getSpeechRecognition({ webkitSpeechRecognition: Webkit })).toBe(Webkit);
    expect(getSpeechRecognition({})).toBeNull();
  });
});

describe('speechErrorCode', () => {
  it('agrupa los errores del navegador en casos que se le pueden explicar al usuario', () => {
    expect(speechErrorCode('not-allowed')).toBe('denied');
    expect(speechErrorCode('service-not-allowed')).toBe('denied');
    expect(speechErrorCode('network')).toBe('offline');
    expect(speechErrorCode('no-speech')).toBe('no-speech');
    expect(speechErrorCode('audio-capture')).toBe('no-mic');
    expect(speechErrorCode('language-not-supported')).toBe('unavailable');
  });
});

describe('startSpeechSession', () => {
  it('escucha en español de Colombia y muestra el texto mientras se habla', () => {
    const { FakeRecognition, last: rec } = fakeRecognition();
    const { states, last } = listen({ Recognition: FakeRecognition });

    expect(rec()).toMatchObject({ started: true, lang: 'es-CO', interimResults: true, continuous: false });
    expect(states[0]).toEqual({ status: 'listening', transcript: '', error: null });

    rec().say('almuerzo');
    expect(last()).toMatchObject({ status: 'listening', transcript: 'almuerzo' });
    rec().say('almuerzo', ' 15 mil');
    expect(last()).toMatchObject({ status: 'listening', transcript: 'almuerzo 15 mil' });
  });

  it('al dejar de hablar termina con la frase completa', () => {
    const { FakeRecognition, last: rec } = fakeRecognition();
    const { last } = listen({ Recognition: FakeRecognition });
    rec().say('taxi 12 mil');
    rec().onend();
    expect(last()).toEqual({ status: 'done', transcript: 'taxi 12 mil', error: null });
  });

  it('"Listo" (stop) también termina con lo que se alcanzó a decir', () => {
    const { FakeRecognition, last: rec } = fakeRecognition();
    const { session, last } = listen({ Recognition: FakeRecognition });
    rec().say('netflix 26.900');
    session.stop();
    expect(last().status).toBe('done');
  });

  it('si termina sin haber entendido nada avisa "no-speech"', () => {
    const { FakeRecognition, last: rec } = fakeRecognition();
    const { last } = listen({ Recognition: FakeRecognition });
    rec().onend();
    expect(last()).toMatchObject({ status: 'error', error: 'no-speech' });
  });

  it('si se niega el micrófono avisa "denied" una sola vez', () => {
    const { FakeRecognition, last: rec } = fakeRecognition();
    const { states, last } = listen({ Recognition: FakeRecognition });
    rec().onerror({ error: 'not-allowed' });
    rec().onend();
    expect(last()).toMatchObject({ status: 'error', error: 'denied' });
    expect(states.filter((s) => s.status === 'error')).toHaveLength(1);
  });

  it('cancelar descarta la sesión sin mostrar errores', () => {
    const { FakeRecognition, last: rec } = fakeRecognition();
    const { session, states } = listen({ Recognition: FakeRecognition });
    rec().say('almuerzo');
    session.cancel();
    expect(rec().aborted).toBe(true);
    expect(states.at(-1).status).toBe('listening'); // nada nuevo después de cancelar
  });

  it('sin conexión ni siquiera enciende el micrófono', () => {
    const { FakeRecognition, last: rec } = fakeRecognition();
    const { last } = listen({ Recognition: FakeRecognition, online: false });
    expect(rec()).toBeUndefined();
    expect(last()).toMatchObject({ status: 'error', error: 'offline' });
  });

  it('en un navegador sin dictado avisa "unavailable"', () => {
    const { last } = listen({ Recognition: null });
    expect(last()).toMatchObject({ status: 'error', error: 'unavailable' });
  });
});
