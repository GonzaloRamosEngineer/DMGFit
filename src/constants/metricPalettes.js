/**
 * Paletas de DATO / CATEGORÍA para tarjetas de métricas (KPICard, MetricsStrip, PlanMetrics).
 *
 * IMPORTANTE: estos colores son INTENCIONALMENTE distintos de los tokens de marca
 * (primary/secondary/accent/success/warning/error). Son acentos de visualización de
 * datos — una "rueda" de categorías para distinguir métricas entre sí. NO los
 * reemplaces por tokens de marca ni los confundas con estado semántico.
 *
 * Fuente única de verdad: antes esta paleta estaba duplicada en 3 componentes.
 */
export const METRIC_PALETTES = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', stroke: 'stroke-blue-400' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', stroke: 'stroke-emerald-400' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', stroke: 'stroke-violet-400' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', stroke: 'stroke-amber-400' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', stroke: 'stroke-rose-400' },
};

export const getMetricPalette = (color) => METRIC_PALETTES[color] || METRIC_PALETTES.blue;

export default METRIC_PALETTES;
