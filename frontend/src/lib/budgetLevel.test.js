import { describe, expect, it } from 'vitest';
import { displayLevel, isAtLimit } from '@/lib/budgetLevel';

describe('budgetLevel', () => {
  it('gastar exactamente el límite no es pasarse', () => {
    const alert = { level: 'exceeded_100', percentage: 100 };
    expect(isAtLimit(alert)).toBe(true);
    expect(displayLevel(alert)).toBe('warning_80');
  });

  it('por encima del límite sí es exceso', () => {
    const alert = { level: 'exceeded_100', percentage: 100.01 };
    expect(isAtLimit(alert)).toBe(false);
    expect(displayLevel(alert)).toBe('exceeded_100');
  });

  it('los demás niveles no cambian', () => {
    expect(displayLevel({ level: 'warning_80', percentage: 85 })).toBe('warning_80');
    expect(displayLevel({ level: 'none', percentage: 20 })).toBe('none');
  });
});
