import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.AI_API_KEY = 'clave-de-prueba';
process.env.AI_PROVIDER = 'gemini';
const { completeText } = await import('./services/ai-client.service.js');

const gemini = (text) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
    status: 200,
  });

/** Sustituye fetch por una secuencia de respuestas (o errores) y cuenta las llamadas. */
async function withFetch(steps, fn) {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    const step = steps[calls++];
    if (step instanceof Error) throw step;
    return step;
  };
  try {
    return await fn(() => calls);
  } finally {
    globalThis.fetch = original;
  }
}

const ask = () => completeText({ system: 's', prompt: 'p' });

test('reintenta una vez ante un error de red y devuelve la respuesta', async () => {
  await withFetch([new TypeError('fetch failed'), gemini('alimentacion')], async (calls) => {
    assert.equal(await ask(), 'alimentacion');
    assert.equal(calls(), 2);
  });
});

test('reintenta una vez ante un 5xx del proveedor', async () => {
  await withFetch([new Response('{}', { status: 503 }), gemini('transporte')], async (calls) => {
    assert.equal(await ask(), 'transporte');
    assert.equal(calls(), 2);
  });
});

test('si el reintento también falla responde AI_UNAVAILABLE sin más intentos', async () => {
  await withFetch([new TypeError('x'), new TypeError('y'), gemini('nunca')], async (calls) => {
    await assert.rejects(ask(), { statusCode: 503, code: 'AI_UNAVAILABLE' });
    assert.equal(calls(), 2);
  });
});

test('no reintenta ante un 4xx (clave, cuota o petición inválida)', async () => {
  await withFetch([new Response('{}', { status: 400 }), gemini('nunca')], async (calls) => {
    await assert.rejects(ask(), { code: 'AI_UNAVAILABLE' });
    assert.equal(calls(), 1);
  });
});

test('chatText envía la conversación a Gemini con los turnos de la IA como "model"', async () => {
  const { chatText } = await import('./services/ai-client.service.js');
  const { env } = await import('./config/env.js');
  const original = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, init) => {
    sent = { url, body: JSON.parse(init.body) };
    return gemini('Vas bien');
  };
  try {
    const reply = await chatText({
      system: 'reglas',
      messages: [
        { role: 'user', text: 'hola' },
        { role: 'assistant', text: '¿En qué te ayudo?' },
        { role: 'user', text: '¿Voy bien?' },
      ],
    });
    assert.equal(reply, 'Vas bien');
    assert.match(sent.url, new RegExp(`/models/${env.assistantModel}:generateContent$`));
    assert.deepEqual(
      sent.body.contents.map((c) => [c.role, c.parts[0].text]),
      [
        ['user', 'hola'],
        ['model', '¿En qué te ayudo?'],
        ['user', '¿Voy bien?'],
      ],
    );
    assert.equal(sent.body.systemInstruction.parts[0].text, 'reglas');
    assert.equal(sent.body.generationConfig.temperature, 0.4);
  } finally {
    globalThis.fetch = original;
  }
});

/**
 * Respuesta de Gemini que pide una herramienta.
 * @param {string} name Herramienta pedida.
 * @param {object} [args] Argumentos.
 * @returns {Response}
 */
const geminiCall = (name, args = {}) =>
  new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ functionCall: { name, args, id: `id-${name}` }, thoughtSignature: 'firma' }],
          },
        },
      ],
    }),
    { status: 200 },
  );

test('chatWithTools ejecuta la herramienta pedida y devuelve la respuesta final', async () => {
  const { chatWithTools } = await import('./services/ai-client.service.js');
  const original = globalThis.fetch;
  const bodies = [];
  const replies = [
    geminiCall('dolar_hoy'),
    gemini('El dólar está a $3.162,35 (TRM del 29/10/2026).'),
  ];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return replies.shift();
  };
  const ran = [];
  try {
    const result = await chatWithTools({
      system: 'reglas',
      messages: [{ role: 'user', text: '¿A cómo está el dólar?' }],
      tools: [
        {
          name: 'dolar_hoy',
          description: 'TRM',
          parameters: { type: 'object', properties: {} },
          run: async (args) => {
            ran.push(args);
            return { trm: 3162.35 };
          },
        },
      ],
    });
    assert.deepEqual(result, {
      text: 'El dólar está a $3.162,35 (TRM del 29/10/2026).',
      toolsUsed: ['dolar_hoy'],
    });
    assert.deepEqual(ran, [{}]);
    // Solo se declaran nombre, descripción y parámetros: la función `run` no viaja.
    assert.deepEqual(Object.keys(bodies[0].tools[0].functionDeclarations[0]), [
      'name',
      'description',
      'parameters',
    ]);
    // El turno del modelo vuelve tal cual (con su thoughtSignature) y luego el resultado con su id.
    const [, modelTurn, toolTurn] = bodies[1].contents;
    assert.equal(modelTurn.parts[0].thoughtSignature, 'firma');
    assert.deepEqual(toolTurn.parts[0].functionResponse, {
      name: 'dolar_hoy',
      id: 'id-dolar_hoy',
      response: { trm: 3162.35 },
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('chatWithTools: una herramienta que falla o no existe responde "no disponible" sin romper', async () => {
  const { chatWithTools } = await import('./services/ai-client.service.js');
  const original = globalThis.fetch;
  const bodies = [];
  const replies = [
    geminiCall('tasas_cdt'),
    geminiCall('inventada'),
    gemini('No tengo ese dato ahora.'),
  ];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return replies.shift();
  };
  try {
    const result = await chatWithTools({
      system: 's',
      messages: [{ role: 'user', text: 'tasas' }],
      tools: [
        {
          name: 'tasas_cdt',
          description: 'd',
          parameters: {},
          run: async () => Promise.reject(new Error('caído')),
        },
      ],
    });
    assert.equal(result.text, 'No tengo ese dato ahora.');
    assert.deepEqual(bodies[1].contents.at(-1).parts[0].functionResponse.response, {
      error: 'El dato no está disponible en este momento',
    });
    assert.deepEqual(bodies[2].contents.at(-1).parts[0].functionResponse.response, {
      error: 'Esa herramienta no existe',
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('chatWithTools corta el bucle: en la última vuelta ya no ofrece herramientas', async () => {
  const { chatWithTools, MAX_TOOL_STEPS } = await import('./services/ai-client.service.js');
  const original = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    return body.tools ? geminiCall('dolar_hoy') : gemini('Listo');
  };
  try {
    const result = await chatWithTools({
      system: 's',
      messages: [{ role: 'user', text: 'x' }],
      tools: [{ name: 'dolar_hoy', description: 'd', parameters: {}, run: async () => ({}) }],
    });
    assert.equal(result.text, 'Listo');
    assert.equal(bodies.length, MAX_TOOL_STEPS + 1);
    assert.equal(bodies.at(-1).tools, undefined);
  } finally {
    globalThis.fetch = original;
  }
});
