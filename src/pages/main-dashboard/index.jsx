import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';

// Componentes del Dashboard
import DashboardHeader from './components/DashboardHeader';
import StatCard from '../../components/ui/StatCard';
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

  const fetchData = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);

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
        supabase.from('payments').select('id, amount, status, payment_date, athletes ( profiles ( full_name ) )').eq('status', 'pending'),
        supabase
          .from('access_logs')
          .select('id, check_in_time, access_granted, reason_code, rejection_reason, coach_id, athletes ( profiles ( full_name ) ), coaches ( profiles ( full_name ) )')
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
      // El kiosco registra atletas y profesores en la misma tabla: acá los separamos.
      const athleteEntriesCount = accessLogs.filter((log) => log.access_granted && !log.coach_id).length;
      const deniedLogs = accessLogs.filter((log) => !log.access_granted);
      const deniedCount = deniedLogs.length;
      const coachesTodayCount = new Set(
        accessLogs.filter((log) => log.access_granted && log.coach_id).map((log) => log.coach_id),
      ).size;

      setKpiStats([
        {
          label: 'Atletas activos',
          value: activeAthletes || 0,
          subtitle: `De ${totalAthletes || 0} en total`,
          icon: 'Users',
          tone: 'neutral',
          info: 'Socios con la membresía activa: son los que hoy pueden entrar al gimnasio.',
        },
        {
          label: 'Accesos hoy',
          value: athleteEntriesCount,
          subtitle: deniedCount > 0
            ? `${deniedCount} ${deniedCount === 1 ? 'rechazado' : 'rechazados'}`
            : 'Sin rechazos',
          icon: 'DoorOpen',
          tone: deniedCount > 0 ? 'warning' : 'neutral',
          info: 'Atletas que entraron hoy marcando su DNI en la pantalla de acceso. Un rechazo es alguien que el sistema no dejó pasar (por ejemplo, por cuota vencida).',
        },
        {
          label: 'Pagos vencidos',
          value: overduePayments.length,
          subtitle: overduePayments.length > 0
            ? `$${overdueAmount.toLocaleString('es-AR')} a cobrar`
            : dueTodayPayments.length > 0
              ? `${dueTodayPayments.length} vencen hoy`
              : 'Sin cuotas vencidas',
          icon: 'CreditCard',
          tone: overduePayments.length > 0 ? 'danger' : dueTodayPayments.length > 0 ? 'warning' : 'success',
          info: 'Cuotas que ya pasaron su fecha de pago y todavía no se cobraron. El monto es el total que hay para reclamar.',
        },
        {
          label: 'Profesores hoy',
          value: coachesTodayCount,
          subtitle: 'Ficharon su entrada',
          icon: 'UserCheck',
          tone: 'neutral',
          info: 'Profesores que marcaron su entrada de hoy en la pantalla de acceso.',
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
      if (!silent) setLoading(false);
    }
  };

  // Ref al último fetchData para que la suscripción Realtime use el estado vigente.
  const fetchDataRef = useRef(fetchData);
  useEffect(() => {
    fetchDataRef.current = fetchData;
  });

  useEffect(() => {
    fetchData();

    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchData, 30000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Realtime: refresca "Accesos Hoy" y alertas cuando el kiosco registra un acceso.
  useEffect(() => {
    let debounce;
    const channel = supabase
      .channel('dashboard-access-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'access_logs' },
        () => {
          clearTimeout(debounce);
          debounce = setTimeout(() => fetchDataRef.current?.({ silent: true }), 400);
        },
      )
      .subscribe();

    return () => {
      clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRefreshToggle = () => setAutoRefresh((prev) => !prev);

  const handleAlertAction = (alertId, action) => {
    if (action !== 'view') return;
    const alert = alerts.find((item) => item.id === alertId);
    if (alert?.target) navigate(alert.target);
  };

  return (
    <>
      <Helmet>
        <title>Dashboard Operativo - VC Fit</title>
      </Helmet>

      <div className="flex flex-col gap-4 lg:gap-5 lg:h-[calc(100vh-4rem)]">
        <DashboardHeader
          onRefreshToggle={handleRefreshToggle}
          autoRefresh={autoRefresh}
          lastUpdated={lastUpdated}
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 shrink-0">
          {loading
            ? [1, 2, 3, 4].map((i) => <StatCard key={i} loading={true} />)
            : kpiStats.map((kpi, index) => <StatCard key={index} {...kpi} />)}
        </div>

        {/* Fila inferior: Agenda (ancha) + Notificaciones (angosta), llena el alto restante */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 lg:flex-1 lg:min-h-0">
          <div className="lg:col-span-2 lg:min-h-0">
            <SessionSummaryGrid sessions={sessions} loading={loading} />
          </div>
          <div className="lg:col-span-1 lg:min-h-0">
            <AlertFeed alerts={alerts} loading={loading} onActionClick={handleAlertAction} />
          </div>
        </div>
      </div>
    </>
  );
};

export default MainDashboard;
