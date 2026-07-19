import React, { useEffect, useState } from 'react';
import Icon from '../../../components/AppIcon';
import { useToast } from '../../../hooks/useToast';
import { updateAthletePersonalData } from '../../../services/athletes';

const INTERNAL_DOMAINS = ['@dmg.internal', '@vcfit.internal'];

const isInternalEmail = (email = '') =>
  INTERNAL_DOMAINS.some((domain) => String(email).endsWith(domain));

const EditAthleteModal = ({ athlete, onClose, onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    dni: '',
    email: '',
    phone: '',
    birthDate: '',
    gender: 'select',
    address: '',
    city: '',
    emergencyName: '',
    emergencyPhone: '',
    medicalConditions: '',
  });
  const [originalDni, setOriginalDni] = useState('');

  useEffect(() => {
    if (!athlete) return;
    const dni = athlete.dni || '';
    setOriginalDni(dni.replace(/\D/g, ''));
    setFormData({
      fullName: athlete.name || '',
      dni,
      // El email interno ({DNI}@vcfit.internal) no es de contacto: no se muestra
      email: isInternalEmail(athlete.email) ? '' : athlete.email || '',
      phone: athlete.phone || '',
      birthDate: athlete.birth_date || '',
      gender: athlete.gender || 'select',
      address: athlete.address || '',
      city: athlete.city || '',
      emergencyName: athlete.emergency_contact_name || '',
      emergencyPhone: athlete.emergency_contact_phone || '',
      medicalConditions: athlete.medical_conditions || '',
    });
  }, [athlete]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const dniChanged = formData.dni.trim().replace(/\D/g, '') !== originalDni;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Si no hay email real, se conserva/repone el interno alineado al DNI
    const dniDigits = formData.dni.trim().replace(/\D/g, '');
    const normalizedEmail = formData.email.trim();
    const finalEmail =
      !normalizedEmail || normalizedEmail.includes('.internal')
        ? isInternalEmail(athlete.email)
          ? `${dniDigits}@vcfit.internal`
          : null
        : normalizedEmail;

    const result = await updateAthletePersonalData({
      athleteId: athlete.id,
      profileId: athlete.profile_id,
      data: { ...formData, email: finalEmail },
    });

    setLoading(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success('Datos personales actualizados.');
    onSuccess?.();
    onClose();
  };

  if (!athlete) return null;

  const inputClasses =
    'w-full px-4 py-2.5 bg-muted border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 font-medium transition-all placeholder:text-text-tertiary';
  const labelClasses =
    'text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1 mb-1.5 block';

  return (
    <div className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-modal flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-3xl w-full max-w-2xl flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-info-light text-primary flex items-center justify-center shadow-inner">
              <Icon name="Edit" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-text-primary tracking-tight">
                Editar Datos Personales
              </h2>
              <p className="text-xs font-bold text-text-tertiary mt-0.5">{athlete.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-text-tertiary hover:bg-muted hover:text-text-secondary transition-colors"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Formulario */}
        <form
          id="edit-athlete-form"
          onSubmit={handleSubmit}
          className="p-6 md:p-8 space-y-8 overflow-y-auto max-h-[65vh] custom-scrollbar"
        >
          {/* Sección 1: Identidad y contacto */}
          <section>
            <div className="flex items-center gap-2 pb-2 mb-4 border-b border-border">
              <div className="w-6 h-6 rounded bg-indigo-50 text-indigo-500 flex items-center justify-center">
                <Icon name="User" size={12} />
              </div>
              <h3 className="text-sm font-black text-text-primary">Identidad y Contacto</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label className={labelClasses}>
                  Nombre Completo <span className="text-error">*</span>
                </label>
                <input
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  placeholder="Ej: Juan Pérez"
                  className={inputClasses}
                />
              </div>

              <div>
                <label className={labelClasses}>
                  DNI <span className="text-error">*</span>
                </label>
                <input
                  name="dni"
                  value={formData.dni}
                  onChange={handleChange}
                  required
                  placeholder="12345678"
                  className={inputClasses}
                />
                <p className="text-[10px] text-text-tertiary mt-1 ml-1">
                  Con este DNI el atleta ficha en el kiosco.
                </p>
              </div>

              <div>
                <label className={labelClasses}>Teléfono</label>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+54 9..."
                  className={inputClasses}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelClasses}>Email de contacto</label>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="atleta@ejemplo.com"
                  className={inputClasses}
                />
              </div>
            </div>

            {dniChanged && (
              <div className="mt-4 text-[11px] text-warning bg-warning-light border border-warning/20 rounded-lg px-3 py-2 flex items-start gap-2">
                <Icon name="AlertTriangle" size={14} className="mt-0.5 shrink-0" />
                <span>
                  Estás cambiando el DNI. El kiosco tomará el nuevo DNI de inmediato, pero si
                  el atleta ya tenía acceso a la app, seguirá ingresando con su DNI anterior.
                </span>
              </div>
            )}
          </section>

          {/* Sección 2: Datos personales */}
          <section>
            <div className="flex items-center gap-2 pb-2 mb-4 border-b border-border">
              <div className="w-6 h-6 rounded bg-violet-50 text-violet-500 flex items-center justify-center">
                <Icon name="MapPin" size={12} />
              </div>
              <h3 className="text-sm font-black text-text-primary">Datos Personales</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelClasses}>Fecha de Nacimiento</label>
                <input
                  name="birthDate"
                  type="date"
                  value={formData.birthDate}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>

              <div>
                <label className={labelClasses}>Género</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className={`${inputClasses} appearance-none cursor-pointer`}
                >
                  <option value="select" disabled>
                    Seleccionar...
                  </option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="X">Otro</option>
                </select>
              </div>

              <div>
                <label className={labelClasses}>Ciudad</label>
                <input
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Ej: Salta"
                  className={inputClasses}
                />
              </div>

              <div>
                <label className={labelClasses}>Dirección</label>
                <input
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Calle y número"
                  className={inputClasses}
                />
              </div>
            </div>
          </section>

          {/* Sección 3: Emergencia y salud */}
          <section>
            <div className="flex items-center gap-2 pb-2 mb-4 border-b border-border">
              <div className="w-6 h-6 rounded bg-rose-50 text-rose-500 flex items-center justify-center">
                <Icon name="HeartPulse" size={12} />
              </div>
              <h3 className="text-sm font-black text-text-primary">Emergencia y Salud</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelClasses}>Contacto de Emergencia</label>
                <input
                  name="emergencyName"
                  value={formData.emergencyName}
                  onChange={handleChange}
                  placeholder="Nombre y apellido"
                  className={inputClasses}
                />
              </div>

              <div>
                <label className={labelClasses}>Teléfono de Emergencia</label>
                <input
                  name="emergencyPhone"
                  value={formData.emergencyPhone}
                  onChange={handleChange}
                  placeholder="+54 9..."
                  className={inputClasses}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelClasses}>Condiciones Médicas</label>
                <textarea
                  name="medicalConditions"
                  value={formData.medicalConditions}
                  onChange={handleChange}
                  placeholder="Lesiones, alergias, medicación..."
                  rows={3}
                  className={`${inputClasses} resize-none`}
                />
              </div>
            </div>
          </section>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-muted border-t border-border flex items-center justify-between shrink-0 rounded-b-3xl">
          <p className="text-[10px] font-bold text-text-tertiary flex items-center gap-1.5 uppercase tracking-widest">
            <Icon name="Info" size={12} />
            Obligatorio <span className="text-error">*</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-bold text-sm text-text-secondary hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              form="edit-athlete-form"
              type="submit"
              disabled={loading}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-primary-foreground bg-primary hover:bg-primary/90 shadow-md transition-all ${
                loading ? 'opacity-70 cursor-wait' : 'hover:-translate-y-0.5'
              }`}
            >
              {loading ? (
                <>
                  <Icon name="Loader" size={16} className="animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <Icon name="Save" size={16} /> Guardar Cambios
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditAthleteModal;
