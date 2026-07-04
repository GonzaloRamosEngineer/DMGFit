import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { getMySlotOptions, setMySlotPreferences } from '../../../services/athletes';
import { useToast } from '../../../hooks/useToast';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const hm = (t) => String(t || '').slice(0, 5);

const MyScheduleCard = () => {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(() => new Set());

  const load = async () => {
    try {
      const opts = await getMySlotOptions();
      setData(opts);
    } catch (e) {
      console.error('Error cargando opciones de turno:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const slots = data?.slots || [];
  const visits = data?.visits_per_week ?? null;
  const selected = useMemo(() => slots.filter((s) => s.selected), [slots]);

  // Agrupar por día para el modal
  const byDay = useMemo(() => {
    const map = new Map();
    for (const s of slots) {
      if (!map.has(s.day_of_week)) map.set(s.day_of_week, []);
      map.get(s.day_of_week).push(s);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [slots]);

  const openModal = () => {
    setDraft(new Set(selected.map((s) => s.weekly_schedule_id)));
    setOpen(true);
  };

  const toggle = (id) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        if (visits && next.size >= visits) return prev; // tope = visitas/sem
        next.add(id);
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await setMySlotPreferences([...draft]);
      toast.success('Horarios actualizados.');
      setOpen(false);
      setLoading(true);
      await load();
    } catch (e) {
      toast.error(e.message || 'No se pudieron guardar los horarios.');
    } finally {
      setSaving(false);
    }
  };

  // No es atleta (ej. admin viendo) → no mostrar
  if (!loading && (!data || data.athlete_id == null)) return null;

  return (
    <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-info-light text-primary flex items-center justify-center">
            <Icon name="CalendarClock" size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-text-primary tracking-tight leading-none">Mis Horarios</h3>
            <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest mt-1">Tu agenda habitual</p>
          </div>
        </div>
        {!loading && (
          <Button variant="outline" size="sm" iconName="Pencil" onClick={openModal}>
            Cambiar
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-6 w-24 rounded-full bg-muted animate-pulse" />)}
        </div>
      ) : selected.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No elegiste horarios todavía. <button onClick={openModal} className="font-bold text-primary hover:underline">Elegir ahora</button>
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {selected.map((s) => (
            <Badge key={s.weekly_schedule_id} variant="primary" size="md">
              {DAY_SHORT[s.day_of_week]} {hm(s.start_time)}
            </Badge>
          ))}
        </div>
      )}

      <p className="text-[11px] text-text-tertiary mt-4 leading-relaxed">
        <Icon name="Info" size={12} className="inline -mt-0.5 mr-1" />
        Podés entrar cualquier día con lugar disponible; esto es tu horario de referencia.
      </p>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cambiar mis horarios"
        subtitle={visits ? `Elegí hasta ${visits} turno${visits > 1 ? 's' : ''} · ${draft.size}/${visits}` : undefined}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button variant="default" onClick={save} loading={saving} iconName="Check">Guardar</Button>
          </div>
        }
      >
        <div className="space-y-5">
          {byDay.map(([day, daySlots]) => (
            <div key={day}>
              <p className="text-xs font-black text-text-secondary uppercase tracking-widest mb-2">{DAYS[day]}</p>
              <div className="flex flex-wrap gap-2">
                {daySlots.map((s) => {
                  const isOn = draft.has(s.weekly_schedule_id);
                  const atLimit = visits && draft.size >= visits && !isOn;
                  return (
                    <button
                      key={s.weekly_schedule_id}
                      type="button"
                      onClick={() => toggle(s.weekly_schedule_id)}
                      disabled={atLimit}
                      className={`px-3 py-2 rounded-xl text-sm font-bold border transition-all ${
                        isOn
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : atLimit
                            ? 'bg-muted text-text-tertiary border-border opacity-50 cursor-not-allowed'
                            : 'bg-card text-text-secondary border-border hover:border-primary/40 hover:bg-muted'
                      }`}
                    >
                      {hm(s.start_time)}–{hm(s.end_time)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {byDay.length === 0 && (
            <p className="text-sm text-text-secondary">Tu plan no tiene horarios configurados.</p>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default MyScheduleCard;
