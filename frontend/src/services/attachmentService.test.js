import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatSize } from '@/components/transactions/AttachmentsPanel';
import { fitSize, jpgName } from '@/lib/compressImage';
import { uploadAttachment } from '@/services/attachmentService';

vi.mock('@/auth/tokenStorage', () => ({
  getSession: () => ({ accessToken: 'token', refreshToken: 'r' }),
  saveSession: () => {},
  clearSession: () => {},
}));

afterEach(() => vi.unstubAllGlobals());

describe('soportes de pago (FT-0044)', () => {
  it('reduce la foto a 1600 px de lado sin deformarla ni agrandarla', () => {
    expect(fitSize(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitSize(3024, 4032)).toEqual({ width: 1200, height: 1600 });
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('las fotos convertidas quedan con extensión .jpg', () => {
    expect(jpgName('IMG_0012.HEIC')).toBe('IMG_0012.jpg');
    expect(jpgName('factura')).toBe('factura.jpg');
  });

  it('muestra el tamaño en KB o MB', () => {
    expect(formatSize(320 * 1024)).toBe('320 KB');
    expect(formatSize(1.25 * 1024 * 1024)).toBe('1,3 MB');
    expect(formatSize(10)).toBe('1 KB');
  });

  it('sube el archivo crudo con su tipo y el nombre codificado', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 'a1' }) });
    vi.stubGlobal('fetch', fetchMock);
    const file = new Blob(['%PDF-1.7'], { type: 'application/pdf' });

    await expect(uploadAttachment('tx1', file, 'Factura Éxito.pdf')).resolves.toEqual({ id: 'a1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/transactions\/tx1\/attachments$/);
    expect(init.method).toBe('POST');
    expect(init.body).toBe(file);
    expect(init.headers['Content-Type']).toBe('application/pdf');
    expect(init.headers['X-File-Name']).toBe('Factura%20%C3%89xito.pdf');
    expect(init.headers.Authorization).toBe('Bearer token');
  });

  it('si la API rechaza el archivo, deja el código del error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 415,
        json: async () => ({ error: { code: 'UNSUPPORTED_FILE', message: 'Solo se aceptan fotos o PDF' } }),
      }),
    );
    await expect(uploadAttachment('tx1', new Blob(['x']), 'x.exe')).rejects.toMatchObject({
      code: 'UNSUPPORTED_FILE',
    });
  });
});
