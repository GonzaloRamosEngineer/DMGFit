export const formatDatePro = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  // Formato corto y limpio: "12 Feb"
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(date);
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};