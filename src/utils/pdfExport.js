import jsPDF from 'jspdf';

const INTERNAL_DOMAINS = ['@dmg.internal', '@vcfit.internal'];

const isInternalEmail = (email) =>
  !!email && INTERNAL_DOMAINS.some((domain) => String(email).endsWith(domain));

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('es-AR');
};

const PAYMENT_LABELS = {
  paid: 'Pagado',
  pending: 'Pendiente',
  overdue: 'Vencido',
  void: 'Anulado',
};

/**
 * Informe del atleta en PDF, con datos reales del perfil (identidad, membresía,
 * estado de cuota, asistencia por kiosco y últimos pagos). Sin secciones
 * inventadas: si un dato no existe se muestra "—" y se omiten los pagos anulados.
 *
 * @param {object} athlete  El objeto profileData.athlete del perfil.
 * @param {object} data     { payments, attendance, kioskRemaining }
 */
export const generateAthletePDF = async (athlete, data = {}) => {
  const { payments = [], attendance = [], kioskRemaining = null } = data;
  if (!athlete) return;

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 15;

  // Paleta de marca VC Fit
  const brand = [0, 102, 255]; // #0066FF electric blue
  const ink = [30, 30, 30];
  const soft = [110, 110, 110];

  const sectionHeader = (title, y) => {
    pdf.setFillColor(240, 244, 255); // primary-light suave
    pdf.rect(marginX, y - 5, pageWidth - marginX * 2, 8, 'F');
    pdf.setTextColor(...brand);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, marginX + 3, y);
    pdf.setTextColor(...ink);
  };

  const row = (label, value, x, y) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...soft);
    pdf.setFontSize(9);
    pdf.text(label.toUpperCase(), x, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...ink);
    pdf.setFontSize(11);
    pdf.text(String(value ?? '—'), x, y + 5);
  };

  // ── Encabezado de marca ─────────────────────────────────────────
  pdf.setFillColor(...brand);
  pdf.rect(0, 0, pageWidth, 28, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.text('VC Fit', marginX, 15);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Informe del Atleta', marginX, 22);

  let y = 42;

  // ── Nombre + estado ─────────────────────────────────────────────
  pdf.setTextColor(...ink);
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text(athlete.name || 'Atleta', marginX, y);
  const isActive = athlete.status === 'active';
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(isActive ? 34 : 150, isActive ? 160 : 150, isActive ? 70 : 150);
  pdf.text(isActive ? 'ACTIVO' : 'INACTIVO', pageWidth - marginX, y, { align: 'right' });

  // ── Datos personales ────────────────────────────────────────────
  y += 12;
  sectionHeader('Datos personales', y);
  y += 12;
  const email = isInternalEmail(athlete.email) ? '— (sin email)' : athlete.email || '—';
  row('Documento', athlete.dni || '—', marginX, y);
  row('Teléfono', athlete.phone || '—', marginX + 65, y);
  row('Miembro desde', formatDate(athlete.join_date || athlete.joinDate), marginX + 130, y);
  y += 14;
  row('Email', email, marginX, y);

  // ── Membresía ───────────────────────────────────────────────────
  y += 16;
  sectionHeader('Membresía', y);
  y += 12;
  row('Plan', athlete.planName || 'Sin plan', marginX, y);
  row('Opción', athlete.planOption || '—', marginX + 65, y);
  row(
    'Visitas/semana',
    athlete.visits_per_week ? `${athlete.visits_per_week}x` : '—',
    marginX + 130,
    y,
  );
  y += 14;
  row(
    'Precio acordado',
    athlete.plan_tier_price ? formatCurrency(athlete.plan_tier_price) : '—',
    marginX,
    y,
  );

  // ── Resumen operativo ───────────────────────────────────────────
  const total = attendance.length;
  const present = attendance.filter((a) => a?.status === 'present').length;
  const attendanceRate = total > 0 ? Math.round((present / total) * 100) : null;
  const lastPayment = payments.find((p) => p?.status !== 'void');
  const cuota = lastPayment ? PAYMENT_LABELS[lastPayment.status] || '—' : 'Sin pagos';

  y += 16;
  sectionHeader('Resumen', y);
  y += 12;
  row('Estado de cuota', cuota, marginX, y);
  row(
    'Asistencia a clases',
    attendanceRate === null ? '—' : `${attendanceRate}%`,
    marginX + 65,
    y,
  );
  row(
    'Saldo de accesos',
    kioskRemaining?.remaining ?? '—',
    marginX + 130,
    y,
  );

  // ── Últimos pagos ───────────────────────────────────────────────
  const visiblePayments = payments.filter((p) => p?.status !== 'void').slice(0, 6);
  y += 18;
  sectionHeader('Últimos pagos', y);
  y += 11;

  if (visiblePayments.length === 0) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(10);
    pdf.setTextColor(...soft);
    pdf.text('Sin pagos registrados.', marginX, y);
  } else {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...soft);
    pdf.text('FECHA', marginX, y);
    pdf.text('CONCEPTO', marginX + 35, y);
    pdf.text('MONTO', marginX + 120, y);
    pdf.text('ESTADO', marginX + 155, y);
    y += 2;
    pdf.setDrawColor(220, 220, 220);
    pdf.line(marginX, y, pageWidth - marginX, y);
    y += 6;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    visiblePayments.forEach((p) => {
      if (y > pageHeight - 25) {
        pdf.addPage();
        y = 20;
      }
      pdf.setTextColor(...ink);
      pdf.text(formatDate(p.payment_date || p.date), marginX, y);
      const concept = (p.concept || p.description || 'Pago').substring(0, 42);
      pdf.text(concept, marginX + 35, y);
      pdf.text(formatCurrency(p.amount), marginX + 120, y);
      const paid = p.status === 'paid';
      pdf.setTextColor(paid ? 34 : 200, paid ? 160 : 60, paid ? 70 : 40);
      pdf.text(PAYMENT_LABELS[p.status] || p.status || '—', marginX + 155, y);
      y += 7;
    });
  }

  // ── Pie ─────────────────────────────────────────────────────────
  pdf.setFontSize(8);
  pdf.setTextColor(...soft);
  pdf.text(`Generado el ${new Date().toLocaleDateString('es-AR')}`, marginX, pageHeight - 10);
  pdf.text('VC Fit — Gestión del gimnasio', pageWidth - marginX, pageHeight - 10, {
    align: 'right',
  });

  const safeName = (athlete.name || 'atleta').replace(/\s+/g, '_');
  pdf.save(`Informe_${safeName}.pdf`);
};
