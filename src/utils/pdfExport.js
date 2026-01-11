import jsPDF from 'jspdf';


export const generateAthletePDF = async (athleteData, performanceData, attendanceData, paymentData, notesData) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf?.internal?.pageSize?.getWidth();
  const pageHeight = pdf?.internal?.pageSize?.getHeight();
  let yPosition = 20;

  // Header
  pdf?.setFillColor(255, 68, 68);
  pdf?.rect(0, 0, pageWidth, 30, 'F');
  pdf?.setTextColor(255, 255, 255);
  pdf?.setFontSize(24);
  pdf?.setFont('helvetica', 'bold');
  pdf?.text('DigitalMatch', 15, 15);
  pdf?.setFontSize(12);
  pdf?.text('Perfil del Atleta', 15, 22);

  // Athlete Info
  yPosition = 40;
  pdf?.setTextColor(0, 0, 0);
  pdf?.setFontSize(18);
  pdf?.setFont('helvetica', 'bold');
  pdf?.text(athleteData?.name || 'Atleta', 15, yPosition);
  
  yPosition += 8;
  pdf?.setFontSize(10);
  pdf?.setFont('helvetica', 'normal');
  pdf?.text(`Email: ${athleteData?.email || 'N/A'}`, 15, yPosition);
  yPosition += 6;
  pdf?.text(`Teléfono: ${athleteData?.phone || 'N/A'}`, 15, yPosition);
  yPosition += 6;
  pdf?.text(`Fecha de Ingreso: ${athleteData?.joinDate || 'N/A'}`, 15, yPosition);
  yPosition += 6;
  pdf?.text(`Membresía: ${athleteData?.membershipType || 'N/A'}`, 15, yPosition);

  // Metrics Section
  yPosition += 15;
  pdf?.setFillColor(28, 28, 30);
  pdf?.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
  pdf?.setTextColor(255, 255, 255);
  pdf?.setFontSize(14);
  pdf?.setFont('helvetica', 'bold');
  pdf?.text('Métricas de Rendimiento', 20, yPosition);

  yPosition += 10;
  pdf?.setTextColor(0, 0, 0);
  pdf?.setFontSize(10);
  pdf?.setFont('helvetica', 'normal');
  
  const metrics = [
    { label: 'Asistencia', value: `${attendanceData?.stats?.rate || 0}%` },
    { label: 'Rendimiento', value: `${performanceData?.[performanceData?.length - 1]?.fuerza || 0}/100` },
    { label: 'Sesiones Completadas', value: `${attendanceData?.stats?.present || 0}` },
    { label: 'Estado de Pago', value: paymentData?.[0]?.status === 'paid' ? 'Al día' : 'Pendiente' }
  ];

  metrics?.forEach((metric, index) => {
    const xPos = 15 + (index % 2) * 90;
    const yPos = yPosition + Math.floor(index / 2) * 10;
    pdf?.text(`${metric?.label}: ${metric?.value}`, xPos, yPos);
  });

  // Payment History
  yPosition += 30;
  pdf?.setFillColor(28, 28, 30);
  pdf?.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
  pdf?.setTextColor(255, 255, 255);
  pdf?.setFontSize(14);
  pdf?.setFont('helvetica', 'bold');
  pdf?.text('Historial de Pagos', 20, yPosition);

  yPosition += 10;
  pdf?.setTextColor(0, 0, 0);
  pdf?.setFontSize(9);
  pdf?.setFont('helvetica', 'bold');
  pdf?.text('Fecha', 15, yPosition);
  pdf?.text('Concepto', 50, yPosition);
  pdf?.text('Monto', 130, yPosition);
  pdf?.text('Estado', 160, yPosition);

  yPosition += 5;
  pdf?.setFont('helvetica', 'normal');
  paymentData?.slice(0, 5)?.forEach((payment) => {
    pdf?.text(payment?.date || '', 15, yPosition);
    pdf?.text(payment?.concept?.substring(0, 30) || '', 50, yPosition);
    pdf?.text(`$${payment?.amount || 0}`, 130, yPosition);
    pdf?.setTextColor(payment?.status === 'paid' ? 48 : 255, payment?.status === 'paid' ? 209 : 69, payment?.status === 'paid' ? 88 : 68);
    pdf?.text(payment?.status === 'paid' ? 'Pagado' : 'Pendiente', 160, yPosition);
    pdf?.setTextColor(0, 0, 0);
    yPosition += 6;
  });

  // Coach Notes
  if (notesData && notesData?.length > 0) {
    yPosition += 10;
    pdf?.setFillColor(28, 28, 30);
    pdf?.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
    pdf?.setTextColor(255, 255, 255);
    pdf?.setFontSize(14);
    pdf?.setFont('helvetica', 'bold');
    pdf?.text('Notas del Entrenador', 20, yPosition);

    yPosition += 10;
    pdf?.setTextColor(0, 0, 0);
    pdf?.setFontSize(9);
    pdf?.setFont('helvetica', 'normal');
    
    notesData?.slice(0, 3)?.forEach((note) => {
      if (yPosition > pageHeight - 30) {
        pdf?.addPage();
        yPosition = 20;
      }
      pdf?.text(`${note?.date || ''} - ${note?.author || ''}:`, 15, yPosition);
      yPosition += 5;
      const splitText = pdf?.splitTextToSize(note?.content || '', pageWidth - 30);
      pdf?.text(splitText, 15, yPosition);
      yPosition += splitText?.length * 5 + 5;
    });
  }

  // Footer
  pdf?.setFontSize(8);
  pdf?.setTextColor(128, 128, 128);
  pdf?.text(`Generado el ${new Date()?.toLocaleDateString('es-ES')}`, 15, pageHeight - 10);
  pdf?.text('DigitalMatch - Plataforma de Gestión Deportiva', pageWidth - 80, pageHeight - 10);

  pdf?.save(`Atleta_${athleteData?.name?.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
};

export const generatePaymentReportPDF = async (overduePayments, metrics, revenueData) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf?.internal?.pageSize?.getWidth();
  const pageHeight = pdf?.internal?.pageSize?.getHeight();
  let yPosition = 20;

  // Header
  pdf?.setFillColor(255, 68, 68);
  pdf?.rect(0, 0, pageWidth, 30, 'F');
  pdf?.setTextColor(255, 255, 255);
  pdf?.setFontSize(24);
  pdf?.setFont('helvetica', 'bold');
  pdf?.text('DigitalMatch', 15, 15);
  pdf?.setFontSize(12);
  pdf?.text('Reporte de Pagos', 15, 22);

  // Financial Metrics
  yPosition = 40;
  pdf?.setTextColor(0, 0, 0);
  pdf?.setFontSize(16);
  pdf?.setFont('helvetica', 'bold');
  pdf?.text('Resumen Financiero', 15, yPosition);

  yPosition += 10;
  pdf?.setFontSize(10);
  pdf?.setFont('helvetica', 'normal');
  
  const metricsData = [
    { label: 'Ingresos Mensuales', value: `$${metrics?.monthlyRevenue || 0}` },
    { label: 'Tasa de Cobro', value: `${metrics?.collectionRate || 0}%` },
    { label: 'Monto Vencido', value: `$${metrics?.overdueAmount || 0}` },
    { label: 'Tiempo Promedio de Pago', value: `${metrics?.avgPaymentTime || 0} días` }
  ];

  metricsData?.forEach((metric, index) => {
    const xPos = 15 + (index % 2) * 90;
    const yPos = yPosition + Math.floor(index / 2) * 10;
    pdf?.text(`${metric?.label}: ${metric?.value}`, xPos, yPos);
  });

  // Overdue Payments Table
  yPosition += 30;
  pdf?.setFillColor(28, 28, 30);
  pdf?.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
  pdf?.setTextColor(255, 255, 255);
  pdf?.setFontSize(14);
  pdf?.setFont('helvetica', 'bold');
  pdf?.text('Pagos Vencidos', 20, yPosition);

  yPosition += 10;
  pdf?.setTextColor(0, 0, 0);
  pdf?.setFontSize(9);
  pdf?.setFont('helvetica', 'bold');
  pdf?.text('Atleta', 15, yPosition);
  pdf?.text('Monto', 80, yPosition);
  pdf?.text('Días Vencido', 110, yPosition);
  pdf?.text('Último Contacto', 145, yPosition);

  yPosition += 5;
  pdf?.setFont('helvetica', 'normal');
  overduePayments?.forEach((payment) => {
    if (yPosition > pageHeight - 30) {
      pdf?.addPage();
      yPosition = 20;
    }
    pdf?.text(payment?.athleteName?.substring(0, 25) || '', 15, yPosition);
    pdf?.text(`$${payment?.amountOwed || 0}`, 80, yPosition);
    pdf?.setTextColor(255, 69, 68);
    pdf?.text(`${payment?.daysOverdue || 0} días`, 110, yPosition);
    pdf?.setTextColor(0, 0, 0);
    pdf?.text(payment?.lastContact || '', 145, yPosition);
    yPosition += 6;
  });

  // Footer
  pdf?.setFontSize(8);
  pdf?.setTextColor(128, 128, 128);
  pdf?.text(`Generado el ${new Date()?.toLocaleDateString('es-ES')}`, 15, pageHeight - 10);
  pdf?.text('DigitalMatch - Plataforma de Gestión Deportiva', pageWidth - 80, pageHeight - 10);

  pdf?.save(`Reporte_Pagos_${Date.now()}.pdf`);
};

export const generateDashboardSummaryPDF = async (kpiData, alertsData, chartData) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf?.internal?.pageSize?.getWidth();
  const pageHeight = pdf?.internal?.pageSize?.getHeight();
  let yPosition = 20;

  // Header
  pdf?.setFillColor(255, 68, 68);
  pdf?.rect(0, 0, pageWidth, 30, 'F');
  pdf?.setTextColor(255, 255, 255);
  pdf?.setFontSize(24);
  pdf?.setFont('helvetica', 'bold');
  pdf?.text('DigitalMatch', 15, 15);
  pdf?.setFontSize(12);
  pdf?.text('Resumen Mensual del Dashboard', 15, 22);

  // KPIs
  yPosition = 40;
  pdf?.setTextColor(0, 0, 0);
  pdf?.setFontSize(16);
  pdf?.setFont('helvetica', 'bold');
  pdf?.text('Indicadores Clave de Rendimiento', 15, yPosition);

  yPosition += 10;
  pdf?.setFontSize(10);
  pdf?.setFont('helvetica', 'normal');
  
  kpiData?.forEach((kpi, index) => {
    const xPos = 15 + (index % 2) * 90;
    const yPos = yPosition + Math.floor(index / 2) * 15;
    pdf?.setFont('helvetica', 'bold');
    pdf?.text(kpi?.title || '', xPos, yPos);
    pdf?.setFont('helvetica', 'normal');
    pdf?.text(`${kpi?.value || ''} ${kpi?.subtitle || ''}`, xPos, yPos + 5);
    pdf?.setTextColor(kpi?.trend === 'up' ? 48 : 255, kpi?.trend === 'up' ? 209 : 69, 68);
    pdf?.text(kpi?.trendValue || '', xPos, yPos + 10);
    pdf?.setTextColor(0, 0, 0);
  });

  // Alerts
  yPosition += Math.ceil(kpiData?.length / 2) * 15 + 10;
  pdf?.setFillColor(28, 28, 30);
  pdf?.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
  pdf?.setTextColor(255, 255, 255);
  pdf?.setFontSize(14);
  pdf?.setFont('helvetica', 'bold');
  pdf?.text('Alertas Críticas', 20, yPosition);

  yPosition += 10;
  pdf?.setTextColor(0, 0, 0);
  pdf?.setFontSize(9);
  pdf?.setFont('helvetica', 'normal');
  
  alertsData?.filter(a => a?.severity === 'critical')?.slice(0, 5)?.forEach((alert) => {
    if (yPosition > pageHeight - 30) {
      pdf?.addPage();
      yPosition = 20;
    }
    pdf?.setFont('helvetica', 'bold');
    pdf?.text(alert?.title || '', 15, yPosition);
    pdf?.setFont('helvetica', 'normal');
    yPosition += 5;
    const splitText = pdf?.splitTextToSize(alert?.description || '', pageWidth - 30);
    pdf?.text(splitText, 15, yPosition);
    yPosition += splitText?.length * 5 + 5;
  });

  // Footer
  pdf?.setFontSize(8);
  pdf?.setTextColor(128, 128, 128);
  pdf?.text(`Generado el ${new Date()?.toLocaleDateString('es-ES')}`, 15, pageHeight - 10);
  pdf?.text('DigitalMatch - Plataforma de Gestión Deportiva', pageWidth - 80, pageHeight - 10);

  pdf?.save(`Dashboard_Resumen_${Date.now()}.pdf`);
};