import { describe, expect, it } from 'vitest';
import { MAX_IDEA_LENGTH, MIN_IDEA_LENGTH, isValidIdea } from '@/pages/app/Roadmap';

describe('isValidIdea', () => {
  it('exige el mismo largo que la API, sin contar espacios sobrantes', () => {
    expect(isValidIdea('x'.repeat(MIN_IDEA_LENGTH))).toBe(true);
    expect(isValidIdea('x'.repeat(MAX_IDEA_LENGTH))).toBe(true);
    expect(isValidIdea(`  ${'x'.repeat(MIN_IDEA_LENGTH - 1)}  `)).toBe(false);
    expect(isValidIdea('x'.repeat(MAX_IDEA_LENGTH + 1))).toBe(false);
  });
});
