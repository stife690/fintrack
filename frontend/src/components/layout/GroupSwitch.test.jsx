import { describe, expect, it } from 'vitest';
import GroupSwitch from '@/components/layout/GroupSwitch';

describe('GroupSwitch: selector Vacas | Negocios', () => {
  it('cambiar de pestaña reemplaza el historial, así "atrás" vuelve al inicio y no a la otra pestaña', () => {
    const links = GroupSwitch().props.children;
    expect(links.map((l) => l.props.to)).toEqual(['/app/vacas', '/app/negocios']);
    for (const link of links) expect(link.props.replace).toBe(true);
  });
});
