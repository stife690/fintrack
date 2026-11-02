import { describe, expect, it, vi } from 'vitest';
import { deadlineText, inviteLink, projectionText, todayIso } from './vacaFormat';

const projection = {
  remaining: 300000,
  averagePerDay: 10000,
  estimatedDate: '2026-11-30',
  daysLeft: 10,
  neededPerDay: 30000,
  neededPerWeek: 210000,
  onTrack: false,
};

describe('vacaFormat (FT-0014/FT-0015)', () => {
  it('enlace de invitación con el código', () => {
    expect(inviteLink('K7M2QX', 'https://fintrack.app')).toBe('https://fintrack.app/app/vacas/unirse/K7M2QX');
  });

  it('hoy en el dispositivo sin pasar por UTC', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('plazo: sin fecha, días que faltan, hoy y vencida', () => {
    expect(deadlineText({ deadline: null, projection, status: 'activa' })).toBe('Sin fecha límite');
    expect(deadlineText({ deadline: '2026-11-10', projection, status: 'activa' })).toMatch(/^Faltan 10 días/);
    expect(deadlineText({ deadline: '2026-11-10', projection, status: 'activa' }, { withDate: false })).toBe('Faltan 10 días');
    expect(deadlineText({ deadline: '2026-11-10', projection: { ...projection, daysLeft: 1 }, status: 'activa' })).toMatch(
      /^Falta 1 día/,
    );
    expect(deadlineText({ deadline: '2026-11-10', projection: { ...projection, daysLeft: 0 }, status: 'activa' })).toMatch(
      /^Vence hoy/,
    );
    expect(deadlineText({ deadline: '2026-11-10', projection: { ...projection, daysLeft: -2 }, status: 'vencida' })).toMatch(
      /^Venció el/,
    );
  });

  it('ritmo: atrasados piden lo que falta por semana; a tiempo da la fecha estimada', () => {
    const late = projectionText({ deadline: '2026-11-10', projection, status: 'activa', total: 100000 });
    expect(late.tone).toBe('caution');
    expect(late.text).toContain('no llegan');
    expect(late.text).toMatch(/210\.000/);

    const ok = projectionText({ deadline: '2026-12-31', projection: { ...projection, onTrack: true }, status: 'activa', total: 100000 });
    expect(ok.tone).toBe('positive');
    expect(ok.text).toContain('Van a tiempo');
  });

  it('ritmo: sin aportes, completada y sin fecha límite', () => {
    expect(projectionText({ deadline: null, projection, status: 'activa', total: 0 }).text).toContain('Aún no hay aportes');
    expect(projectionText({ deadline: null, projection, status: 'completada', total: 9 }).tone).toBe('positive');
    expect(projectionText({ deadline: null, projection, status: 'activa', total: 5 }).text).toContain('A este ritmo');
  });
});

describe('appOrigin (dominio de los enlaces)', () => {
  it('usa VITE_APP_URL sin la barra final', async () => {
    vi.stubEnv('VITE_APP_URL', 'https://fintrackcol.online/');
    const { appOrigin, inviteLink: link } = await import('./vacaFormat');
    expect(appOrigin()).toBe('https://fintrackcol.online');
    expect(link('4NS6NP')).toBe('https://fintrackcol.online/app/vacas/unirse/4NS6NP');
    vi.unstubAllEnvs();
  });
});
