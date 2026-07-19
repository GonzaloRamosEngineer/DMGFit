import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('une clases sueltas', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('ignora falsy (condicionales)', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('deja ganar la última clase de Tailwind en conflicto (twMerge)', () => {
    // px-2 y px-4 chocan → gana la última.
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});
