import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const SearchAndFilters = ({ onSearch, onFilterChange, onBulkAction, loading = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState({
    coach: '',
    performanceTier: '',
    paymentStatus: '',
    status: 'active',
    attendanceRange: ''
  });

  const performanceTierOptions = [
    { value: '', label: 'Todos los Niveles' },
    { value: 'elite', label: 'Elite (90-100%)' },
    { value: 'advanced', label: 'Avanzado (75-89%)' },
    { value: 'intermediate', label: 'Intermedio (60-74%)' },
    { value: 'beginner', label: 'Principiante (<60%)' }
  ];

  const paymentStatusOptions = [
    { value: '', label: 'Todos los Estados' },
    { value: 'paid', label: 'Pagado' },
    { value: 'pending', label: 'Pendiente' },
    { value: 'overdue', label: 'Vencido' }
  ];


  const statusOptions = [
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Inactivos' },
    { value: 'all', label: 'Todos' }
  ];

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    onSearch(value);
  };

  const handleFilterChange = (filterName, value) => {
    const newFilters = { ...filters, [filterName]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      coach: '',
      performanceTier: '',
      paymentStatus: '',
      status: 'active',
      attendanceRange: ''
    };
    setFilters(clearedFilters);
    setSearchQuery('');
    onFilterChange(clearedFilters);
    onSearch('');
  };

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => value !== '' && !(key === 'status' && value === 'active')).length;

  return (
    <div className="bg-white/90 backdrop-blur-md border border-slate-200/60 rounded-[2rem] p-4 shadow-sm mb-6 transition-all">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        
        {/* Buscador */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Icon name="Search" size={18} className="text-slate-400" />
          </div>
          <input
            type="search"
            placeholder="Buscar atletas por nombre o email..."
            value={searchQuery}
            onChange={handleSearchChange}
            disabled={loading}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-2xl text-slate-800 placeholder-slate-400 focus:ring-4 focus:ring-blue-500/10 outline-none font-medium transition-all"
          />
        </div>
        
        {/* Botones de Acción */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            disabled={loading}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all border ${
              showAdvancedFilters || activeFilterCount > 0
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            <Icon name="Filter" size={16} />
            Filtros {activeFilterCount > 0 && <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-xs">{activeFilterCount}</span>}
          </button>
          
          {(activeFilterCount > 0 || searchQuery) && (
            <button
              onClick={handleClearFilters}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition-all"
            >
              <Icon name="X" size={16} />
              Limpiar
            </button>
          )}
          
          <button
            onClick={() => onBulkAction('export')}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all ml-auto lg:ml-0"
          >
            <Icon name="Download" size={16} />
            Exportar
          </button>
        </div>
      </div>

      {/* Filtros Avanzados */}
      {showAdvancedFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300">
          
          {/* Select: Nivel de Rendimiento */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
              Nivel de Rendimiento
            </label>
            <select
              value={filters.performanceTier}
              onChange={(e) => handleFilterChange('performanceTier', e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium appearance-none cursor-pointer"
            >
              {performanceTierOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          
          {/* Select: Estado de Pago */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
              Estado de Pago
            </label>
            <select
              value={filters.paymentStatus}
              onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium appearance-none cursor-pointer"
            >
              {paymentStatusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Select: Estado del Atleta */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
              Estado del Atleta
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium appearance-none cursor-pointer"
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Espacio para futuros filtros (ej: Entrenador) */}
          <div className="flex flex-col gap-1.5 opacity-50 pointer-events-none">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
              Entrenador (Próximamente)
            </label>
            <select disabled className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 font-medium appearance-none">
              <option>Todos los entrenadores</option>
            </select>
          </div>
          
        </div>
      )}
    </div>
  );
};

export default SearchAndFilters;