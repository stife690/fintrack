import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearReturnToIfReached, getReturnTo, invitationKind, isInvitation, saveReturnTo } from './returnTo';

const INVITE = '/app/vacas/unirse/4NS6NP';

describe('returnTo: volver a la invitación después de entrar', () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lo guardado gana sobre state.from y sobrevive a varias lecturas (registro → login)', () => {
    saveReturnTo(INVITE);
    expect(getReturnTo('/app/presupuestos')).toBe(INVITE);
    expect(getReturnTo()).toBe(INVITE);
  });

  it('sin nada guardado usa state.from, y si no hay, /app', () => {
    expect(getReturnTo('/app/insights')).toBe('/app/insights');
    expect(getReturnTo()).toBe('/app');
  });

  it('nunca manda fuera de la zona privada', () => {
    saveReturnTo('https://otra-web.com/app');
    saveReturnTo('//otra-web.com/app');
    expect(getReturnTo('/login')).toBe('/app');
  });

  it('vence en una hora', () => {
    saveReturnTo(INVITE);
    expect(getReturnTo(undefined, Date.now() + 61 * 60 * 1000)).toBe('/app');
  });

  it('se olvida solo al llegar a esa ruta', () => {
    saveReturnTo(INVITE);
    clearReturnToIfReached('/app');
    expect(getReturnTo()).toBe(INVITE);
    clearReturnToIfReached(INVITE);
    expect(getReturnTo()).toBe('/app');
  });

  it('reconoce el enlace de invitación a una vaca y a un negocio', () => {
    expect(isInvitation(INVITE)).toBe(true);
    expect(isInvitation('/app')).toBe(false);
    expect(invitationKind(INVITE)).toBe('vaca');
    expect(invitationKind('/app/negocios/unirse/K7M2QX')).toBe('negocio');
    expect(invitationKind('/app/negocios/123')).toBeNull();
  });
});
