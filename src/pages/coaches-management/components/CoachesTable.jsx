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
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-[11px] font-semibold tracking-wide border border-amber-100">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Pendiente
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-semibold tracking-wide border border-emerald-100">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Activo
      </span>
    );
  };

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Toolbar */}
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <Icon name="Search" size={18} />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, especialidad o DNI..."
              className="w-full h-[42px] pl-10 pr-4 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-3 self-end lg:self-auto">
            <label className="text-sm font-medium text-slate-600 whitespace-nowrap">
              Estado:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-[42px] min-w-[160px] px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            >
              <option value="all">Todos</option>
              <option value="active">Solo Activos</option>
              <option value="pending">Pendientes</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla desktop/tablet */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[980px] text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-white">
              <th className="px-6 py-4 text-[11px] font-semibold tracking-wider uppercase text-slate-500">
                Profesor / Entrenador
              </th>
              <th className="px-6 py-4 text-[11px] font-semibold tracking-wider uppercase text-slate-500">
                Rol & Especialidad
              </th>
              <th className="text-center px-6 py-4 text-[11px] font-semibold tracking-wider uppercase text-slate-500">
                Alumnos
              </th>
              <th className="text-center px-6 py-4 text-[11px] font-semibold tracking-wider uppercase text-slate-500">
                Estado
              </th>
              <th className="text-right px-6 py-4 text-[11px] font-semibold tracking-wider uppercase text-slate-500">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading ? (
              [...Array(5)].map((_, index) => (
                <tr key={index}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse" />
                      <div className="space-y-2">
                        <div className="w-32 h-3.5 rounded bg-slate-100 animate-pulse" />
                        <div className="w-24 h-2.5 rounded bg-slate-100 animate-pulse" />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      <div className="w-28 h-3.5 rounded bg-slate-100 animate-pulse" />
                      <div className="w-36 h-2.5 rounded bg-slate-100 animate-pulse" />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="w-4 h-4 rounded bg-slate-100 animate-pulse mx-auto" />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="w-20 h-6 rounded-full bg-slate-100 animate-pulse mx-auto" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-3">
                      <div className="w-5 h-5 rounded bg-slate-100 animate-pulse" />
                      <div className="w-5 h-5 rounded bg-slate-100 animate-pulse" />
                    </div>
                  </td>
                </tr>
              ))
            ) : filteredCoaches.length > 0 ? (
              filteredCoaches.map((coach) => (
                <tr
                  key={coach.id}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  {/* Profesor */}
                  <td className="px-6 py-4 align-middle">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
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
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {coach.name}
                        </p>
                        <p className="text-[12px] text-slate-500 truncate mt-0.5">
                          {coach.dni ? `DNI: ${coach.dni}` : (coach.email || coach.phone || 'Sin datos')}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Rol & Especialidad */}
                  <td className="px-6 py-4 align-middle">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {coach.specialization || 'Staff General'}
                      </p>
                      <p className="text-[12px] text-slate-500 line-clamp-1 mt-0.5">
                        {coach.bio || 'Sin descripción'}
                      </p>
                    </div>
                  </td>

                  {/* Alumnos */}
                  <td className="px-6 py-4 align-middle text-center">
                    <button
                      type="button"
                      onClick={() => onViewAthletes?.(coach)}
                      className="text-sm font-semibold text-slate-700 hover:text-blue-600 hover:underline transition-colors"
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
                    <div className="flex items-center justify-end gap-3 text-slate-400">
                      <button
                        type="button"
                        onClick={() => onEdit?.(coach)}
                        className="p-1 hover:text-slate-700 transition-colors"
                        title="Editar"
                      >
                        <Icon name="Pencil" size={16} />
                      </button>

                      {coach.needsActivation && (
                        <button
                          type="button"
                          onClick={() => onEnableAccount?.(coach)}
                          className="p-1 hover:text-amber-600 transition-colors"
                          title="Habilitar acceso"
                        >
                          <Icon name="UserCheck" size={16} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onDelete?.(coach.id)}
                        className="p-1 hover:text-rose-600 transition-colors"
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
                  <p className="text-sm text-slate-500">
                    No hay resultados para la búsqueda o el filtro seleccionado.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Vista mobile (Simplificada y alineada al nuevo diseño) */}
      <div className="md:hidden px-4 py-4 space-y-3 bg-slate-50/50">
        {loading ? (
          [...Array(4)].map((_, index) => (
            <div key={index} className="rounded-xl border border-slate-100 bg-white p-4 space-y-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse" />
              <div className="w-32 h-3 rounded bg-slate-100 animate-pulse" />
              <div className="w-24 h-2 rounded bg-slate-100 animate-pulse" />
            </div>
          ))
        ) : filteredCoaches.length > 0 ? (
          filteredCoaches.map((coach) => (
            <div key={coach.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm">
                    {coach.avatar ? (
                      <Image src={coach.avatar} alt={coach.name} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <span>{getInitials(coach.name)}</span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">{coach.name}</h4>
                    <p className="text-[12px] text-slate-500">{coach.specialization || 'Staff General'}</p>
                  </div>
                </div>
                {renderStatusBadge(coach)}
              </div>
              
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                <button
                  onClick={() => onViewAthletes?.(coach)}
                  className="text-[12px] font-semibold text-slate-600 hover:text-blue-600"
                >
                  {coach.totalAthletes || 0} Alumnos
                </button>
                <div className="flex gap-4 text-slate-400">
                  <button onClick={() => onEdit?.(coach)} className="hover:text-slate-700"><Icon name="Pencil" size={16} /></button>
                  {coach.needsActivation && <button onClick={() => onEnableAccount?.(coach)} className="hover:text-amber-600"><Icon name="UserCheck" size={16} /></button>}
                  <button onClick={() => onDelete?.(coach.id)} className="hover:text-rose-600"><Icon name="Ban" size={16} /></button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-8 text-center text-sm text-slate-500">
            No se encontraron profesores.
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && (
        <div className="px-6 py-4 text-[12px] font-medium text-slate-500 border-t border-slate-100 bg-white">
          Mostrando {filteredCoaches.length} profesor{filteredCoaches.length === 1 ? '' : 'es'}
        </div>
      )}
    </div>
  );
};

export default CoachesTable;