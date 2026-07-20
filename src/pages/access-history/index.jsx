import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Helmet } from 'react-helmet';
import Icon from '../../components/AppIcon';
import { kioskReasonMessages } from '../../data/kioskReasonMessages';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Badge } from '../../components/ui/Badge';
import DateRangeFilter from '../../components/ui/DateRangeFilter';

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

  const fetchLogs = async ({ silent = false, range = dateRange } = {}) => {
    if (!silent) setLoading(true);
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
        .gte('check_in_time', `${range.start}T00:00:00`)
        .lte('check_in_time', `${range.end}T23:59:59`)
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

      // Solo saltamos al día más reciente en la carga inicial/manual,
      // no en los refrescos en vivo (para no sacar al usuario del día que mira).
      if (!silent && data && data.length > 0) {
        const mostRecentDate = getLocalDateString(new Date(data[0].check_in_time));
        setSelectedDate(mostRecentDate);
      }
    } catch (err) {
      console.error("Error obteniendo logs:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Ref al último fetchLogs para que la suscripción Realtime use siempre
  // el rango de fechas vigente sin re-suscribirse.
  const fetchLogsRef = useRef(fetchLogs);
  useEffect(() => {
    fetchLogsRef.current = fetchLogs;
  });

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Realtime: escucha inserciones/cambios en access_logs y refresca en vivo ──
  const [isLive, setIsLive] = useState(false);
  useEffect(() => {
    let debounce;
    const channel = supabase
      .channel('access-history-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'access_logs' },
        () => {
          // Agrupamos ráfagas de eventos en un solo refetch silencioso.
          clearTimeout(debounce);
          debounce = setTimeout(() => fetchLogsRef.current?.({ silent: true }), 400);
        },
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => {
      clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
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

      <div className="flex flex-col gap-4 lg:gap-5 lg:h-[calc(100vh-4rem)]">

        {/* ── HEADER compacto (fila simple, sin caja) ── */}
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-text-primary tracking-tight">
              Historial de Accesos
            </h1>
            <p className="text-sm text-text-secondary font-medium mt-0.5">
              Revisa los ingresos por molinete según el rango de fechas
            </p>
          </div>

          {/* Controles de Filtro de Fecha (componente compartido) */}
          <DateRangeFilter
            start={dateRange.start}
            end={dateRange.end}
            onStartChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            onEndChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            onRangeSelect={(r) => { setDateRange(r); fetchLogs({ range: r }); }}
            onSearch={() => fetchLogs()}
            loading={loading}
          />
        </div>

        {/* --- GRID MASTER-DETAIL --- */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 xl:flex-1 xl:min-h-0">

          {/* COLUMNA IZQUIERDA: Resumen de Días (4/12) */}
          <div className="xl:col-span-4 flex flex-col gap-3 xl:min-h-0">
            <h3 className="text-sm font-black text-text-primary uppercase tracking-widest ml-2 flex items-center gap-2 shrink-0">
              <Icon name="List" size={16} className="text-primary" /> Días con Actividad
              {isLive && (
                <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold text-success normal-case tracking-normal">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                  </span>
                  En vivo
                </span>
              )}
            </h3>

            <Card padding="none" className="p-3 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
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
          <div className="xl:col-span-8 flex flex-col gap-4 min-w-0 xl:min-h-0">

            {/* KPIs del día */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
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
            <Card padding="none" className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/50 shrink-0">
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

              <div className="flex-1 min-h-0 w-full overflow-auto custom-scrollbar">
                <div className="min-w-[500px]">
                  <div className="grid grid-cols-[80px_minmax(150px,2fr)_100px_minmax(150px,1.5fr)] gap-4 px-8 py-3 bg-muted border-b border-border text-[10px] font-black text-text-secondary uppercase tracking-widest items-center sticky top-0 z-card">
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
