import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import { useAuth } from '../../contexts/AuthContext';
import { 
  generateAthletePDF, 
  generatePaymentReportPDF, 
  generateDashboardSummaryPDF 
} from '../../utils/pdfExport';
import ReportTemplateCard from './components/ReportTemplateCard';
import ExportHistoryCard from './components/ExportHistoryCard';

const PDFExportCenter = () => {
  const { currentUser } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [isGenerating, setIsGenerating] = useState(false);

  const breadcrumbItems = [
    { label: 'Centro de Exportación PDF', path: '/pdf-export-center', active: true }
  ];

  const reportTemplates = [
    {
      id: 'athlete-profile',
      name: 'Perfil de Atleta',
      description: 'Reporte completo con evolución, asistencia, pagos y notas del entrenador',
      icon: 'User',
      color: 'primary',
      roles: ['admin', 'profesor'],
      fields: ['Datos personales', 'Métricas de rendimiento', 'Historial de asistencia', 'Estado de pagos', 'Notas del entrenador']
    },
    {
      id: 'payment-report',
      name: 'Reporte de Pagos',
      description: 'Resumen financiero con pagos vencidos y estadísticas de cobro',
      icon: 'CreditCard',
      color: 'warning',
      roles: ['admin'],
      fields: ['Métricas financieras', 'Pagos vencidos', 'Historial de transacciones', 'Tasa de cobro']
    },
    {
      id: 'dashboard-summary',
      name: 'Resumen Mensual',
      description: 'KPIs principales, alertas y resumen de rendimiento del mes',
      icon: 'LayoutDashboard',
      color: 'accent',
      roles: ['admin', 'profesor'],
      fields: ['KPIs principales', 'Alertas activas', 'Gráficos de tendencias', 'Resumen de sesiones']
    },
    {
      id: 'performance-analytics',
      name: 'Análisis de Rendimiento',
      description: 'Reporte detallado de métricas y evolución de atletas',
      icon: 'TrendingUp',
      color: 'success',
      roles: ['admin', 'profesor'],
      fields: ['Métricas por atleta', 'Comparativas', 'Evolución temporal', 'Rankings']
    },
    {
      id: 'attendance-report',
      name: 'Reporte de Asistencia',
      description: 'Estadísticas de asistencia por atleta y por sesión',
      icon: 'Calendar',
      color: 'secondary',
      roles: ['admin', 'profesor'],
      fields: ['Tasas de asistencia', 'Ausencias', 'Tendencias', 'Alertas de inasistencia']
    },
    {
      id: 'plan-summary',
      name: 'Resumen de Planes',
      description: 'Ocupación, ingresos y estadísticas por plan de entrenamiento',
      icon: 'Package',
      color: 'primary',
      roles: ['admin'],
      fields: ['Ocupación por plan', 'Ingresos generados', 'Atletas inscritos', 'Profesores asignados']
    }
  ];

  const exportHistory = [
    {
      id: 'EXP-001',
      template: 'Perfil de Atleta',
      fileName: 'Atleta_Carlos_Rodriguez_2026-01-10.pdf',
      date: '2026-01-10 14:30',
      size: '2.4 MB',
      status: 'completed'
    },
    {
      id: 'EXP-002',
      template: 'Reporte de Pagos',
      fileName: 'Reporte_Pagos_2026-01-10.pdf',
      date: '2026-01-10 12:15',
      size: '1.8 MB',
      status: 'completed'
    },
    {
      id: 'EXP-003',
      template: 'Resumen Mensual',
      fileName: 'Dashboard_Summary_2026-01-09.pdf',
      date: '2026-01-09 18:45',
      size: '3.1 MB',
      status: 'completed'
    }
  ];

  const filteredTemplates = reportTemplates?.filter(template =>
    template?.roles?.includes(currentUser?.role)
  );

  const handleGeneratePDF = async (templateId) => {
    setIsGenerating(true);
    setSelectedTemplate(templateId);

    setTimeout(async () => {
      try {
        switch (templateId) {
          case 'athlete-profile':
            await generateAthletePDF(
              { 
                name: 'Carlos Rodríguez', 
                email: 'carlos@email.com', 
                phone: '+34 612 345 678', 
                joinDate: '15/03/2024', 
                membershipType: 'premium' 
              },
              [{ date: 'Ene', fuerza: 65, resistencia: 70, tecnica: 68 }],
              { stats: { rate: 92, present: 48 } },
              [{ date: '2026-01-01', amount: 150, status: 'paid', concept: 'Mensualidad' }],
              [{ date: '2026-01-08', author: 'Ana García', content: 'Excelente progreso' }]
            );
            break;
          case 'payment-report':
            await generatePaymentReportPDF(
              [{ athleteName: 'Juan Pérez', amountOwed: 150, daysOverdue: 15, lastContact: '2026-01-05' }],
              { monthlyRevenue: 45280, collectionRate: 94.2, overdueAmount: 8450, avgPaymentTime: 12.5 },
              []
            );
            break;
          case 'dashboard-summary':
            await generateDashboardSummaryPDF(
              [{ title: 'Atletas Activos', value: '487', trend: 'up', trendValue: '+12.5%', subtitle: 'De 520 totales' }],
              [],
              []
            );
            break;
          default:
            alert(`Generando reporte: ${templateId}`);
        }
      } catch (error) {
        console.error('Error generando PDF:', error);
        alert('Error al generar el PDF');
      } finally {
        setIsGenerating(false);
        setSelectedTemplate(null);
      }
    }, 1000);
  };

  return (
    <>
      <Helmet>
        <title>Centro de Exportación PDF - VC Fit</title>
      </Helmet>
      
      {/* REMOVED NavigationSidebar - ya está en AppLayout */}
      <div className="p-4 md:p-6 lg:p-8 w-full">
        <div className="max-w-7xl mx-auto">
          <BreadcrumbTrail items={breadcrumbItems} />
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold text-foreground mb-2">
                Centro de Exportación PDF
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Genera reportes profesionales con datos actualizados
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={dateRange?.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e?.target?.value }))}
                className="h-10 px-4 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-smooth"
                placeholder="Desde"
              />
              <span className="text-muted-foreground">-</span>
              <input
                type="date"
                value={dateRange?.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e?.target?.value }))}
                className="h-10 px-4 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-smooth"
                placeholder="Hasta"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h2 className="text-xl font-heading font-semibold text-foreground mb-4">
                  Plantillas de Reportes
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTemplates?.map((template) => (
                    <ReportTemplateCard
                      key={template?.id}
                      template={template}
                      isGenerating={isGenerating && selectedTemplate === template?.id}
                      onGenerate={handleGeneratePDF}
                    />
                  ))}
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="text-lg font-heading font-semibold text-foreground mb-4">
                  Opciones de Exportación
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-foreground">Formato</span>
                    </div>
                    <select className="w-full h-10 px-4 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-smooth">
                      <option value="pdf">PDF</option>
                      <option value="excel">Excel (próximamente)</option>
                      <option value="csv">CSV (próximamente)</option>
                    </select>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-foreground">Tema</span>
                    </div>
                    <select className="w-full h-10 px-4 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-smooth">
                      <option value="dark">Oscuro (VC Fit)</option>
                      <option value="light">Claro</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <ExportHistoryCard history={exportHistory} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PDFExportCenter;