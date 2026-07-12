export const formatDatePro = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  // Formato corto y limpio: "12 Feb"
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(date);
};

// "Hoy" en hora local (no UTC): evita que después de las 21:00 en Salta (UTC-3)
// new Date().toISOString() ya devuelva el día siguiente.
export const hoyLocal = () => {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().split('T')[0];
};

// Muestra una fecha guardada como `YYYY-MM-DD` (columna `date` en la base) sin
// el corrimiento de un día que causa `new Date('YYYY-MM-DD')` al interpretarla
// como medianoche UTC y renderizarla en hora local.
export const formatearFecha = (dateOnlyString, options = { day: '2-digit', month: '2-digit', year: 'numeric' }) => {
  if (!dateOnlyString) return '';
  const date = new Date(`${dateOnlyString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-AR', options).format(date);
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};