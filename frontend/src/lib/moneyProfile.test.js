import { describe, expect, it } from 'vitest';
import {
  MAX_PAY_DAYS,
  balanceProposal,
  incomeSummary,
  readCommitmentForm,
  toProfileData,
  togglePayDay,
} from '@/lib/moneyProfile';

describe('togglePayDay', () => {
  it('agrega en orden y quita lo que ya estaba', () => {
    expect(togglePayDay([30], 15)).toEqual([15, 30]);
    expect(togglePayDay([15, 30], 15)).toEqual([30]);
  });

  it('no pasa del máximo', () => {
    const full = Array.from({ length: MAX_PAY_DAYS }, (_, i) => i + 1);
    expect(togglePayDay(full, 20)).toEqual(full);
  });
});

describe('toProfileData', () => {
  it('deja en null lo que no se respondió', () => {
    expect(toProfileData({ incomeType: '', payDays: [], balance: '' })).toEqual({
      incomeType: null,
      payDays: [],
      balance: null,
    });
  });

  it('un saldo de 0 sí es una respuesta', () => {
    expect(toProfileData({ incomeType: '', payDays: [], balance: '0' }).balance).toBe(0);
  });

  it('solo envía días de pago con fecha fija', () => {
    expect(toProfileData({ incomeType: 'sin_fecha', payDays: [15], balance: '900000' })).toEqual({
      incomeType: 'sin_fecha',
      payDays: [],
      balance: 900000,
    });
  });
});

describe('balanceProposal', () => {
  it('propone lo que suman los movimientos', () => {
    expect(balanceProposal({ income: 7000000, expense: 1500000 })).toBe(5500000);
  });

  it('no propone nada si solo hay gastos o el total es negativo', () => {
    expect(balanceProposal({ income: 0, expense: 90000 })).toBeNull();
    expect(balanceProposal({ income: 0, expense: 0 })).toBeNull();
  });
});

describe('incomeSummary', () => {
  it('resume cómo le entra la plata', () => {
    expect(incomeSummary({ incomeType: 'fecha_fija', payDays: [18] })).toBe('Con fecha fija, el día 18');
    expect(incomeSummary({ incomeType: 'fecha_fija', payDays: [1, 15, 30] })).toBe('Con fecha fija, los días 1, 15 y 30');
    expect(incomeSummary({ incomeType: 'sin_fecha', payDays: [] })).toBe('Sin fecha fija');
    expect(incomeSummary({ incomeType: null, payDays: [] })).toBe('Aún no nos has dicho');
  });
});

describe('readCommitmentForm', () => {
  it('limpia un compromiso válido', () => {
    expect(readCommitmentForm({ name: ' Arriendo ', amount: '350000', dayOfMonth: '30' })).toEqual({
      data: { name: 'Arriendo', amount: 350000, dayOfMonth: 30 },
    });
  });

  it('dice qué falta', () => {
    expect(readCommitmentForm({ name: '', amount: '1', dayOfMonth: '1' }).error).toMatch(/nombre/);
    expect(readCommitmentForm({ name: 'Celular', amount: '', dayOfMonth: '1' }).error).toMatch(/Celular/);
    expect(readCommitmentForm({ name: 'Celular', amount: '1', dayOfMonth: '32' }).error).toMatch(/entre 1 y 31/);
    expect(readCommitmentForm({ name: 'Celular', amount: '1', dayOfMonth: '' }).error).toMatch(/entre 1 y 31/);
  });
});
