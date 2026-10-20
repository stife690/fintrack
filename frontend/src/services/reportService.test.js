import { describe, expect, it } from 'vitest';
import { filenameFrom } from '@/services/reportService';

describe('filenameFrom (FT-0012)', () => {
  it('lee el nombre de Content-Disposition, con o sin comillas', () => {
    expect(filenameFrom('attachment; filename="fintrack_2026-10.csv"', 'x.csv')).toBe('fintrack_2026-10.csv');
    expect(filenameFrom('attachment; filename=fintrack_2026-10.xlsx', 'x.xlsx')).toBe('fintrack_2026-10.xlsx');
  });

  it('usa el nombre de respaldo si el encabezado no llega o no trae nombre', () => {
    expect(filenameFrom(null, 'fintrack_2026-10-01_2026-10-31.csv')).toBe('fintrack_2026-10-01_2026-10-31.csv');
    expect(filenameFrom('attachment', 'respaldo.csv')).toBe('respaldo.csv');
  });
});
