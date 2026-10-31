import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authFetch, SESSION_EXPIRED_EVENT } = await import('./authFetch');
const { getSession, saveSession } = await import('@/auth/tokenStorage');

const json = (status, body = {}) => new Response(JSON.stringify(body), { status });
const user = { id: 'u1', email: 'ana@x.co' };

describe('authFetch: sesión compartida entre ventanas', () => {
  let expired;
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    });
    const win = new EventTarget();
    expired = 0;
    win.addEventListener(SESSION_EXPIRED_EVENT, () => (expired += 1));
    vi.stubGlobal('window', win);
    vi.stubGlobal('navigator', {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('access vencido: renueva una vez y repite la petición', async () => {
    saveSession({ user, accessToken: 'a1', refreshToken: 'r1' });
    const fetch = vi.fn(async (url, init) => {
      if (url.endsWith('/auth/refresh')) return json(200, { accessToken: 'a2', refreshToken: 'r2' });
      return init.headers.Authorization === 'Bearer a2' ? json(200, { ok: true }) : json(401);
    });
    vi.stubGlobal('fetch', fetch);
    expect((await authFetch('/users/me')).status).toBe(200);
    expect(getSession()).toMatchObject({ accessToken: 'a2', refreshToken: 'r2' });
  });

  it('si otra ventana ya renovó, usa sus tokens y no gasta el refresh token viejo', async () => {
    saveSession({ user, accessToken: 'a1', refreshToken: 'r1' });
    const fetch = vi.fn(async (url, init) => {
      if (url.endsWith('/auth/refresh')) throw new Error('no debería renovar');
      if (init.headers.Authorization === 'Bearer a1') {
        // Mientras esta petición viajaba, la otra ventana renovó y guardó tokens nuevos.
        saveSession({ user, accessToken: 'a2', refreshToken: 'r2' });
        return json(401);
      }
      return json(200);
    });
    vi.stubGlobal('fetch', fetch);
    expect((await authFetch('/users/me')).status).toBe(200);
    expect(expired).toBe(0);
  });

  it('perder la carrera del refresh (401) no cierra la sesión si la otra ventana ya guardó tokens', async () => {
    saveSession({ user, accessToken: 'a1', refreshToken: 'r1' });
    const fetch = vi.fn(async (url, init) => {
      if (url.endsWith('/auth/refresh')) {
        saveSession({ user, accessToken: 'a2', refreshToken: 'r2' }); // la otra ventana ganó
        return json(401);
      }
      return init.headers.Authorization === 'Bearer a2' ? json(200) : json(401);
    });
    vi.stubGlobal('fetch', fetch);
    expect((await authFetch('/users/me')).status).toBe(200);
    expect(expired).toBe(0);
    expect(getSession()).not.toBeNull();
  });

  it('refresh token vencido de verdad: borra la sesión y avisa', async () => {
    saveSession({ user, accessToken: 'a1', refreshToken: 'r1' });
    vi.stubGlobal('fetch', vi.fn(async () => json(401)));
    expect((await authFetch('/users/me')).status).toBe(401);
    expect(getSession()).toBeNull();
    expect(expired).toBe(1);
  });

  it('sin sesión guardada (se cerró en otra ventana): avisa para ir al login en vez de 401 en silencio', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(401)));
    expect((await authFetch('/users/me')).status).toBe(401);
    expect(expired).toBe(1);
  });
});
