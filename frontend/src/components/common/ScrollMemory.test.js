import { describe, expect, it } from 'vitest';
import { memoryKey, scrollTargetFor } from './ScrollMemory';

describe('scrollTargetFor', () => {
  it('un clic en un enlace #ancla deja bajar al navegador, aunque haya posición guardada', () => {
    expect(scrollTargetFor({ hash: '#funcionalidades', type: 'POP', anchorClick: true })).toBeNull();
    expect(scrollTargetFor({ hash: '#seguridad', type: 'POP', saved: 300, anchorClick: true })).toBeNull();
  });

  it('al volver atrás regresa a donde estaba, con o sin #ancla', () => {
    expect(scrollTargetFor({ hash: '#seguridad', type: 'POP', saved: 4600 })).toBe(4600);
    expect(scrollTargetFor({ hash: '', type: 'POP', saved: 640 })).toBe(640);
  });

  it('al volver a una página sin posición guardada empieza arriba; con #ancla no la toca', () => {
    expect(scrollTargetFor({ hash: '', type: 'POP' })).toBe(0);
    expect(scrollTargetFor({ hash: '#faq', type: 'POP' })).toBeNull();
  });

  it('al avanzar a otra página empieza arriba, salvo con #ancla', () => {
    expect(scrollTargetFor({ hash: '', type: 'PUSH' })).toBe(0);
    expect(scrollTargetFor({ hash: '#faq', type: 'PUSH' })).toBeNull();
  });
});

describe('memoryKey', () => {
  it('las entradas que no creó React Router se distinguen por su ruta', () => {
    expect(memoryKey('default', '/#seguridad')).not.toBe(memoryKey('default', '/#faq'));
  });

  it('las demás usan su propia llave', () => {
    expect(memoryKey('k3x9a', '/login')).toBe('k3x9a');
  });
});
