import React, { useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';

const getInitials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ST';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

const CoachesTable = ({
  coaches = [],
  loading = false,
  onEdit,
  onDelete,
  onViewAthletes,
  onEnableAccount,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredCoaches = useMemo(() => {
    const term = search.trim().toLowerCase();

    return (coaches || []).filter((coach) => {
      const matchesSearch =
        !term ||
        coach.name?.toLowerCase().includes(term) ||
        coach.specialization?.toLowerCase().includes(term) ||
        coach.bio?.toLowerCase().includes(term) ||
        coach.email?.toLowerCase().includes(term) ||
        coach.phone?.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
          ? !coach.needsActivation
          : coach.needsActivation;

      return matchesSearch && matchesStatus;
    });
  }, [coaches, search, statusFilter]);

  const renderStatusBadge = (coach) => {
    if (coach.needsActivation) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning-light text-warning text-[11px] font-semibold tracking-wide border border-amber-100">
          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
          Pendiente
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-light text-success text-[11px] font-semibold tracking-wide border border-emerald-100">
        <span className="w-1.5 h-1.5 rounded-full bg-success" />
        Activo
      </span>
    );
  };

  return (
    <div className="w-full h-full bg-card rounded-3xl border border-border shadow-sm overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary">
              <Icon name="Search" size={18} />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, especialidad o DNI..."
              className="w-full h-[42px] pl-10 pr-4 rounded-lg border border-border bg-card text-sm text-text-secondary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
            />
          </div>

          <div className="flex items-center gap-3 self-end lg:self-auto">
            <label className="text-sm font-medium text-text-secondary whitespace-nowrap">
              Estado:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-[42px] min-w-[160px] px-3 rounded-lg border border-border bg-card text-sm font-medium text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
            >
              <option value="all">Todos</option>
              <option value="active">Solo Activos</option>
              <option value="pending">Pendientes</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla desktop/tablet */}
      <div className="hidden md:block flex-1 min-h-0 overflow-auto custom-scrollbar">
        <table className="w-full min-w-[980px] text-left">
          <thead className="sticky top-0 z-card bg-card">
            <tr className="border-b border-border bg-card">
              <th className="px-6 py-4 text-[11px] font-semibold tracking-wider uppercase text-text-secondary">
                Profesor / Entrenador
              </th>
              <th className="px-6 py-4 text-[11px] font-semibold tracking-wider uppercase text-text-secondary">
                Rol & Especialidad
              </th>
              <th className="text-center px-6 py-4 text-[11px] font-semibold tracking-wider uppercase text-text-secondary">
                Atletas
              </th>
              <th className="text-center px-6 py-4 text-[11px] font-semibold tracking-wider uppercase text-text-secondary">
                Estado
              </th>
              <th className="text-right px-6 py-4 text-[11px] font-semibold tracking-wider uppercase text-text-secondary">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {loading ? (
              [...Array(5)].map((_, index) => (
                <tr key={index}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                      <div className="space-y-2">
                        <div className="w-32 h-3.5 rounded bg-muted animate-pulse" />
                        <div className="w-24 h-2.5 rounded bg-muted animate-pulse" />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      <div className="w-28 h-3.5 rounded bg-muted animate-pulse" />
                      <div className="w-36 h-2.5 rounded bg-muted animate-pulse" />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="w-4 h-4 rounded bg-muted animate-pulse mx-auto" />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="w-20 h-6 rounded-full bg-muted animate-pulse mx-auto" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-3">
                      <div className="w-5 h-5 rounded bg-muted animate-pulse" />
                      <div className="w-5 h-5 rounded bg-muted animate-pulse" />
                    </div>
                  </td>
                </tr>
              ))
            ) : filteredCoaches.length > 0 ? (
              filteredCoaches.map((coach) => (
                <tr
                  key={coach.id}
                  className="hover:bg-muted/50 transition-colors"
                >
                  {/* Profesor */}
                  <td className="px-6 py-4 align-middle">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-info-light text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {coach.avatar ? (
                          <Image
                            src={coach.avatar}
                            alt={coach.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{getInitials(coach.name)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate">
                          {coach.name}
                        </p>
                        <p className="text-[12px] text-text-secondary truncate mt-0.5">
                          {coach.dni ? `DNI: ${coach.dni}` : (coach.email || coach.phone || 'Sin datos')}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Rol & Especialidad */}
                  <td className="px-6 py-4 align-middle">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">
                        {coach.specialization || 'Staff General'}
                      </p>
                      <p className="text-[12px] text-text-secondary line-clamp-1 mt-0.5">
                        {coach.bio || 'Sin descripción'}
                      </p>
                    </div>
                  </td>

                  {/* Alumnos */}
                  <td className="px-6 py-4 align-middle text-center">
                    <button
                      type="button"
                      onClick={() => onViewAthletes?.(coach)}
                      className="text-sm font-semibold text-text-secondary hover:text-primary hover:underline transition-colors"
                      title="Ver atletas asignados"
                    >
                      {coach.totalAthletes || 0}
                    </button>
                  </td>

                  {/* Estado */}
                  <td className="px-6 py-4 align-middle text-center">
                    {renderStatusBadge(coach)}
                  </td>

                  {/* Acciones */}
                  <td className="px-6 py-4 align-middle">
                    <div className="flex items-center justify-end gap-3 text-text-tertiary">
                      <button
                        type="button"
                        onClick={() => onEdit?.(coach)}
                        className="p-1 hover:text-text-secondary transition-colors"
                        title="Editar"
                      >
                        <Icon name="Pencil" size={16} />
                      </button>

                      {coach.needsActivation && (
                        <button
                          type="button"
                          onClick={() => onEnableAccount?.(coach)}
                          className="p-1 hover:text-warning transition-colors"
                          title="Habilitar acceso"
                        >
                          <Icon name="UserCheck" size={16} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onDelete?.(coach.id)}
                        className="p-1 hover:text-error transition-colors"
                        title="Eliminar/Deshabilitar"
                      >
                        <Icon name="Ban" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <p className="text-sm text-text-secondary">
                    No hay resultados para la búsqueda o el filtro seleccionado.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Vista mobile (Simplificada y alineada al nuevo diseño) */}
      <div className="md:hidden flex-1 min-h-0 overflow-auto px-4 py-4 space-y-3 bg-muted/50">
        {loading ? (
          [...Array(4)].map((_, index) => (
            <div key={index} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
              <div className="w-32 h-3 rounded bg-muted animate-pulse" />
              <div className="w-24 h-2 rounded bg-muted animate-pulse" />
            </div>
          ))
        ) : filteredCoaches.length > 0 ? (
          filteredCoaches.map((coach) => (
            <div key={coach.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-info-light text-primary flex items-center justify-center font-bold text-sm">
                    {coach.avatar ? (
                      <Image src={coach.avatar} alt={coach.name} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <span>{getInitials(coach.name)}</span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary">{coach.name}</h4>
                    <p className="text-[12px] text-text-secondary">{coach.specialization || 'Staff General'}</p>
                  </div>
                </div>
                {renderStatusBadge(coach)}
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <button
                  onClick={() => onViewAthletes?.(coach)}
                  className="text-[12px] font-semibold text-text-secondary hover:text-primary"
                >
                  {coach.totalAthletes || 0} Atletas
                </button>
                <div className="flex gap-4 text-text-tertiary">
                  <button onClick={() => onEdit?.(coach)} className="hover:text-text-secondary"><Icon name="Pencil" size={16} /></button>
                  {coach.needsActivation && <button onClick={() => onEnableAccount?.(coach)} className="hover:text-warning"><Icon name="UserCheck" size={16} /></button>}
                  <button onClick={() => onDelete?.(coach.id)} className="hover:text-error"><Icon name="Ban" size={16} /></button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-8 text-center text-sm text-text-secondary">
            No se encontraron profesores.
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && (
        <div className="px-6 py-3 text-[12px] font-medium text-text-secondary border-t border-border bg-card shrink-0">
          Mostrando {filteredCoaches.length} profesor{filteredCoaches.length === 1 ? '' : 'es'}
        </div>
      )}
    </div>
  );
};

export default CoachesTable;