import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteAccount } from '@/services/userService';

vi.mock('@/auth/tokenStorage', () => ({
  getSession: () => ({ accessToken: 'token', refreshToken: 'r' }),
  saveSession: () => {},
  clearSession: () => {},
}));

afterEach(() => vi.unstubAllGlobals());

describe('eliminar la cuenta (FT-0017)', () => {
  it('manda DELETE /users/me con la confirmación y no espera cuerpo (204)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteAccount({ password: 'clave-1' })).resolves.toBeNull();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/users\/me$/);
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body)).toEqual({ password: 'clave-1' });
    expect(init.headers.Authorization).toBe('Bearer token');
  });

  it('con la contraseña mal deja el mensaje y el código, sin cerrar la sesión', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { code: 'CONFIRMATION_FAILED', message: 'La contraseña no es correcta' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteAccount({ password: 'otra' })).rejects.toMatchObject({
      code: 'CONFIRMATION_FAILED',
      message: 'La contraseña no es correcta',
    });
    // 403 no es 401: no se intenta renovar la sesión.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
