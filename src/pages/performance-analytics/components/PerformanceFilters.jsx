import React from 'react';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const PerformanceFilters = ({ 
  filters, 
  onFilterChange, 
  onReset, 
  onExport 
}) => {
  const athleteGroupOptions = [
    { value: 'all', label: 'Todos los Atletas' },
    { value: 'individual', label: 'Individual' },
    { value: 'team', label: 'Equipo' },
    { value: 'facility', label: 'Instalación Completa' }
  ];

  const metricOptions = [
    { value: 'overall', label: 'Rendimiento General' },
    { value: 'strength', label: 'Fuerza' },
    { value: 'endurance', label: 'Resistencia' },
    { value: 'technique', label: 'Técnica' },
    { value: 'speed', label: 'Velocidad' },
    { value: 'flexibility', label: 'Flexibilidad' }
  ];

  const timePeriodOptions = [
    { value: 'week', label: 'Última Semana' },
    { value: 'month', label: 'Último Mes' },
    { value: 'quarter', label: 'Último Trimestre' },
    { value: 'year', label: 'Último Año' },
    { value: 'custom', label: 'Rango Personalizado' }
  ];

  const comparisonOptions = [
    { value: 'athlete-to-athlete', label: 'Atleta vs Atleta' },
    { value: 'period-over-period', label: 'Período vs Período' },
    { value: 'goal-vs-actual', label: 'Meta vs Real' }
  ];

  const coachOptions = [
    { value: 'all', label: 'Todos los Entrenadores' },
    { value: 'coach1', label: 'Carlos Martínez' },
    { value: 'coach2', label: 'Laura Sánchez' },
    { value: 'coach3', label: 'Miguel Torres' }
  ];

  const programOptions = [
    { value: 'all', label: 'Todos los Programas' },
    { value: 'strength', label: 'Programa de Fuerza' },
    { value: 'cardio', label: 'Programa Cardiovascular' },
    { value: 'hiit', label: 'Programa HIIT' },
    { value: 'flexibility', label: 'Programa de Flexibilidad' }
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
            iconName="Download"
            iconPosition="left"
            className="text-xs md:text-sm"
          >
            Exportar
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Select
          label="Grupo de Atletas"
          options={athleteGroupOptions}
          value={filters?.athleteGroup}
          onChange={(value) => onFilterChange('athleteGroup', value)}
          className="w-full"
        />

        <Select
          label="Métrica de Rendimiento"
          options={metricOptions}
          value={filters?.metric}
          onChange={(value) => onFilterChange('metric', value)}
          className="w-full"
        />

        <Select
          label="Período de Tiempo"
          options={timePeriodOptions}
          value={filters?.timePeriod}
          onChange={(value) => onFilterChange('timePeriod', value)}
          className="w-full"
        />

        <Select
          label="Modo de Comparación"
          options={comparisonOptions}
          value={filters?.comparison}
          onChange={(value) => onFilterChange('comparison', value)}
          className="w-full"
        />
      </div>
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2 mb-3 md:mb-4">
          <Icon name="SlidersHorizontal" size={16} color="var(--color-muted-foreground)" className="md:w-5 md:h-5" />
          <span className="text-xs md:text-sm font-medium text-muted-foreground">Filtros Avanzados</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Entrenador"
            options={coachOptions}
            value={filters?.coach}
            onChange={(value) => onFilterChange('coach', value)}
            className="w-full"
          />

          <Select
            label="Programa de Entrenamiento"
            options={programOptions}
            value={filters?.program}
            onChange={(value) => onFilterChange('program', value)}
            className="w-full"
          />
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 p-3 bg-accent/10 rounded-lg border border-accent/20">
        <Icon name="Info" size={16} color="var(--color-accent)" className="flex-shrink-0 mt-0.5 md:w-5 md:h-5" />
        <p className="text-xs md:text-sm text-foreground">
          Los datos se actualizan diariamente a las 00:00. Las métricas de rendimiento se calculan basándose en asistencia, progreso y logros de objetivos.
        </p>
      </div>
    </div>
  );
};

export default PerformanceFilters;