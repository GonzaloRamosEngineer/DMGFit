import React, { useState } from 'react';

import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';

const SearchAndFilters = ({ onSearch, onFilterChange, onBulkAction }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState({
    coach: '',
    performanceTier: '',
    paymentStatus: '',
    attendanceRange: ''
  });

  const coachOptions = [
    { value: '', label: 'Todos los Entrenadores' },
    { value: 'coach1', label: 'Carlos Martínez' },
    { value: 'coach2', label: 'Ana García' },
    { value: 'coach3', label: 'Luis Rodríguez' },
    { value: 'coach4', label: 'María López' }
  ];

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

  const attendanceRangeOptions = [
    { value: '', label: 'Todas las Asistencias' },
    { value: 'excellent', label: 'Excelente (>90%)' },
    { value: 'good', label: 'Buena (75-90%)' },
    { value: 'fair', label: 'Regular (60-74%)' },
    { value: 'poor', label: 'Baja (<60%)' }
  ];

  const handleSearchChange = (e) => {
    const value = e?.target?.value;
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
      attendanceRange: ''
    };
    setFilters(clearedFilters);
    setSearchQuery('');
    onFilterChange(clearedFilters);
    onSearch('');
  };

  const activeFilterCount = Object.values(filters)?.filter(v => v !== '')?.length;

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6 mb-6 md:mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-4">
        <div className="flex-1">
          <Input
            type="search"
            placeholder="Buscar atletas por nombre, email o ID..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <Button
            variant={showAdvancedFilters ? 'default' : 'outline'}
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            iconName="Filter"
            iconPosition="left"
            className="flex-shrink-0"
          >
            Filtros {activeFilterCount > 0 && `(${activeFilterCount})`}
          </Button>
          
          <Button
            variant="outline"
            onClick={handleClearFilters}
            iconName="X"
            iconPosition="left"
            className="flex-shrink-0"
          >
            Limpiar
          </Button>
          
          <Button
            variant="outline"
            onClick={() => onBulkAction('export')}
            iconName="Download"
            iconPosition="left"
            className="flex-shrink-0"
          >
            Exportar
          </Button>
        </div>
      </div>
      {showAdvancedFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-border">
          <Select
            label="Entrenador"
            options={coachOptions}
            value={filters?.coach}
            onChange={(value) => handleFilterChange('coach', value)}
          />
          
          <Select
            label="Nivel de Rendimiento"
            options={performanceTierOptions}
            value={filters?.performanceTier}
            onChange={(value) => handleFilterChange('performanceTier', value)}
          />
          
          <Select
            label="Estado de Pago"
            options={paymentStatusOptions}
            value={filters?.paymentStatus}
            onChange={(value) => handleFilterChange('paymentStatus', value)}
          />
          
          <Select
            label="Rango de Asistencia"
            options={attendanceRangeOptions}
            value={filters?.attendanceRange}
            onChange={(value) => handleFilterChange('attendanceRange', value)}
          />
        </div>
      )}
    </div>
  );
};

export default SearchAndFilters;