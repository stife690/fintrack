import { describe, expect, it } from 'vitest';
import { parseSpokenTransaction } from '@/lib/voiceEntry';

describe('parseSpokenTransaction', () => {
  it('entiende el monto con "mil", "k" o separadores de miles', () => {
    expect(parseSpokenTransaction('almuerzo 15 mil')).toMatchObject({ amount: 15000, description: 'Almuerzo' });
    expect(parseSpokenTransaction('taxi 12k')).toMatchObject({ amount: 12000, description: 'Taxi' });
    expect(parseSpokenTransaction('netflix 26.900')).toMatchObject({ amount: 26900, description: 'Netflix' });
    expect(parseSpokenTransaction('$45.900 en Éxito')).toMatchObject({ amount: 45900, description: 'Éxito' });
  });

  it('acepta millones con coma o punto decimal', () => {
    expect(parseSpokenTransaction('me pagaron 1,2 millones').amount).toBe(1_200_000);
    expect(parseSpokenTransaction('me pagaron 1.2 millones').amount).toBe(1_200_000);
  });

  it('entiende las formas colombianas de decir plata', () => {
    expect(parseSpokenTransaction('medio palo de arriendo')).toMatchObject({ amount: 500_000, description: 'Arriendo' });
    expect(parseSpokenTransaction('15 lucas el corrientazo')).toMatchObject({ amount: 15000, description: 'Corrientazo' });
    expect(parseSpokenTransaction('una luca de chicle').amount).toBe(1000);
  });

  it('marca como ingreso lo que entró y como gasto lo demás', () => {
    expect(parseSpokenTransaction('me pagaron 1,2 millones').type).toBe('ingreso');
    expect(parseSpokenTransaction('almuerzo 15 mil').type).toBe('gasto');
  });

  it('reconoce las palabras con tilde ("recibí")', () => {
    expect(parseSpokenTransaction('recibí 300 mil de mi mamá')).toMatchObject({
      type: 'ingreso',
      amount: 300_000,
      description: 'Mi mamá',
    });
  });

  it('pone una descripción al ingreso que solo dice el monto', () => {
    expect(parseSpokenTransaction('me pagaron 1,2 millones').description).toBe('Pago recibido');
  });

  it('con una cantidad ofrece el precio y el total, y conserva la cantidad en la descripción', () => {
    expect(parseSpokenTransaction('2 almuerzos de 12 mil')).toEqual({
      type: 'gasto',
      amount: 12000,
      options: [12000, 24000],
      description: '2 almuerzos',
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      ambiguous: true,
    });
    expect(parseSpokenTransaction('3 empanadas a 2 mil').options).toEqual([2000, 6000]);
  });

  it('si el dictado se come el "mil", un número pequeño al final se toma como miles', () => {
    expect(parseSpokenTransaction('3 almuerzos de 15')).toMatchObject({
      amount: 15000,
      options: [15000, 45000],
      description: '3 almuerzos',
    });
    expect(parseSpokenTransaction('almuerzo 15').amount).toBe(15000);
    // Un número pequeño que no está al final es una cantidad, no un precio.
    expect(parseSpokenTransaction('2 almuerzos').amount).toBe(2);
    // Desde 100 sí puede ser un precio real en pesos.
    expect(parseSpokenTransaction('propina 500').amount).toBe(500);
  });

  it('entiende la cantidad dicha con palabras ("tres almuerzos")', () => {
    expect(parseSpokenTransaction('tres almuerzos de 15')).toMatchObject({
      amount: 15000,
      options: [15000, 45000],
      description: 'Tres almuerzos',
    });
    expect(parseSpokenTransaction('dos empanadas a 2 mil').options).toEqual([2000, 4000]);
    // "dos mil" es parte del monto, no una cantidad.
    expect(parseSpokenTransaction('pasaje dos mil 500').options).toEqual([500]);
  });

  it('no ofrece total si la cantidad es mayor que 20', () => {
    expect(parseSpokenTransaction('50 almuerzos de 12 mil')).toMatchObject({ options: [12000], ambiguous: true });
  });

  it('sin monto devuelve null y deja la descripción', () => {
    expect(parseSpokenTransaction('almuerzo')).toMatchObject({ amount: null, options: [], description: 'Almuerzo' });
    expect(parseSpokenTransaction('')).toMatchObject({ amount: null, options: [], description: '' });
  });

  it('acepta miles con coma y decimales con punto', () => {
    expect(parseSpokenTransaction('carro 1,500,000').amount).toBe(1_500_000);
    expect(parseSpokenTransaction('uber 1500.50').amount).toBe(1500.5);
  });

  it('descarta montos por encima del máximo que acepta la API en vez de recortarlos', () => {
    expect(parseSpokenTransaction('casa 20000000000').amount).toBeNull();
  });

  describe('fecha dicha', () => {
    // Miércoles 28 de octubre de 2026.
    const now = new Date(2026, 9, 28, 15, 30);
    const parse = (text) => parseSpokenTransaction(text, now);

    it('sin fecha es hoy', () => {
      expect(parse('almuerzo 15 mil').date).toBe('2026-10-28');
    });

    it('"el 12 de octubre" es la fecha y su número no se toma como cantidad', () => {
      expect(parse('el 12 de octubre gaste 15.000 en el almuerzo')).toMatchObject({
        date: '2026-10-12',
        amount: 15000,
        options: [15000],
        description: 'Almuerzo',
        ambiguous: false,
      });
    });

    it('entiende ayer, antier, "hace tres días" y el día de la semana', () => {
      expect(parse('ayer taxi 12 mil')).toMatchObject({ date: '2026-10-27', description: 'Taxi' });
      expect(parse('antier almuerzo 15 mil').date).toBe('2026-10-26');
      expect(parse('hace tres días gasolina 50 mil').date).toBe('2026-10-25');
      expect(parse('el lunes mercado 80 mil')).toMatchObject({ date: '2026-10-26', description: 'Mercado' });
    });

    it('nunca da una fecha futura', () => {
      expect(parse('el 20 de diciembre regalos 100 mil').date).toBe('2025-12-20');
      expect(parse('el 30 cine 20 mil')).toMatchObject({ date: '2026-09-30', amount: 20000 });
    });

    it('"el 15 mil" es un monto, no un día', () => {
      expect(parse('almuerzo el 15 mil')).toMatchObject({ date: '2026-10-28', amount: 15000 });
    });
  });
});
