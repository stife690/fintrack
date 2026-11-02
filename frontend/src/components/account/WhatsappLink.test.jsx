import { describe, expect, it } from 'vitest';
import { chatUrl } from '@/components/account/WhatsappLink';

describe('chatUrl', () => {
  it('abre el chat del bot con el código escrito', () => {
    expect(chatUrl('15551773374', 'FT-AB23CD45')).toBe('https://wa.me/15551773374?text=FT-AB23CD45');
  });
});
