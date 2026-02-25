import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Helmet } from 'react-helmet';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Icon from '../../components/AppIcon';
import { kioskReasonMessages } from '../../data/kioskReasonMessages';

const AccessHistory = () => {
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Helpers para obtener fechas en formato YYYY-MM-DD local
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

  // Estados para el Rango de Fechas (Por defecto: últimos 30 días)
  const [dateRange, setDateRange] = useState({
    start: getPastDateString(30),
    end: getTodayString()
  });

  // Fecha seleccionada para ver el detalle en la columna derecha
  const [selectedDate, setSelectedDate] = useState(getTodayString());

  // Función para traer los logs basados en el rango de fechas
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
          )
        `)
        // Buscamos desde las 00:00:00 del día inicio hasta las 23:59:59 del día fin
        .gte('check_in_time', `${dateRange.start}T00:00:00`)
        .lte('check_in_time', `${dateRange.end}T23:59:59`)
        .order('check_in_time', { ascending: false });

      if (error) throw error;
      
      setAllLogs(data || []);

      // Si hay datos, auto-seleccionamos el día más reciente que trajo la consulta
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

  // Cargar datos al montar el componente
  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo se ejecuta al montar, luego depende del botón "Buscar"

  // Agrupamos los logs por fecha para crear la lista de días
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

    // Ordenamos de más reciente a más antiguo
    return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [allLogs]);

  // Filtramos los logs para la tabla de la derecha según el día seleccionado
  const displayLogs = useMemo(() => {
    const group = groupedLogs.find(g => g.date === selectedDate);
    return group ? group.logs : [];
  }, [groupedLogs, selectedDate]);

  // Stats del día seleccionado
  const selectedDayStats = useMemo(() => {
    const group = groupedLogs.find(g => g.date === selectedDate);
    return group || { total: 0, granted: 0, denied: 0 };
  }, [groupedLogs, selectedDate]);

  // Formateador de fechas amigable (ej: "sáb, 24 oct")
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
      
      <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10 pb-24">
        
        {/* Header */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
          <div>
            <BreadcrumbTrail 
              items={[
                { label: 'Historial de Accesos', path: '/access-history', active: true }
              ]} 
            />
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mt-2">
              Historial de Accesos
            </h1>
            <p className="text-slate-500 font-medium mt-1">
              Revisa los ingresos por molinete según el rango de fechas
            </p>
          </div>
          
          {/* Controles de Filtro de Fecha */}
          <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm w-full xl:w-auto">
            <div className="flex items-center pl-3 pr-1 text-blue-500">
              <Icon name="Calendar" size={18} />
            </div>
            
            <div className="flex flex-col px-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Desde</span>
              <input 
                type="date" 
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="bg-transparent text-sm font-black text-slate-700 focus:outline-none cursor-pointer"
              />
            </div>
            
            <div className="w-px h-8 bg-slate-200 mx-1"></div>
            
            <div className="flex flex-col px-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Hasta</span>
              <input 
                type="date" 
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="bg-transparent text-sm font-black text-slate-700 focus:outline-none cursor-pointer"
              />
            </div>
            
            <button 
              onClick={fetchLogs}
              disabled={loading}
              className={`h-11 px-5 ml-auto xl:ml-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-blue-200 hover:-translate-y-0.5 ${loading ? 'opacity-70 cursor-wait' : ''}`}
            >
              <Icon name={loading ? "Loader" : "Search"} size={16} className={loading ? "animate-spin" : ""} />
              Buscar
            </button>
          </div>
        </div>

        {/* --- GRID MASTER-DETAIL --- */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          
          {/* COLUMNA IZQUIERDA: Resumen de Días (4/12) */}
          <div className="xl:col-span-4 space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest ml-2 flex items-center gap-2">
              <Icon name="List" size={16} className="text-blue-500" /> Días con Actividad
            </h3>
            
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-3 max-h-[700px] overflow-y-auto custom-scrollbar">
              {loading && groupedLogs.length === 0 ? (
                // Skeleton para la lista
                [1,2,3,4,5].map(i => (
                  <div key={i} className="h-20 bg-slate-50 rounded-2xl mb-2 animate-pulse"></div>
                ))
              ) : groupedLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Icon name="CalendarX" size={32} className="mx-auto mb-3 opacity-50" />
                  <p className="font-bold text-sm">No hay registros</p>
                  <p className="text-xs mt-1">Intenta ampliar el rango de fechas</p>
                </div>
              ) : (
                groupedLogs.map((group) => {
                  const isSelected = selectedDate === group.date;
                  return (
                    <div 
                      key={group.date}
                      onClick={() => setSelectedDate(group.date)}
                      className={`p-4 rounded-2xl cursor-pointer transition-all mb-2 last:mb-0 border ${
                        isSelected 
                          ? 'bg-blue-50 border-blue-200 shadow-sm' 
                          : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className={`text-sm font-black capitalize ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                          {formatDateFriendly(group.date)}
                        </p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isSelected ? 'bg-blue-200/50 text-blue-800' : 'bg-slate-100 text-slate-500'}`}>
                          {group.total}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {group.granted > 0 && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md">
                            <Icon name="Check" size={10} /> {group.granted}
                          </div>
                        )}
                        {group.denied > 0 && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-md">
                            <Icon name="X" size={10} /> {group.denied}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA: Detalle del Día (8/12) */}
          <div className="xl:col-span-8 space-y-6 min-w-0">
            
            {/* Tarjetas KPI del día */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                  <Icon name="Users" size={24} />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-800 leading-none">{selectedDayStats.total}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total Accesos</p>
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shadow-inner">
                  <Icon name="Check" size={24} />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-800 leading-none">{selectedDayStats.granted}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Permitidos</p>
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center shadow-inner">
                  <Icon name="X" size={24} />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-800 leading-none">{selectedDayStats.denied}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Denegados</p>
                </div>
              </div>
            </div>

            {/* Tabla Principal */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col min-h-[500px] overflow-hidden">
              <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-200/50 text-slate-600 flex items-center justify-center">
                    <Icon name="Clock" size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 capitalize">
                      {formatDateFriendly(selectedDate)}
                    </h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      Detalle de registros del día
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 w-full overflow-x-auto">
                <div className="min-w-[500px]">
                  {/* Cabecera Tabla */}
                  <div className="grid grid-cols-[80px_minmax(150px,2fr)_100px_minmax(150px,1.5fr)] gap-4 px-8 py-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest items-center">
                    <div>Hora</div>
                    <div>Atleta</div>
                    <div>Estado</div>
                    <div>Detalle</div>
                  </div>

                  {/* Filas */}
                  <div className="flex flex-col divide-y divide-slate-100 pb-4">
                    {loading && displayLogs.length === 0 ? (
                      <div className="p-20 text-center">
                        <Icon name="Loader" size={32} className="animate-spin text-blue-500 mx-auto" />
                      </div>
                    ) : displayLogs.length === 0 ? (
                      <div className="text-center py-20 px-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                          <Icon name="Info" size={28} className="text-slate-300" />
                        </div>
                        <p className="font-black text-slate-600 mb-1">Sin registros</p>
                        <p className="text-sm font-medium text-slate-400">Selecciona otro día en el panel izquierdo.</p>
                      </div>
                    ) : (
                      displayLogs.map(log => (
                        <div key={log.id} className="grid grid-cols-[80px_minmax(150px,2fr)_100px_minmax(150px,1.5fr)] gap-4 px-8 py-4 items-center hover:bg-slate-50/80 transition-colors">
                          <div className="font-bold text-slate-600 text-sm">
                            {new Date(log.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </div>
                          <div className="font-black text-slate-800 text-sm truncate">
                            {log.athletes?.profiles?.full_name || 'Desconocido'}
                          </div>
                          <div>
                            {log.access_granted ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase tracking-widest">
                                <Icon name="Check" size={10} /> Ok
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-200 uppercase tracking-widest">
                                <Icon name="X" size={10} /> Error
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-slate-400 space-y-1">
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
            </div>
          </div>
          
        </div>
      </div>
    </>
  );
};

export default AccessHistory;