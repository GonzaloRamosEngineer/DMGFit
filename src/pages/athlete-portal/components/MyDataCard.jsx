import React, { useEffect, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import Input from '../../../components/ui/Input';
import { getMyProfile, updateMyProfile } from '../../../services/athletes';
import { useToast } from '../../../hooks/useToast';

const EDITABLE = [
  'full_name', 'phone', 'birth_date', 'gender', 'address', 'city',
  'emergency_contact_name', 'emergency_contact_phone', 'medical_conditions',
];

const Row = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
    <span className="text-xs font-bold text-text-tertiary uppercase tracking-wider">{label}</span>
    <span className="text-sm font-semibold text-text-primary text-right break-words max-w-[60%]">{value || '—'}</span>
  </div>
);

const MyDataCard = () => {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  const load = async () => {
    try {
      setData(await getMyProfile());
    } catch (e) {
      console.error('Error cargando mis datos:', e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openModal = () => {
    const f = {};
    EDITABLE.forEach((k) => { f[k] = data?.[k] ?? ''; });
    setForm(f);
    setOpen(true);
  };

  const setField = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      await updateMyProfile(form);
      toast.success('Datos actualizados.');
      setOpen(false);
      setLoading(true);
      await load();
    } catch (e) {
      toast.error(e.message || 'No se pudieron guardar los datos.');
    } finally {
      setSaving(false);
    }
  };

  if (!loading && (!data || data.athlete_id == null)) return null;

  return (
    <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-info-light text-primary flex items-center justify-center">
            <Icon name="UserCog" size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-text-primary tracking-tight leading-none">Mis Datos</h3>
            <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest mt-1">Datos personales</p>
          </div>
        </div>
        {!loading && (
          <Button variant="outline" size="sm" iconName="Pencil" onClick={openModal}>Editar</Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-5 bg-muted rounded animate-pulse" />)}
        </div>
      ) : (
        <div className="flex flex-col">
          <Row label="Nombre" value={data.full_name} />
          <Row label="DNI" value={data.dni} />
          <Row label="Teléfono" value={data.phone} />
          <Row label="Nacimiento" value={data.birth_date} />
          <Row label="Domicilio" value={data.address} />
          <Row label="Contacto emergencia" value={data.emergency_contact_name} />
          <Row label="Tel. emergencia" value={data.emergency_contact_phone} />
          <Row label="Condición médica" value={data.medical_conditions} />
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Editar mis datos"
        subtitle="El DNI, el plan y el email no se editan acá."
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button variant="default" onClick={save} loading={saving} iconName="Check">Guardar</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input label="Nombre y apellido" value={form.full_name || ''} onChange={setField('full_name')} />
          </div>
          <Input label="Teléfono" value={form.phone || ''} onChange={setField('phone')} />
          <Input label="Fecha de nacimiento" type="date" value={form.birth_date || ''} onChange={setField('birth_date')} />
          <div className="sm:col-span-2">
            <Input label="Domicilio / Barrio" value={form.address || ''} onChange={setField('address')} />
          </div>
          <Input label="Contacto de emergencia" value={form.emergency_contact_name || ''} onChange={setField('emergency_contact_name')} />
          <Input label="Tel. de emergencia" value={form.emergency_contact_phone || ''} onChange={setField('emergency_contact_phone')} />
          <div className="sm:col-span-2">
            <Input label="Condición médica / lesión" value={form.medical_conditions || ''} onChange={setField('medical_conditions')} description="Si no tenés nada, escribí 'No'." />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MyDataCard;
