import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CardForm from '@/components/cards/CardForm';
import { cardSchema } from '@/lib/validation/card';

const valid = { network: 'visa', tier: 'gold', last4: '1234', name: '', limit: '3000000', available: '2000000', paymentDay: '15', cutoffDay: '' };
const CARD = { network: 'visa', tier: 'gold', last4: '1234', name: 'Mi Visa', limit: 3000000, paymentDay: 15, cutoffDay: null };

describe('CardForm', () => {
  it('nueva: galería, 4 dígitos, cupos y día de pago, con "Más detalles" plegado', () => {
    const html = renderToStaticMarkup(<CardForm onSubmit={() => {}} />);
    for (const t of ['Tipo de tarjeta', 'Últimos 4 dígitos', 'Cupo total', 'Cupo disponible hoy', 'Día de pago', 'Más detalles', 'Agregar tarjeta', 'Los ves en la app de tu banco']) {
      expect(html).toContain(t);
    }
    expect(html).toContain('inputMode="numeric"');
    expect(html).not.toMatch(/<details[^>]*open/);
  });

  it('edición: no muestra "Cupo disponible hoy"', () => {
    const html = renderToStaticMarkup(<CardForm initial={CARD} onSubmit={() => {}} />);
    expect(html).not.toContain('Cupo disponible hoy');
    expect(html).toContain('Cupo total');
  });

  it('zod: acepta lo válido, rechaza disponible > cupo y menos de 4 dígitos', () => {
    expect(cardSchema.safeParse(valid).success).toBe(true);
    const over = cardSchema.safeParse({ ...valid, available: '3000001' });
    expect(over.error.issues[0].path).toEqual(['available']);
    expect(cardSchema.safeParse({ ...valid, last4: '123' }).success).toBe(false);
  });

  it('zod: rechaza vacíos en vez de volverlos 0', () => {
    for (const field of ['available', 'limit', 'paymentDay']) {
      const r = cardSchema.safeParse({ ...valid, [field]: '' });
      expect(r.success, field).toBe(false);
      expect(r.error.issues[0].path).toEqual([field]);
    }
  });

  it('un error del servidor en "Más detalles" lo deja abierto', () => {
    const bad = renderToStaticMarkup(<CardForm onSubmit={() => {}} initialErrors={{ cutoffDay: 'Día inválido' }} />);
    expect(bad).toMatch(/<details[^>]*open/);
    expect(bad).toContain('Día inválido');
  });
});
