import { describe, expect, it } from 'vitest';
import { FILTERS, STATUS_OPTIONS, filterIdeas } from '@/pages/app/IdeasAdmin';

const ideas = [
  { id: '1', status: 'revision' },
  { id: '2', status: 'planeada' },
  { id: '3', status: 'en_progreso' },
  { id: '4', status: 'lista' },
  { id: '5', status: 'descartada' },
];

describe('filterIdeas', () => {
  it('agrupa las publicadas y separa las demás', () => {
    expect(filterIdeas(ideas, 'review').map(({ id }) => id)).toEqual(['1']);
    expect(filterIdeas(ideas, 'published').map(({ id }) => id)).toEqual(['2', '3']);
    expect(filterIdeas(ideas, 'done').map(({ id }) => id)).toEqual(['4']);
    expect(filterIdeas(ideas, 'discarded').map(({ id }) => id)).toEqual(['5']);
  });

  it('todo estado cae en exactamente un filtro', () => {
    for (const { value } of STATUS_OPTIONS) {
      expect(FILTERS.filter(({ statuses }) => statuses.includes(value))).toHaveLength(1);
    }
  });
});
