import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Helmet } from 'react-helmet';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Icon from '../../components/AppIcon';
import { kioskReasonMessages } from '../../data/kioskReasonMessages';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Badge } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

const AccessHistory = () => {
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const getLocalDateString = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getTodayString = () => getLocalDateString(new Date());

  const getPastDateString = (daysAgo) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return getLocalDateString(date);
  };

  const [dateRange, setDateRange] = useState({
    start: getPastDateString(30),
    end: getTodayString()
  });

  const [selectedDate, setSelectedDate] = useState(getTodayString());

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('access_logs')
        .select(`
          id, check_in_time, access_granted, rejection_reason, reason_code, weekly_schedule_id, remaining_sessions,
          athletes (
            id,
            profiles (full_name, email)
          ),
          coaches (
            id,
            profiles (full_name, email)
          )
        `)
        .gte('check_in_time', `${dateRange.start}T00:00:00`)
        .lte('check_in_time', `${dateRange.end}T23:59:59`)
        .order('check_in_time', { ascending: false });

      if (error) throw error;

      const normalizedLogs = (data || []).map((log) => {
        const athleteProfile = log?.athletes?.profiles;
        const coachProfile = log?.coaches?.profiles;
        const actorType = coachProfile ? 'Profesor' : 'Atleta';
        const actorName = coachProfile?.full_name || athleteProfile?.full_name || 'Sin nombre';
        return { ...log, actorType, actorName };
      });

      setAllLogs(normalizedLogs);

      if (data && data.length > 0) {
        const mostRecentDate = getLocalDateString(new Date(data[0].check_in_time));
        setSelectedDate(mostRecentDate);
      }
    } catch (err) {
      console.error("Error obteniendo logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groupedLogs = useMemo(() => {
    const groups = {};
    allLogs.forEach(log => {
      const dateObj = new Date(log.check_in_time);
      const dateStr = getLocalDateString(dateObj);
      if (!groups[dateStr]) {
        groups[dateStr] = { date: dateStr, total: 0, granted: 0, denied: 0, logs: [] };
      }
      groups[dateStr].total++;
      if (log.access_granted) groups[dateStr].granted++;
      else groups[dateStr].denied++;
      groups[dateStr].logs.push(log);
    });
    return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [allLogs]);

  const displayLogs = useMemo(() => {
    const group = groupedLogs.find(g => g.date === selectedDate);
    return group ? group.logs : [];
  }, [groupedLogs, selectedDate]);

  const selectedDayStats = useMemo(() => {
    const group = groupedLogs.find(g => g.date === selectedDate);
    return group || { total: 0, granted: 0, denied: 0 };
  }, [groupedLogs, selectedDate]);

  const formatDateFriendly = (dateStr) => {
    const [y, m, d] = dateStr.split('-');
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <>
      <Helmet>
        <title>Historial de Accesos - VC Fit</title>
      </Helmet>

      <div className="min-h-screen bg-background py-6 md:py-8 pb-24">

        {/* ── HEADER CARD (mismo patrón que payment-management) ── */}
        <Card padding="none" className="p-6 md:p-7 mb-7 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <BreadcrumbTrail
              items={[
                { label: 'Historial de Accesos', path: '/access-history', active: true }
              ]}
            />
            <h1 className="text-3xl md:text-4xl font-black text-text-primary tracking-tight mt-2">
              Historial de Accesos
            </h1>
            <p className="text-text-secondary font-medium mt-1">
              Revisa los ingresos por molinete según el rango de fechas
            </p>
          </div>

          {/* Controles de Filtro de Fecha */}
          <div className="flex flex-wrap items-center gap-2 bg-muted border border-border p-1.5 rounded-2xl w-full xl:w-auto">
            <div className="flex items-center pl-3 pr-1 text-primary">
              <Icon name="Calendar" size={18} />
            </div>

            <div className="flex flex-col px-2">
              <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest leading-none">Desde</span>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="bg-transparent text-sm font-black text-text-secondary focus:outline-none cursor-pointer"
              />
            </div>

            <div className="w-px h-8 bg-border mx-1" />

            <div className="flex flex-col px-2">
              <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest leading-none">Hasta</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="bg-transparent text-sm font-black text-text-secondary focus:outline-none cursor-pointer"
              />
            </div>

            <Button
              onClick={fetchLogs}
              disabled={loading}
              loading={loading}
              iconName="Search"
              className="h-11 px-5 ml-auto xl:ml-2 rounded-xl text-xs uppercase tracking-wider shadow-md"
            >
              Buscar
            </Button>
          </div>
        </Card>

        {/* --- GRID MASTER-DETAIL --- */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">

          {/* COLUMNA IZQUIERDA: Resumen de Días (4/12) */}
          <div className="xl:col-span-4 space-y-4">
            <h3 className="text-sm font-black text-text-primary uppercase tracking-widest ml-2 flex items-center gap-2">
              <Icon name="List" size={16} className="text-primary" /> Días con Actividad
            </h3>

            <Card padding="none" className="p-3 max-h-[700px] overflow-y-auto custom-scrollbar">
              {loading && groupedLogs.length === 0 ? (
                [1,2,3,4,5].map(i => (
                  <Skeleton key={i} className="h-20 rounded-2xl mb-2" />
                ))
              ) : groupedLogs.length === 0 ? (
                <EmptyState
                  iconName="CalendarX"
                  title="No hay registros"
                  description="Intenta ampliar el rango de fechas"
                />
              ) : (
                groupedLogs.map((group) => {
                  const isSelected = selectedDate === group.date;
                  return (
                    <div
                      key={group.date}
                      onClick={() => setSelectedDate(group.date)}
                      className={`p-4 rounded-2xl cursor-pointer transition-all mb-2 last:mb-0 border ${
                        isSelected
                          ? 'bg-info-light border-primary/20 shadow-sm'
                          : 'bg-card border-transparent hover:bg-muted hover:border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className={`text-sm font-black capitalize ${isSelected ? 'text-primary' : 'text-text-primary'}`}>
                          {formatDateFriendly(group.date)}
                        </p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isSelected ? 'bg-primary/15 text-primary' : 'bg-muted text-text-secondary'}`}>
                          {group.total}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {group.granted > 0 && (
                          <Badge variant="success" size="sm" iconName="Check" className="rounded-md">{group.granted}</Badge>
                        )}
                        {group.denied > 0 && (
                          <Badge variant="error" size="sm" iconName="X" className="rounded-md">{group.denied}</Badge>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </Card>
          </div>

          {/* COLUMNA DERECHA: Detalle del Día (8/12) */}
          <div className="xl:col-span-8 space-y-6 min-w-0">

            {/* KPIs del día */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card padding="none" className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 bg-info-light text-primary rounded-2xl flex items-center justify-center shadow-inner">
                  <Icon name="Users" size={24} />
                </div>
                <div>
                  <p className="text-2xl font-black text-text-primary leading-none">{selectedDayStats.total}</p>
                  <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mt-1">Total Accesos</p>
                </div>
              </Card>

              <Card padding="none" className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 bg-success-light text-success rounded-2xl flex items-center justify-center shadow-inner">
                  <Icon name="Check" size={24} />
                </div>
                <div>
                  <p className="text-2xl font-black text-text-primary leading-none">{selectedDayStats.granted}</p>
                  <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mt-1">Permitidos</p>
                </div>
              </Card>

              <Card padding="none" className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 bg-error-light text-error rounded-2xl flex items-center justify-center shadow-inner">
                  <Icon name="X" size={24} />
                </div>
                <div>
                  <p className="text-2xl font-black text-text-primary leading-none">{selectedDayStats.denied}</p>
                  <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mt-1">Denegados</p>
                </div>
              </Card>
            </div>

            {/* Tabla Principal */}
            <Card padding="none" className="flex flex-col min-h-[500px] overflow-hidden">
              <div className="p-6 md:p-8 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted text-text-secondary flex items-center justify-center">
                    <Icon name="Clock" size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-text-primary capitalize">
                      {formatDateFriendly(selectedDate)}
                    </h3>
                    <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest mt-0.5">
                      Detalle de registros del día
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 w-full overflow-x-auto">
                <div className="min-w-[500px]">
                  <div className="grid grid-cols-[80px_minmax(150px,2fr)_100px_minmax(150px,1.5fr)] gap-4 px-8 py-4 bg-muted border-b border-border text-[10px] font-black text-text-secondary uppercase tracking-widest items-center">
                    <div>Hora</div>
                    <div>Persona</div>
                    <div>Estado</div>
                    <div>Detalle</div>
                  </div>

                  <div className="flex flex-col divide-y divide-border pb-4">
                    {loading && displayLogs.length === 0 ? (
                      <div className="p-20 text-center">
                        <Icon name="Loader" size={32} className="animate-spin text-primary mx-auto" />
                      </div>
                    ) : displayLogs.length === 0 ? (
                      <EmptyState
                        iconName="Info"
                        title="Sin registros"
                        description="Selecciona otro día en el panel izquierdo."
                        className="py-20"
                      />
                    ) : (
                      displayLogs.map(log => (
                        <div key={log.id} className="grid grid-cols-[80px_minmax(150px,2fr)_100px_minmax(150px,1.5fr)] gap-4 px-8 py-4 items-center hover:bg-muted/80 transition-colors">
                          <div className="font-bold text-text-secondary text-sm">
                            {new Date(log.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="font-black text-text-primary text-sm min-w-0">
                            <p className="truncate">{log.actorName || 'Desconocido'}</p>
                            <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${log.actorType === 'Profesor' ? 'bg-violet-50 text-violet-700 border border-violet-200' : 'bg-info-light text-primary border border-primary/20'}`}>
                              {log.actorType}
                            </span>
                          </div>
                          <div>
                            {log.access_granted ? (
                              <Badge variant="success" size="sm" iconName="Check" className="rounded-lg tracking-widest">Ok</Badge>
                            ) : (
                              <Badge variant="error" size="sm" iconName="X" className="rounded-lg tracking-widest">Error</Badge>
                            )}
                          </div>
                          <div className="text-xs font-bold text-text-tertiary space-y-1">
                            <p className="truncate italic" title={log.rejection_reason || '-'}>
                              {log.rejection_reason || '-'}
                            </p>
                            <p className="truncate" title={`Código: ${log.reason_code || '—'}`}>
                              Código: {log.reason_code || '—'}
                            </p>
                            <p className="truncate" title={kioskReasonMessages[log.reason_code] || '—'}>
                              Motivo: {kioskReasonMessages[log.reason_code] || '—'}
                            </p>
                            <p className="truncate" title={`Slot: ${log.weekly_schedule_id || '—'}`}>
                              Slot: {log.weekly_schedule_id || '—'}
                            </p>
                            <p>
                              Saldo: {typeof log.remaining_sessions === 'number' ? log.remaining_sessions : '—'}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>

        </div>
      </div>
    </>
  );
};

export default AccessHistory;
