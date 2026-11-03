import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_V1 } from '@/lib/api';
import { login, register, resendVerification, verifyEmail } from '@/services/authService';

/** Simula una respuesta de la API y devuelve el mock para revisar la petición. */
function mockFetch(status, body) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Ruta y cuerpo JSON de la única petición hecha. */
function sentRequest(fetchMock) {
  const [url, init] = fetchMock.mock.calls[0];
  return { url, body: JSON.parse(init.body) };
}

afterEach(() => vi.unstubAllGlobals());

describe('verificar el correo (FT-0016)', () => {
  it('el registro devuelve el correo a confirmar, sin sesión', async () => {
    const fetchMock = mockFetch(201, { email: 'ana@correo.com', verificationRequired: true });
    await expect(register({ email: 'ana@correo.com', password: 'clave-segura-1' })).resolves.toEqual({
      email: 'ana@correo.com',
      verificationRequired: true,
    });
    expect(sentRequest(fetchMock).url).toBe(`${API_V1}/auth/register`);
  });

  it('el login sin confirmar explica qué hacer y deja el código para ofrecer el reenvío', async () => {
    mockFetch(403, { error: { code: 'EMAIL_NOT_VERIFIED', message: 'Confirma tu correo' } });
    await expect(login({ email: 'ana@correo.com', password: 'clave-segura-1' })).rejects.toMatchObject({
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Confirma tu correo para entrar: abre el enlace que te enviamos.',
    });
  });

  it('verifyEmail envía el token y devuelve la sesión', async () => {
    const session = { user: { id: '1', email: 'ana@correo.com' }, accessToken: 'a', refreshToken: 'r' };
    const fetchMock = mockFetch(200, session);
    await expect(verifyEmail('token-123')).resolves.toEqual(session);
    expect(sentRequest(fetchMock)).toEqual({ url: `${API_V1}/auth/verify-email`, body: { token: 'token-123' } });
  });

  it('un enlace vencido o usado deja el código para mostrar "pide uno nuevo"', async () => {
    mockFetch(400, { error: { code: 'INVALID_VERIFICATION_TOKEN', message: 'No sirve' } });
    await expect(verifyEmail('viejo')).rejects.toMatchObject({ code: 'INVALID_VERIFICATION_TOKEN' });
  });

  it('resendVerification pide otro enlace para el correo', async () => {
    const fetchMock = mockFetch(200, { message: 'ok' });
    await resendVerification('ana@correo.com');
    expect(sentRequest(fetchMock)).toEqual({
      url: `${API_V1}/auth/resend-verification`,
      body: { email: 'ana@correo.com' },
    });
  });
});
