import { describe, expect, it } from 'vitest';
import { pickHomeNotice } from '@/lib/homeNotice';

const money = (value) => `$${value}`;
const names = { vivienda: 'Vivienda' };
const card = (daysToPayment, extra = {}) => ({ id: 7, network: 'visa', name: 'Mi Visa', last4: '4242', used: 320000, daysToPayment, paidThisCycle: false, ...extra });
const budget = (level, percentage = level === 'exceeded_100' ? 120 : 89) => ({ category: 'vivienda', amount: 450000, consumed: 400000, percentage, alert: { level, percentage } });
const pending = [{ name: 'Internet', amount: 90000, date: '2026-11-08' }];
const pick = (data) => pickHomeNotice({ names, money, ...data });

describe('pickHomeNotice', () => {
  it('sin nada que decir, no hay aviso', () => {
    expect(pick({})).toBeNull();
  });

  it('una tarjeta atrasada va primero que todo', () => {
    const notice = pick({ cards: [card(-1)], budgets: [budget('exceeded_100')], pending });
    expect(notice.title).toContain('atrasado');
    expect(notice.to).toBe('/app/tarjetas/7');
  });

  it('un presupuesto pasado va antes que una tarjeta por vencer', () => {
    expect(pick({ cards: [card(2)], budgets: [budget('exceeded_100')] }).title).toBe('Te pasaste en Vivienda');
  });

  it('una tarjeta por vencer va antes que un pago pendiente y un presupuesto cerca del límite', () => {
    const notice = pick({ cards: [card(3)], budgets: [budget('warning_80')], pending });
    expect(notice.title).toContain('se paga en 3 días');
    expect(notice.detail).toBe('Debes $320000');
  });

  it('el pago pendiente va antes que el presupuesto cerca del límite y una tarjeta lejana', () => {
    expect(pick({ cards: [card(12)], budgets: [budget('warning_80')], pending }).title).toContain('Internet vence');
  });

  it('el presupuesto cerca del límite va antes que una tarjeta lejana', () => {
    expect(pick({ cards: [card(12)], budgets: [budget('warning_80')] }).title).toContain('ya casi llega');
  });

  it('elige la tarjeta que se paga primero e ignora las ya pagadas', () => {
    const cards = [card(1, { id: 1, paidThisCycle: true }), card(12, { id: 2 }), card(5, { id: 3 })];
    expect(pick({ cards }).to).toBe('/app/tarjetas/3');
  });
});
