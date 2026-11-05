import { describe, expect, it } from 'vitest';
import { businessMovementSchema } from '@/lib/validation/businessMovement';

describe('businessMovementSchema', () => {
  const schema = businessMovementSchema('2026-11-04');

  it('acepta un movimiento válido y convierte el monto', () => {
    expect(schema.parse({ amount: '12000', description: ' Arepas ', date: '2026-11-04' })).toEqual({
      amount: 12000,
      description: 'Arepas',
      date: '2026-11-04',
    });
  });

  it('rechaza monto vacío, sin descripción y fecha futura', () => {
    const r = schema.safeParse({ amount: '', description: '', date: '2026-11-05' });
    expect(r.success).toBe(false);
    expect(r.error.issues.map((i) => i.path[0]).sort()).toEqual(['amount', 'date', 'description']);
  });
});
