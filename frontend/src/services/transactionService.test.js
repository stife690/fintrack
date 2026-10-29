import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/authFetch', () => ({ authFetch: vi.fn() }));

const { authFetch } = await import('@/lib/authFetch');
const { createTransaction, updateTransaction } = await import('@/services/transactionService');

/** Respuesta HTTP mínima que entiende `request()` del servicio. */
const respond = (status, body) => ({ ok: status < 400, status, json: async () => body });
const TX = { id: 't1', amount: 90000, type: 'gasto', category: 'alimentacion', date: '2026-10-20' };

describe('transactionService: alerta de presupuesto (FT-0006)', () => {
  beforeEach(() => {
    authFetch.mockReset();
  });

  it('createTransaction devuelve la transacción y la alerta del 80 %', async () => {
    authFetch.mockResolvedValue(
      respond(201, { transaction: TX, alert: { level: 'warning_80', percentage: 90 } }),
    );
    const result = await createTransaction({ amount: 90000, type: 'gasto' });
    expect(result.transaction).toEqual(TX);
    expect(result.alert).toEqual({ level: 'warning_80', percentage: 90 });
    expect(authFetch).toHaveBeenCalledWith('/transactions', {
      method: 'POST',
      body: { amount: 90000, type: 'gasto' },
    });
  });

  it('createTransaction devuelve la alerta del 100 %', async () => {
    authFetch.mockResolvedValue(
      respond(201, { transaction: TX, alert: { level: 'exceeded_100', percentage: 120 } }),
    );
    const { alert } = await createTransaction({});
    expect(alert.level).toBe('exceeded_100');
  });

  it('conserva alert: null cuando la categoría no tiene presupuesto', async () => {
    authFetch.mockResolvedValue(respond(201, { transaction: TX, alert: null }));
    expect((await createTransaction({})).alert).toBeNull();
  });

  it('updateTransaction también devuelve la alerta', async () => {
    authFetch.mockResolvedValue(
      respond(200, { transaction: TX, alert: { level: 'exceeded_100', percentage: 101 } }),
    );
    const result = await updateTransaction('t1', { amount: 95000 });
    expect(result.alert.percentage).toBe(101);
    expect(authFetch).toHaveBeenCalledWith('/transactions/t1', {
      method: 'PUT',
      body: { amount: 95000 },
    });
  });

  it('un error de validación llega como Error con el mensaje de la API', async () => {
    authFetch.mockResolvedValue(
      respond(422, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos',
          details: [{ field: 'amount', problem: 'El monto debe ser mayor a cero' }],
        },
      }),
    );
    await expect(createTransaction({ amount: -1 })).rejects.toThrow('El monto debe ser mayor a cero');
  });

  it('sin red avisa con un mensaje claro', async () => {
    authFetch.mockImplementation(() => Promise.reject(new TypeError('fetch failed')));
    const error = await createTransaction({}).catch((err) => err);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('No pudimos conectar');
    expect(error.code).toBe('NETWORK_ERROR');
  });

  it('si el servidor falla al renovar la sesión no lo trata como falta de red', async () => {
    const refreshFailed = Object.assign(new Error('No pudimos renovar tu sesión.'), { code: 'REFRESH_FAILED' });
    authFetch.mockImplementation(() => Promise.reject(refreshFailed));
    const error = await createTransaction({}).catch((err) => err);
    expect(error.code).toBe('REFRESH_FAILED');
  });
});

describe('transactionService: categorías propias', () => {
  beforeEach(() => {
    authFetch.mockReset();
  });

  it('updateCategory envía los cambios por PATCH y devuelve la categoría', async () => {
    const { updateCategory } = await import('@/services/transactionService');
    const updated = { key: 'c_prueba0001', name: 'Mi perro', icon: 'heart', color: 'teal', custom: true };
    authFetch.mockResolvedValue(respond(200, updated));
    expect(await updateCategory('c_prueba0001', { name: 'Mi perro', icon: 'heart' })).toEqual(updated);
    expect(authFetch).toHaveBeenCalledWith('/categories/c_prueba0001', {
      method: 'PATCH',
      body: { name: 'Mi perro', icon: 'heart' },
    });
  });

  it('deleteCategory devuelve cuántos movimientos se movieron', async () => {
    const { deleteCategory } = await import('@/services/transactionService');
    authFetch.mockResolvedValue(respond(200, { moved: 2 }));
    expect(await deleteCategory('c_prueba0001')).toEqual({ moved: 2 });
    expect(authFetch).toHaveBeenCalledWith('/categories/c_prueba0001', { method: 'DELETE', body: undefined });
  });

  it('un nombre repetido llega como error con su código', async () => {
    const { updateCategory } = await import('@/services/transactionService');
    authFetch.mockResolvedValue(
      respond(409, { error: { code: 'CATEGORY_EXISTS', message: 'Ya tienes una categoría con ese nombre' } }),
    );
    await expect(updateCategory('c_x', { name: 'Salud' })).rejects.toMatchObject({
      code: 'CATEGORY_EXISTS',
      message: 'Ya tienes una categoría con ese nombre',
    });
  });
});

describe('transactionService: orden y cambios de categorías', () => {
  const otros = { key: 'otros', name: 'Otros' };
  const salud = { key: 'salud', name: 'Salud' };
  const mascotas = { key: 'c_mascotas01', name: 'Mascotas', custom: true };

  it('sortCategories deja "Otros" y "Otros ingresos" al final', async () => {
    const { sortCategories } = await import('@/services/transactionService');
    expect(sortCategories([otros, salud, mascotas]).map((c) => c.key)).toEqual(['salud', 'c_mascotas01', 'otros']);
    expect(sortCategories([{ key: 'otros_ingresos' }, { key: 'salario' }]).map((c) => c.key)).toEqual([
      'salario',
      'otros_ingresos',
    ]);
  });

  it('applyCategoryChange pone una creada antes de "Otros" y solo en su tipo', async () => {
    const { applyCategoryChange } = await import('@/services/transactionService');
    const created = { kind: 'created', category: { ...mascotas, type: 'gasto' } };
    expect(applyCategoryChange([salud, otros], created, 'gasto').map((c) => c.key)).toEqual([
      'salud',
      'c_mascotas01',
      'otros',
    ]);
    expect(applyCategoryChange([{ key: 'salario' }], created, 'ingreso')).toEqual([{ key: 'salario' }]);
  });

  it('applyCategoryChange cambia una editada y quita una eliminada', async () => {
    const { applyCategoryChange } = await import('@/services/transactionService');
    const list = [salud, mascotas, otros];
    const renamed = applyCategoryChange(list, { kind: 'updated', category: { key: 'c_mascotas01', name: 'Mi perro' } });
    expect(renamed[1]).toEqual({ ...mascotas, name: 'Mi perro' });
    const removed = applyCategoryChange(list, { kind: 'deleted', category: { key: 'c_mascotas01' }, moved: 2 });
    expect(removed.map((c) => c.key)).toEqual(['salud', 'otros']);
  });
});
