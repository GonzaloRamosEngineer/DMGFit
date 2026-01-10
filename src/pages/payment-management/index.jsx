import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import NavigationSidebar from '../../components/ui/NavigationSidebar';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import PaymentStatusFilter from './components/PaymentStatusFilter';
import DateRangeSelector from './components/DateRangeSelector';
import FinancialMetricCard from './components/FinancialMetricCard';
import RevenueChart from './components/RevenueChart';
import OverduePaymentsTable from './components/OverduePaymentsTable';
import PaymentMethodChart from './components/PaymentMethodChart';
import RecentTransactionsFeed from './components/RecentTransactionsFeed';
import AutomatedReminderControl from './components/AutomatedReminderControl';
import { generatePaymentReportPDF } from '../../utils/pdfExport';

const PaymentManagement = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedRange, setSelectedRange] = useState('thisMonth');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [reminderSettings, setReminderSettings] = useState({
    enabled: true,
    frequency: 'weekly',
    channels: ['email', 'sms']
  });

  const alertData = {
    dashboard: 3,
    atletas: 5,
    rendimiento: 2,
    pagos: 12
  };

  const filterCounts = {
    all: 156,
    current: 132,
    overdue: 12,
    pending: 12
  };

  const financialMetrics = [
  {
    title: 'Ingresos Mensuales',
    value: '45.280',
    currency: '€',
    trend: 'up',
    trendValue: '+12.5%',
    icon: 'TrendingUp',
    iconColor: 'bg-success/20 text-success'
  },
  {
    title: 'Tasa de Cobro',
    value: '94.2%',
    trend: 'up',
    trendValue: '+2.3%',
    icon: 'Target',
    iconColor: 'bg-primary/20 text-primary'
  },
  {
    title: 'Monto Vencido',
    value: '8.450',
    currency: '€',
    trend: 'down',
    trendValue: '-5.8%',
    icon: 'AlertCircle',
    iconColor: 'bg-error/20 text-error'
  },
  {
    title: 'Tiempo Promedio de Pago',
    value: '12.5',
    trend: 'down',
    trendValue: '-1.2 días',
    icon: 'Clock',
    iconColor: 'bg-warning/20 text-warning'
  }];


  const revenueData = [
  { month: 'Ene', efectivo: 12000, tarjeta: 18000, transferencia: 8000 },
  { month: 'Feb', efectivo: 13500, tarjeta: 19500, transferencia: 9000 },
  { month: 'Mar', efectivo: 11000, tarjeta: 21000, transferencia: 10000 },
  { month: 'Abr', efectivo: 14000, tarjeta: 22000, transferencia: 11000 },
  { month: 'May', efectivo: 15000, tarjeta: 20000, transferencia: 10500 },
  { month: 'Jun', efectivo: 13000, tarjeta: 23000, transferencia: 12000 }];


  const paymentMethodData = [
  { method: 'efectivo', name: 'Efectivo', value: 15000, percentage: 31 },
  { method: 'tarjeta', name: 'Tarjeta', value: 23000, percentage: 48 },
  { method: 'transferencia', name: 'Transferencia', value: 10000, percentage: 21 }];


  const overduePayments = [
  {
    id: 'PAY001',
    athleteName: 'Carlos Rodríguez',
    athleteId: 'ATH-2024-001',
    athleteImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1fa9e44fc-1763295892954.png",
    athleteImageAlt: 'Professional headshot of Hispanic male athlete with short dark hair wearing red athletic shirt',
    amountOwed: 450,
    invoiceCount: 3,
    daysOverdue: 45,
    lastContact: '15/12/2025',
    contactMethod: 'Email'
  },
  {
    id: 'PAY002',
    athleteName: 'María González',
    athleteId: 'ATH-2024-015',
    athleteImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1a7edc1be-1763301604436.png",
    athleteImageAlt: 'Professional headshot of Hispanic female athlete with long brown hair in ponytail wearing blue sports top',
    amountOwed: 300,
    invoiceCount: 2,
    daysOverdue: 32,
    lastContact: '22/12/2025',
    contactMethod: 'WhatsApp'
  },
  {
    id: 'PAY003',
    athleteName: 'Javier Martínez',
    athleteId: 'ATH-2024-023',
    athleteImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1fa9e44fc-1763295892954.png",
    athleteImageAlt: 'Professional headshot of Hispanic male athlete with beard and short black hair wearing gray athletic shirt',
    amountOwed: 600,
    invoiceCount: 4,
    daysOverdue: 28,
    lastContact: '28/12/2025',
    contactMethod: 'SMS'
  },
  {
    id: 'PAY004',
    athleteName: 'Ana López',
    athleteId: 'ATH-2024-034',
    athleteImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1a7edc1be-1763301604436.png",
    athleteImageAlt: 'Professional headshot of Hispanic female athlete with short brown hair wearing green sports top',
    amountOwed: 225,
    invoiceCount: 1,
    daysOverdue: 18,
    lastContact: '02/01/2026',
    contactMethod: 'Teléfono'
  },
  {
    id: 'PAY005',
    athleteName: 'Diego Fernández',
    athleteId: 'ATH-2024-042',
    athleteImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1fa9e44fc-1763295892954.png",
    athleteImageAlt: 'Professional headshot of Hispanic male athlete with curly black hair wearing black athletic shirt',
    amountOwed: 375,
    invoiceCount: 2,
    daysOverdue: 15,
    lastContact: '05/01/2026',
    contactMethod: 'Email'
  }];


  const recentTransactions = [
  {
    id: 'TXN001',
    athleteName: 'Laura Sánchez',
    athleteImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1d7334929-1763296602139.png",
    athleteImageAlt: 'Professional headshot of Hispanic female athlete with long dark hair wearing yellow sports top',
    description: 'Pago de mensualidad - Enero 2026',
    amount: 150,
    method: 'tarjeta',
    methodLabel: 'Tarjeta',
    timestamp: new Date(Date.now() - 300000)
  },
  {
    id: 'TXN002',
    athleteName: 'Roberto Díaz',
    athleteImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1fa9e44fc-1763295892954.png",
    athleteImageAlt: 'Professional headshot of Hispanic male athlete with short brown hair wearing white athletic shirt',
    description: 'Pago de sesiones personalizadas',
    amount: 280,
    method: 'transferencia',
    methodLabel: 'Transferencia',
    timestamp: new Date(Date.now() - 900000)
  },
  {
    id: 'TXN003',
    athleteName: 'Carmen Ruiz',
    athleteImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1a7edc1be-1763301604436.png",
    athleteImageAlt: 'Professional headshot of Hispanic female athlete with medium brown hair wearing purple sports top',
    description: 'Pago de plan trimestral',
    amount: 420,
    method: 'efectivo',
    methodLabel: 'Efectivo',
    timestamp: new Date(Date.now() - 1800000)
  },
  {
    id: 'TXN004',
    athleteName: 'Miguel Torres',
    athleteImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1fa9e44fc-1763295892954.png",
    athleteImageAlt: 'Professional headshot of Hispanic male athlete with short black hair and glasses wearing blue athletic shirt',
    description: 'Pago de mensualidad - Enero 2026',
    amount: 150,
    method: 'tarjeta',
    methodLabel: 'Tarjeta',
    timestamp: new Date(Date.now() - 3600000)
  },
  {
    id: 'TXN005',
    athleteName: 'Isabel Moreno',
    athleteImage: "https://img.rocket.new/generatedImages/rocket_gen_img_12273ff39-1763299263784.png",
    athleteImageAlt: 'Professional headshot of Hispanic female athlete with short blonde hair wearing red sports top',
    description: 'Pago de evaluación nutricional',
    amount: 95,
    method: 'transferencia',
    methodLabel: 'Transferencia',
    timestamp: new Date(Date.now() - 7200000)
  }];


  const handleSendReminder = (paymentIds) => {
    console.log('Sending reminders to:', paymentIds);
  };

  const handleScheduleCall = (paymentId) => {
    console.log('Scheduling call for:', paymentId);
  };

  const handleCreatePlan = (paymentId) => {
    console.log('Creating payment plan for:', paymentId);
  };

  const handleExportReport = async () => {
    try {
      const metrics = {
        monthlyRevenue: financialMetrics?.[0]?.value?.replace(/[^0-9]/g, '') || 0,
        collectionRate: parseFloat(financialMetrics?.[1]?.value) || 0,
        overdueAmount: financialMetrics?.[2]?.value?.replace(/[^0-9]/g, '') || 0,
        avgPaymentTime: parseFloat(financialMetrics?.[3]?.value) || 0
      };
      
      await generatePaymentReportPDF(
        overduePayments,
        metrics,
        revenueData
      );
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error al generar el reporte. Por favor, inténtalo de nuevo.');
    }
  };

  return (
    <>
      <Helmet>
        <title>Gestión de Pagos - DigitalMatch Fitness Dashboard</title>
        <meta name="description" content="Comprehensive payment management and financial analytics for elite fitness training facilities" />
      </Helmet>
      <div className="min-h-screen bg-background">
        <NavigationSidebar
          isCollapsed={sidebarCollapsed}
          userRole="coach"
          alertData={alertData} />


        <main className={`transition-smooth ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-60'}`}>
          <div className="p-4 md:p-6 lg:p-8">
            <BreadcrumbTrail currentPath="/payment-management" />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold text-foreground mb-2">
                  Gestión de Pagos
                </h1>
                <p className="text-sm md:text-base text-muted-foreground">
                  Control financiero y análisis de cobros
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="default" onClick={handleExportReport}>
                  <Icon name="Download" size={18} className="mr-2" />
                  Exportar Reporte
                </Button>
                <Button variant="default" size="default">
                  <Icon name="Plus" size={18} className="mr-2" />
                  Registrar Pago
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 mb-6">
              <div className="lg:col-span-8 space-y-4">
                <PaymentStatusFilter
                  activeFilter={activeFilter}
                  onFilterChange={setActiveFilter}
                  counts={filterCounts} />

              </div>
              <div className="lg:col-span-4">
                <DateRangeSelector
                  selectedRange={selectedRange}
                  onRangeChange={setSelectedRange}
                  customDates={customDates}
                  onCustomDatesChange={setCustomDates} />

              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
              {financialMetrics?.map((metric, index) =>
              <FinancialMetricCard key={index} {...metric} />
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 mb-6">
              <div className="lg:col-span-8">
                <RevenueChart data={revenueData} paymentMethodData={paymentMethodData} />
              </div>
              <div className="lg:col-span-4 space-y-4 md:space-y-6">
                <PaymentMethodChart data={paymentMethodData} />
                <AutomatedReminderControl
                  settings={reminderSettings}
                  onSettingsChange={setReminderSettings} />

              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
              <div className="lg:col-span-8">
                <OverduePaymentsTable
                  payments={overduePayments}
                  onSendReminder={handleSendReminder}
                  onScheduleCall={handleScheduleCall}
                  onCreatePlan={handleCreatePlan} />

              </div>
              <div className="lg:col-span-4">
                <RecentTransactionsFeed transactions={recentTransactions} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </>);

};

export default PaymentManagement;