import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Icon from '../../components/AppIcon';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Fecha local (evita el desfase UTC)
const localDate = (d = new Date()) => {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().split('T')[0];
};

const CoachAttendance = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [coachFilter, setCoachFilter] = useState('all');
  const [start, setStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return localDate(d);
  });
  const [end, setEnd] = useState(() => localDate());

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('access_logs')
          .select('id, check_in_time, local_checkin_date, coach_id, coaches ( profiles ( full_name ) ), weekly_schedule ( day_of_week, start_time, end_time )')
          .not('coach_id', 'is', null)
          .eq('access_granted', true)
          .gte('local_checkin_date', start)
          .lte('local_checkin_date', end)
          .order('check_in_time', { ascending: false });

        if (error) throw error;
        if (mounted) setRows(data || []);
      } catch (e) {
        console.error('Error cargando asistencia de profes:', e);
        if (mounted) setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [start, end]);

  const coaches = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      if (r.coach_id) map.set(r.coach_id, r.coaches?.profiles?.full_name || 'Profesor');
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(
    () => (coachFilter === 'all' ? rows : rows.filter((r) => r.coach_id === coachFilter)),
    [rows, coachFilter],
  );

  const fmtTime = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  return (
    <>
      <Helmet><title>Asistencia de Profesores | VC Fit</title></Helmet>

      <div className="min-h-screen bg-[#F8FAFC] py-6 md:py-8 pb-24">
        <div className="w-full">
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 md:p-7 mb-7">
            <BreadcrumbTrail items={[{ label: 'Asistencia de Profesores', path: '/coach-attendance', active: true }]} />
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mt-2">Asistencia de Profesores</h1>
            <p className="text-slate-500 font-medium mt-1">Qué días y horarios estuvo presente cada profesor (registrado en el kiosco).</p>

            <div className="flex flex-wrap gap-3 mt-5">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Desde</label>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Hasta</label>
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Profesor</label>
                <select value={coachFilter} onChange={(e) => setCoachFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium">
                  <option value="all">Todos</option>
                  {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-slate-400">Cargando…</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center">
                <Icon name="CalendarX" size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">No hay registros de asistencia en este período.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="text-left font-bold px-5 py-3">Profesor</th>
                      <th className="text-left font-bold px-5 py-3">Fecha</th>
                      <th className="text-left font-bold px-5 py-3">Hora de llegada</th>
                      <th className="text-left font-bold px-5 py-3">Turno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-bold text-slate-800">{r.coaches?.profiles?.full_name || 'Profesor'}</td>
                        <td className="px-5 py-3 text-slate-600">
                          {r.local_checkin_date
                            ? `${DAY_NAMES[new Date(r.local_checkin_date + 'T00:00:00').getDay()]} ${new Date(r.local_checkin_date + 'T00:00:00').toLocaleDateString('es-AR')}`
                            : '—'}
                        </td>
                        <td className="px-5 py-3 text-slate-600">{fmtTime(r.check_in_time)}</td>
                        <td className="px-5 py-3 text-slate-600">
                          {r.weekly_schedule
                            ? `${String(r.weekly_schedule.start_time).slice(0, 5)} - ${String(r.weekly_schedule.end_time).slice(0, 5)}`
                            : 'Sin turno'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CoachAttendance;
