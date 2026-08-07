import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import Icon from '../../components/AppIcon';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import DateRangeFilter, { FilterSegment } from '../../components/ui/DateRangeFilter';
import EditCoachAttendanceModal from './components/EditCoachAttendanceModal';
import CreateCoachAttendanceModal from './components/CreateCoachAttendanceModal';
import { setCoachAttendance, createCoachAttendance } from '../../services/attendance';
import { useToast } from '../../hooks/useToast';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Señala que ESE horario lo cargó administración y no salió del kiosco.
const ManualBadge = ({ editedAt, campo }) => {
  if (!editedAt) return null;
  return (
    <span
      title={`La ${campo} la cargó administración a mano, no se fichó en el kiosco.`}
      className="px-1.5 py-0.5 rounded bg-info-light text-info text-[10px] font-black uppercase tracking-wide"
    >
      A mano
    </span>
  );
};

// Fecha local (evita el desfase UTC)
const localDate = (d = new Date()) => {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().split('T')[0];
};

const CoachAttendance = () => {
  const [rows, setRows] = useState([]);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [coachFilter, setCoachFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [allCoaches, setAllCoaches] = useState([]);
  const [creating, setCreating] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [start, setStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return localDate(d);
  });
  const [end, setEnd] = useState(() => localDate());

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('access_logs')
        .select('id, check_in_time, check_out_time, local_checkin_date, coach_id, check_in_edited_at, check_out_edited_at, coaches ( profiles ( full_name ) ), weekly_schedule ( day_of_week, start_time, end_time )')
        .not('coach_id', 'is', null)
        .eq('access_granted', true)
        .gte('local_checkin_date', start)
        .lte('local_checkin_date', end)
        .order('check_in_time', { ascending: false });

      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      console.error('Error cargando asistencia de profes:', e);
      setRows([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    load();
  }, [load]);

  // Lista de profesores para el selector del alta manual. Sólo los ACTIVOS:
  // un profe archivado ya no trabaja acá (0002 le bloquea hasta el login), así
  // que ofrecerlo para cargarle una presencia nueva no tiene sentido. Sus
  // registros viejos siguen viéndose en la tabla y en el filtro de arriba.
  useEffect(() => {
    const loadCoaches = async () => {
      const { data, error } = await supabase
        .from('coaches')
        .select('id, archived_at, profiles:profile_id(full_name)')
        .is('archived_at', null);
      if (!error) {
        setAllCoaches(
          (data || [])
            .map((c) => ({ id: c.id, name: c.profiles?.full_name || 'Profesor' }))
            .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        );
      }
    };
    loadCoaches();
  }, []);

  // Realtime: refresca cuando un profe registra ingreso en el kiosco.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    let debounce;
    const channel = supabase
      .channel('coach-attendance-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'access_logs' },
        () => {
          clearTimeout(debounce);
          debounce = setTimeout(() => loadRef.current?.({ silent: true }), 400);
        },
      )
      .subscribe();

    return () => {
      clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, []);

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
      // Hora fija de Argentina (UTC-3): check_in/out son timestamptz (instantes),
      // se muestran en hora del gimnasio sin importar la zona de quien mira.
      return new Date(iso).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/Argentina/Buenos_Aires',
      });
    } catch {
      return '—';
    }
  };

  // Minutos trabajados de una fila (entrada->salida). null si aún no fichó salida.
  const workedMinutes = (r) => {
    if (!r.check_in_time || !r.check_out_time) return null;
    const min = Math.round((new Date(r.check_out_time) - new Date(r.check_in_time)) / 60000);
    return min >= 0 ? min : null;
  };
  const fmtDuration = (min) => {
    if (min == null) return null;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const handleSaveEdit = async ({ checkIn, checkOut }) => {
    if (!editing?.id) return;

    setSavingEdit(true);
    try {
      const { success, error, result } = await setCoachAttendance({
        logId: editing.id,
        checkIn,
        checkOut,
      });

      if (!success) {
        toast.error(error || 'No se pudo guardar la corrección.');
        return;
      }

      toast.success(
        result?.minutos != null
          ? `Asistencia corregida: ${fmtDuration(result.minutos)} trabajados.`
          : 'Asistencia corregida.',
      );
      setEditing(null);
      load({ silent: true });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreate = async ({ coachId, date, checkIn, checkOut }) => {
    setSavingCreate(true);
    try {
      const { success, error, result } = await createCoachAttendance({ coachId, date, checkIn, checkOut });

      if (!success) {
        toast.error(error || 'No se pudo registrar la asistencia.');
        return;
      }

      toast.success(
        result?.minutos != null
          ? `Asistencia registrada: ${fmtDuration(result.minutos)} trabajados.`
          : 'Asistencia registrada.',
      );
      setCreating(false);
      load({ silent: true });
    } finally {
      setSavingCreate(false);
    }
  };

  // Total de horas trabajadas por profesor en el período. "dias" cuenta días
  // distintos, no fichajes: un profe puede tener varios ciclos entrada/salida en
  // el mismo día y eso sigue siendo 1 sólo día trabajado.
  const totals = useMemo(() => {
    const map = new Map();
    filtered.forEach((r) => {
      if (!r.coach_id) return;
      const cur = map.get(r.coach_id) || {
        name: r.coaches?.profiles?.full_name || 'Profesor',
        minutes: 0,
        dias: new Set(),
        sinSalida: 0,
      };
      if (r.local_checkin_date) cur.dias.add(r.local_checkin_date);
      const wm = workedMinutes(r);
      if (wm == null) cur.sinSalida += 1;
      else cur.minutes += wm;
      map.set(r.coach_id, cur);
    });
    return Array.from(map.values())
      .map((t) => ({ ...t, dias: t.dias.size }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [filtered]);

  return (
    <>
      <Helmet><title>Asistencia de Profesores | VC Fit</title></Helmet>

      <div className="flex flex-col gap-4 lg:gap-5 lg:h-[calc(100vh-4rem)]">
          {/* Header: título + acción primaria. Misma gramática que Profesores y
              Atletas (la acción vive arriba a la derecha, sola). Los filtros van
              en su propia banda abajo: apretados los tres en el mismo renglón la
              esquina quedaba ilegible. */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-text-primary tracking-tight">Asistencia de Profesores</h1>
              <p className="text-sm text-text-secondary font-medium mt-0.5">Entrada, salida y horas trabajadas de cada profesor (puede fichar varias veces por día).</p>
            </div>

            <Button
              onClick={() => setCreating(true)}
              iconName="Plus"
              className="h-auto w-full shrink-0 rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-widest shadow-md transition-all hover:-translate-y-0.5 md:w-auto"
            >
              Registrar asistencia
            </Button>
          </div>

          {/* Filtros. `self-start` para que la card no se estire a todo el ancho
              del contenedor: estirada, los campos quedan separados por cientos de
              píxeles y deja de leerse como una barra de herramientas. */}
          <DateRangeFilter
            className="shrink-0 self-start"
            start={start}
            end={end}
            onStartChange={(e) => setStart(e.target.value)}
            onEndChange={(e) => setEnd(e.target.value)}
            onRangeSelect={(r) => { setStart(r.start); setEnd(r.end); }}
          >
            <FilterSegment label="Profesor" className="min-w-[140px]">
              <span className="relative flex items-center">
                <select
                  value={coachFilter}
                  onChange={(e) => setCoachFilter(e.target.value)}
                  className="w-full cursor-pointer appearance-none border-0 bg-transparent bg-none p-0 pr-5 text-sm font-black text-text-primary outline-none focus:ring-0"
                >
                  <option value="all">Todos</option>
                  {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Icon name="ChevronDown" size={13} className="pointer-events-none absolute right-0 text-text-tertiary" />
              </span>
            </FilterSegment>
          </DateRangeFilter>

          {!loading && totals.length > 0 && (
            <div className="shrink-0 flex gap-3 overflow-x-auto custom-scrollbar pb-1">
              {totals.map((t) => (
                <div
                  key={t.name}
                  className="min-w-[180px] rounded-2xl border border-border bg-card px-4 py-3 shadow-sm"
                >
                  <p className="text-xs font-bold text-text-secondary truncate">{t.name}</p>
                  <p className="text-xl font-black text-text-primary mt-0.5">
                    {fmtDuration(t.minutes) || '0m'}
                  </p>
                  {/* "sin salida" es lo accionable de la tarjeta (son los días que
                      no computan horas hasta que alguien los cierre), así que va
                      en ámbar, igual que el "En curso" de la tabla. */}
                  <p className="text-[11px] font-semibold text-text-tertiary">
                    {t.dias} {t.dias === 1 ? 'día' : 'días'}
                    {t.sinSalida > 0 && (
                      <span className="text-warning"> · {t.sinSalida} sin salida</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}

          <Card padding="none" className="flex flex-col lg:flex-1 lg:min-h-0 overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                iconName="CalendarX"
                title="Sin registros"
                description="No hay registros de asistencia en este período."
              />
            ) : (
              <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-text-secondary uppercase text-[11px] tracking-wider sticky top-0 z-card">
                    <tr>
                      <th className="text-left font-bold px-5 py-3">Profesor</th>
                      <th className="text-left font-bold px-5 py-3">Fecha</th>
                      <th className="text-left font-bold px-5 py-3">Entrada</th>
                      <th className="text-left font-bold px-5 py-3">Salida</th>
                      <th className="text-left font-bold px-5 py-3">Horas</th>
                      <th className="text-left font-bold px-5 py-3">Turno</th>
                      <th className="text-right font-bold px-5 py-3 w-px whitespace-nowrap">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-t border-border hover:bg-muted/50">
                        <td className="px-5 py-3 font-bold text-text-primary">{r.coaches?.profiles?.full_name || 'Profesor'}</td>
                        <td className="px-5 py-3 text-text-secondary">
                          {r.local_checkin_date
                            ? `${DAY_NAMES[new Date(r.local_checkin_date + 'T00:00:00').getDay()]} ${new Date(r.local_checkin_date + 'T00:00:00').toLocaleDateString('es-AR')}`
                            : '—'}
                        </td>
                        {/* La marca es por campo: en una misma fila la entrada puede
                            ser real (kiosco) y la salida cargada por administración. */}
                        <td className="px-5 py-3 text-text-secondary">
                          <span className="flex items-center gap-2">
                            {fmtTime(r.check_in_time)}
                            <ManualBadge editedAt={r.check_in_edited_at} campo="entrada" />
                          </span>
                        </td>
                        <td className="px-5 py-3 text-text-secondary">
                          <span className="flex items-center gap-2">
                            {r.check_out_time ? (
                              fmtTime(r.check_out_time)
                            ) : (
                              <span className="text-warning font-semibold">En curso</span>
                            )}
                            <ManualBadge editedAt={r.check_out_edited_at} campo="salida" />
                          </span>
                        </td>
                        <td className="px-5 py-3 font-bold text-text-primary">
                          {fmtDuration(workedMinutes(r)) || '—'}
                        </td>
                        <td className="px-5 py-3 text-text-secondary whitespace-nowrap">
                          {r.weekly_schedule
                            ? `${String(r.weekly_schedule.start_time).slice(0, 5)} - ${String(r.weekly_schedule.end_time).slice(0, 5)}`
                            : 'Sin turno'}
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          {/* Sin salida es el caso frecuente (se fue y no fichó): se
                              nombra la acción, no "Editar", para que se entienda sola. */}
                          <button
                            type="button"
                            onClick={() => setEditing(r)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-bold text-text-secondary hover:bg-muted hover:text-text-primary transition-colors"
                          >
                            <Icon name={r.check_out_time ? 'Pencil' : 'LogOut'} size={13} />
                            {r.check_out_time ? 'Corregir' : 'Registrar salida'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
      </div>

      {editing && (
        <EditCoachAttendanceModal
          row={editing}
          onClose={() => setEditing(null)}
          onSave={handleSaveEdit}
          saving={savingEdit}
        />
      )}

      {creating && (
        <CreateCoachAttendanceModal
          coaches={allCoaches}
          onClose={() => setCreating(false)}
          onSave={handleCreate}
          saving={savingCreate}
        />
      )}
    </>
  );
};

export default CoachAttendance;
