import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';

// Componentes UI
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';

// Componentes del Dashboard
import DashboardHeader from './components/DashboardHeader';
import KPICard from './components/KPICard';
import AlertFeed from './components/AlertFeed';
import SessionSummaryGrid from './components/SessionSummaryGrid';

const MainDashboard = () => {
  const navigate = useNavigate();

  // Estados de UI
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // Estados de Datos
  const [kpiStats, setKpiStats] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [sessions, setSessions] = useState([]);

  const getLocalDateString = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getDateOnlyString = (dateLike) => {
    if (!dateLike) return null;

    if (typeof dateLike === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateLike)) {
      return dateLike;
    }

    const dt = new Date(dateLike);
    if (Number.isNaN(dt.getTime())) return null;
    return getLocalDateString(dt);
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const now = new Date();
      const today = getLocalDateString(now);

      const [
        { count: activeAthletes },
        { count: totalAthletes },
        { data: paymentsRaw },
        { data: todayAccessLogs },
        { data: todayAttendance },
        { data: todaysSessions },
      ] = await Promise.all([
        supabase.from('athletes').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('athletes').select('*', { count: 'exact', head: true }),
        supabase.from('payments').select('id, amount, status, payment_date, athletes ( profiles ( full_name ) )').neq('status', 'paid'),
        supabase
          .from('access_logs')
          .select('id, check_in_time, access_granted, reason_code, rejection_reason, athletes ( profiles ( full_name ) ), coaches ( profiles ( full_name ) )')
          .eq('local_checkin_date', today)
          .order('check_in_time', { ascending: false }),
        supabase.from('attendance').select('session_id').eq('date', today).eq('status', 'present'),
        supabase.from('sessions').select(`
          id, time, capacity, status, type,
          plans ( name ),
          coaches ( profiles ( full_name, avatar_url ) )
        `).eq('session_date', today).order('time', { ascending: true }),
      ]);

      const parsedPayments = (paymentsRaw || []).map((payment) => {
        const paymentDateOnly = getDateOnlyString(payment.payment_date);
        const isOverdue = Boolean(paymentDateOnly && paymentDateOnly < today);
        const dueToday = Boolean(paymentDateOnly && paymentDateOnly === today);

        return {
          ...payment,
          paymentDateOnly,
          isOverdue,
          dueToday,
          athleteName: payment.athletes?.profiles?.full_name || 'Atleta Desconocido',
        };
      });

      const overduePayments = parsedPayments.filter((payment) => payment.isOverdue);
      const dueTodayPayments = parsedPayments.filter((payment) => payment.dueToday);
      const overdueAmount = overduePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const accessLogs = todayAccessLogs || [];
      const grantedCount = accessLogs.filter((log) => log.access_granted).length;
      const deniedLogs = accessLogs.filter((log) => !log.access_granted);
      const deniedCount = deniedLogs.length;

      const warningCount = null;

      setKpiStats([
        {
          title: 'Atletas Activos',
          value: activeAthletes || 0,
          trend: 'neutral',
          trendValue: '',
          icon: 'Users',
          threshold: 'green',
          subtitle: `De ${totalAthletes || 0} totales`,
        },
        {
          title: 'Accesos Hoy',
          value: grantedCount,
          trend: deniedCount > 0 ? 'down' : 'neutral',
          trendValue: deniedCount > 0 ? `${deniedCount} denegados` : 'Sin denegados',
          icon: 'DoorOpen',
          threshold: deniedCount > 0 ? 'yellow' : 'green',
          subtitle: warningCount !== null
            ? `${warningCount} warnings`
            : 'Basado en access_logs',
        },
        {
          title: 'Pagos Vencidos',
          value: overduePayments.length,
          trend: overduePayments.length > 0 ? 'down' : 'neutral',
          trendValue: dueTodayPayments.length > 0 ? `${dueTodayPayments.length} vencen hoy` : 'Sin vencimientos hoy',
          icon: 'CreditCard',
          threshold: overduePayments.length > 0 ? 'red' : dueTodayPayments.length > 0 ? 'yellow' : 'green',
          subtitle: `$${overdueAmount.toLocaleString('es-AR')} vencido`,
        },
        {
          title: 'Sesiones Hoy',
          value: todaysSessions?.length || 0,
          trend: 'neutral',
          trendValue: 'Planificación diaria',
          icon: 'Calendar',
          threshold: 'green',
          subtitle: 'Agenda operativa',
        },
      ]);

      const paymentAlerts = overduePayments.slice(0, 5).map((payment) => ({
        id: `pay-${payment.id}`,
        severity: 'critical',
        title: 'Pago Vencido',
        description: `El pago de $${Number(payment.amount || 0).toLocaleString('es-AR')} venció el ${payment.payment_date || 'fecha no informada'}.`,
        athleteName: payment.athleteName,
        timestamp: payment.payment_date ? new Date(payment.payment_date) : new Date(),
        actionable: true,
        actionLabel: 'Ir a Cobros',
        target: '/payment-management',
      }));

      const accessAlerts = deniedLogs.slice(0, 5).map((log) => {
        const coachName = log.coaches?.profiles?.full_name;
        const athleteName = log.athletes?.profiles?.full_name;
        return {
          id: `acc-${log.id}`,
          severity: 'warning',
          title: 'Acceso denegado',
          description: log.reason_code || log.rejection_reason || 'Sin motivo informado',
          athleteName: coachName || athleteName || 'Usuario sin identificar',
          timestamp: log.check_in_time ? new Date(log.check_in_time) : new Date(),
          actionable: true,
          actionLabel: 'Ver Historial',
          target: '/access-history',
        };
      });

      const generatedAlerts = [...paymentAlerts, ...accessAlerts]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);

      if (generatedAlerts.length === 0) {
        generatedAlerts.push({
          id: 'sys-ok',
          severity: 'info',
          title: 'Operación al día',
          description: 'No hay alertas críticas de cobros ni accesos en este momento.',
          timestamp: new Date(),
          actionable: false,
        });
      }

      setAlerts(generatedAlerts);

      const formattedSessions = (todaysSessions || []).map((session) => {
        const attendanceCount = (todayAttendance || []).filter(
          (record) => record.session_id === session.id,
        ).length;

        return {
          id: session.id,
          time: session.time || '00:00',
          coachName: session.coaches?.profiles?.full_name || 'Por asignar',
          coachAvatar: session.coaches?.profiles?.avatar_url,
          program: session.plans?.name || session.type || 'Entrenamiento',
          attendanceCount,
          capacity: session.capacity || 20,
          status: session.status || 'scheduled',
        };
      });

      setSessions(formattedSessions);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchData, 30000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleRefreshToggle = () => setAutoRefresh((prev) => !prev);

  const handleAlertAction = (alertId, action) => {
    if (action !== 'view') return;
    const alert = alerts.find((item) => item.id === alertId);
    if (alert?.target) navigate(alert.target);
  };

  return (
    <>
      <Helmet>
        <title>Dashboard Operativo - DMG Fitness</title>
      </Helmet>

      <div className="min-h-screen bg-[#F8FAFC] py-6 md:py-8 pb-24">
        <div className="w-full space-y-6 md:space-y-8">
          <div>
            <BreadcrumbTrail currentPath="/main-dashboard" />
            <DashboardHeader
              onRefreshToggle={handleRefreshToggle}
              autoRefresh={autoRefresh}
              lastUpdated={lastUpdated}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {loading
              ? [1, 2, 3, 4].map((i) => <KPICard key={i} loading={true} />)
              : kpiStats.map((kpi, index) => <KPICard key={index} {...kpi} />)}
          </div>

          <div className="w-full">
            <AlertFeed alerts={alerts} loading={loading} onActionClick={handleAlertAction} />
          </div>

          <div className="w-full">
            <SessionSummaryGrid sessions={sessions} loading={loading} />
          </div>
        </div>
      </div>
    </>
  );
};

export default MainDashboard;
