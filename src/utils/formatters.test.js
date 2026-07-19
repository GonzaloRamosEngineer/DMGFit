import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  formatearFecha,
  hoyLocal,
  formatCurrency,
  formatDatePro,
} from './formatters';

describe('formatearFecha', () => {
  // Regresión del bug de timezone: una fecha `YYYY-MM-DD` guardada en la base
  // NO debe correrse un día al renderizarla (antes `new Date('2026-07-19')` se
  // interpretaba como medianoche UTC → en Salta/UTC-3 mostraba el 18).
  it('no corre el día (guarda 19 → muestra 19)', () => {
    expect(formatearFecha('2026-07-19')).toBe('19/07/2026');
  });

  it('respeta el primero de mes sin retroceder al mes anterior', () => {
    expect(formatearFecha('2026-03-01')).toBe('01/03/2026');
  });

  it('devuelve "" con entrada vacía o inválida', () => {
    expect(formatearFecha('')).toBe('');
    expect(formatearFecha(null)).toBe('');
    expect(formatearFecha('no-es-fecha')).toBe('');
  });

  it('acepta opciones de formato custom', () => {
    const out = formatearFecha('2026-07-19', { day: '2-digit', month: 'long', year: 'numeric' });
    expect(out).toContain('19');
    expect(out).toContain('2026');
  });
});

describe('hoyLocal', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // Con TZ America/Argentina (UTC-3, fijada en vitest.config), a las 23:30 del 19
  // el instante UTC ya es el 20. hoyLocal debe seguir devolviendo el 19 (día local),
  // mientras que el atajo UTC ingenuo devolvería el 20 (el bug que evita).
  it('devuelve el día local, no el UTC, pasadas las 21hs', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T23:30:00-03:00'));

    expect(hoyLocal()).toBe('2026-07-19');
    // Demostración del comportamiento buggy que corrige:
    expect(new Date().toISOString().split('T')[0]).toBe('2026-07-20');
  });

  it('formato YYYY-MM-DD', () => {
    expect(hoyLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatCurrency', () => {
  it('formatea ARS sin decimales para montos enteros comunes', () => {
    // El separador de miles en es-AR es "." → contiene "15.000".
    const out = formatCurrency(15000);
    expect(out).toContain('15.000');
    expect(out).toContain('$');
  });
});

describe('formatDatePro', () => {
  it('devuelve "" con entrada vacía', () => {
    expect(formatDatePro('')).toBe('');
  });
});
