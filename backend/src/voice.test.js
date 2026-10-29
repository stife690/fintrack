import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { signAccessToken } from './services/token.service.js';
import { MAX_AUDIO_BYTES, transcribeAudio } from './services/transcription.service.js';

const audio = Buffer.from('audio de prueba');

/**
 * Sustituye fetch (la llamada a Groq) y guarda lo que se le envió.
 * @param {Response|Error} reply Lo que "responde" Groq, o el error de red que lanza.
 * @param {(calls: Array<{ url: string, init: RequestInit }>) => Promise<void>} fn
 * @returns {Promise<void>}
 */
async function withGroq(reply, fn) {
  const original = globalThis.fetch;
  const previousKey = env.groqApiKey;
  env.groqApiKey = 'clave-de-prueba';
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (reply instanceof Error) throw reply;
    return reply;
  };
  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = original;
    env.groqApiKey = previousKey;
  }
}

const groqText = (text) => new Response(JSON.stringify({ text }), { status: 200 });

test('transcribeAudio envía el audio a Whisper en español con la clave en la cabecera', async () => {
  await withGroq(groqText(' almuerzo 15 mil '), async (calls) => {
    assert.equal(await transcribeAudio(audio, 'audio/webm'), 'almuerzo 15 mil');
    const { url, init } = calls[0];
    assert.match(url, /api\.groq\.com\/openai\/v1\/audio\/transcriptions$/);
    assert.equal(init.headers.authorization, 'Bearer clave-de-prueba');
    assert.equal(init.body.get('language'), 'es');
    assert.equal(init.body.get('model'), env.sttModel);
    assert.equal(init.body.get('file').name, 'voz.webm');
    // Solo viaja el audio y la configuración: ningún dato del usuario.
    assert.deepEqual([...init.body.keys()].sort(), [
      'file',
      'language',
      'model',
      'prompt',
      'response_format',
      'temperature',
    ]);
  });
});

test('transcribeAudio usa la extensión de Safari (m4a) para audio/mp4', async () => {
  await withGroq(groqText('taxi 12 mil'), async (calls) => {
    await transcribeAudio(audio, 'audio/mp4');
    assert.equal(calls[0].init.body.get('file').name, 'voz.m4a');
  });
});

test('transcribeAudio devuelve vacío cuando Whisper inventa texto sobre silencio', async () => {
  for (const invented of [
    'Subtítulos realizados por la comunidad de Amara.org',
    'Gracias.',
    '...',
  ]) {
    await withGroq(groqText(invented), async () => {
      assert.equal(await transcribeAudio(audio, 'audio/webm'), '');
    });
  }
});

test('transcribeAudio: sin clave, error de red o respuesta inválida → 503 TRANSCRIPTION_UNAVAILABLE', async () => {
  const previousKey = env.groqApiKey;
  env.groqApiKey = undefined;
  await assert.rejects(transcribeAudio(audio, 'audio/webm'), {
    statusCode: 503,
    code: 'TRANSCRIPTION_UNAVAILABLE',
  });
  env.groqApiKey = previousKey;

  await withGroq(new TypeError('fetch failed'), async () => {
    await assert.rejects(transcribeAudio(audio, 'audio/webm'), { statusCode: 503 });
  });
  await withGroq(new Response('{}', { status: 500 }), async () => {
    await assert.rejects(transcribeAudio(audio, 'audio/webm'), { statusCode: 503 });
  });
  await withGroq(new Response(JSON.stringify({ sin: 'texto' }), { status: 200 }), async () => {
    await assert.rejects(transcribeAudio(audio, 'audio/webm'), { statusCode: 503 });
  });
});

test('transcribeAudio: si Groq agota la cuota responde 429 RATE_LIMITED', async () => {
  await withGroq(new Response('{}', { status: 429 }), async () => {
    await assert.rejects(transcribeAudio(audio, 'audio/webm'), {
      statusCode: 429,
      code: 'RATE_LIMITED',
    });
  });
});

test('POST /voice/transcribe valida sesión, formato y tamaño antes de llamar a Groq', async () => {
  const previousKey = env.groqApiKey;
  env.groqApiKey = undefined; // ninguna prueba de la ruta llega a Groq
  const server = createApp().listen(0);
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/v1/voice/transcribe`;
    const token = signAccessToken('00000000-0000-0000-0000-000000000001');
    const send = (body, type, auth = true) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': type, ...(auth && { Authorization: `Bearer ${token}` }) },
        body,
      }).then(async (r) => ({ status: r.status, code: (await r.json()).error?.code }));

    assert.deepEqual(await send(audio, 'audio/webm', false), { status: 401, code: 'UNAUTHORIZED' });
    assert.deepEqual(await send('hola', 'text/plain'), {
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
    assert.deepEqual(await send(Buffer.alloc(0), 'audio/webm'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
    assert.deepEqual(await send(Buffer.alloc(MAX_AUDIO_BYTES + 1), 'audio/webm'), {
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    });
    // Formato con parámetros (como lo graba Chrome) y sin GROQ_API_KEY: 503 para usar el dictado del navegador.
    assert.deepEqual(await send(audio, 'audio/webm;codecs=opus'), {
      status: 503,
      code: 'TRANSCRIPTION_UNAVAILABLE',
    });
  } finally {
    server.close();
    env.groqApiKey = previousKey;
  }
});
