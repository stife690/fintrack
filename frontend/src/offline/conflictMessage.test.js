import { describe, expect, it } from 'vitest';
import { conflictMessage } from './conflictMessage';

const alive = { id: 's1', description: 'Almuerzo', deletedAt: null };
const deleted = { ...alive, deletedAt: '2026-10-21T10:00:00Z' };

describe('conflictMessage (FT-0009)', () => {
  it('server_wins al editar: avisa que la edición no se aplicó', () => {
    expect(conflictMessage({ resolution: 'server_wins', op: 'update', serverVersion: alive, name: 'Almuerzo' })).toEqual({
      tone: 'warning',
      text: 'Tu edición de «Almuerzo» no se aplicó: otro dispositivo lo cambió después. Quedó la versión más reciente.',
    });
  });

  it('server_wins al editar algo que se borró (o ya no existe): lo dice y no se aplica', () => {
    for (const serverVersion of [deleted, null]) {
      expect(conflictMessage({ resolution: 'server_wins', op: 'update', serverVersion, name: 'Almuerzo' })).toEqual({
        tone: 'warning',
        text: '«Almuerzo» se eliminó en otro dispositivo; tu edición no se aplicó.',
      });
    }
  });

  it('server_wins al eliminar: no se eliminó porque otro dispositivo lo modificó', () => {
    expect(conflictMessage({ resolution: 'server_wins', op: 'delete', serverVersion: alive, name: 'Almuerzo' })).toEqual({
      tone: 'warning',
      text: 'No se eliminó «Almuerzo»: otro dispositivo lo modificó después.',
    });
  });

  it('eliminar algo que ya no existía en el servidor no es una pérdida: tono informativo', () => {
    const message = conflictMessage({ resolution: 'server_wins', op: 'delete', serverVersion: null, name: 'Almuerzo' });
    expect(message.tone).toBe('info');
    expect(message.text).toBe('«Almuerzo» ya no existía en el servidor; no había nada que eliminar.');
  });

  it('client_wins: gana el usuario, tono informativo', () => {
    expect(conflictMessage({ resolution: 'client_wins', op: 'update', serverVersion: alive, name: 'Almuerzo' })).toEqual({
      tone: 'info',
      text: 'Tu edición de «Almuerzo» reemplazó un cambio hecho en otro dispositivo.',
    });
    expect(conflictMessage({ resolution: 'client_wins', op: 'delete', serverVersion: deleted, name: 'Almuerzo' })).toEqual({
      tone: 'info',
      text: 'Eliminaste «Almuerzo», que otro dispositivo había modificado.',
    });
  });

  it('sin nombre usa "el movimiento" y arranca la oración con mayúscula', () => {
    expect(conflictMessage({ resolution: 'server_wins', op: 'update', serverVersion: null }).text).toBe(
      'El movimiento se eliminó en otro dispositivo; tu edición no se aplicó.',
    );
    expect(conflictMessage({ resolution: 'server_wins', op: 'delete', serverVersion: alive }).text).toBe(
      'No se eliminó el movimiento: otro dispositivo lo modificó después.',
    );
  });
});
