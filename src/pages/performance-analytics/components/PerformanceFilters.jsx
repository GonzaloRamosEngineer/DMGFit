import React from 'react';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const PerformanceFilters = ({ 
  filters, 
  onFilterChange, 
  onReset, 
  onExport,
  loading = false // Para deshabilitar inputs mientras carga
}) => {
  // Opciones estáticas (ideales para empezar)
  const timePeriodOptions = [
    { value: 'week', label: 'Última Semana' },
    { value: 'month', label: 'Último Mes' },
    { value: 'quarter', label: 'Último Trimestre' },
    { value: 'year', label: 'Último Año' },
  ];

  const metricOptions = [
    { value: 'Peso Corporal', label: 'Peso Corporal' },
    { value: 'Sentadilla', label: 'Fuerza (Sentadilla)' },
    // Puedes agregar más según tus datos reales
  ];

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6 mb-4 md:mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 md:mb-6">
        <div className="flex items-center gap-2 md:gap-3">
          <Icon name="Filter" size={20} color="var(--color-primary)" className="md:w-6 md:h-6" />
          <h3 className="text-base md:text-lg font-heading font-semibold text-foreground">
            Filtros de Análisis
          </h3>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={loading}
            iconName="RotateCcw"
            iconPosition="left"
            className="text-xs md:text-sm"
          >
            Restablecer
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onExport}
            disabled={loading}
            iconName="Download"
            iconPosition="left"
            className="text-xs md:text-sm"
          >
            Exportar
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Filtro de Tiempo */}
        <Select
          label="Período de Tiempo"
          options={timePeriodOptions}
          value={filters?.timePeriod || 'month'}
          onChange={(value) => onFilterChange('timePeriod', value)}
          disabled={loading}
          className="w-full"
        />

        {/* Filtro de Métrica */}
        <Select
          label="Métrica Principal"
          options={metricOptions}
          value={filters?.metric || 'Peso Corporal'}
          onChange={(value) => onFilterChange('metric', value)}
          disabled={loading}
          className="w-full"
        />

        {/* Aquí podrías agregar más filtros en el futuro si traes la lista de Coaches de la DB */}
      </div>

      <div className="mt-4 flex items-start gap-2 p-3 bg-accent/10 rounded-lg border border-accent/20">
        <Icon name="Info" size={16} color="var(--color-accent)" className="flex-shrink-0 mt-0.5 md:w-5 md:h-5" />
        <p className="text-xs md:text-sm text-foreground">
          Los datos mostrados reflejan los registros históricos almacenados en la base de datos.
        </p>
      </div>
    </div>
  );
};

export default PerformanceFilters;