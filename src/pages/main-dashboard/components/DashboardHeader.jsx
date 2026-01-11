import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

const DashboardHeader = ({ 
  onDateRangeChange, 
  onRefreshToggle, 
  autoRefresh = false,
  lastUpdated 
}) => {
  const [selectedFacility, setSelectedFacility] = useState('all');
  const [selectedRange, setSelectedRange] = useState('today');

  const facilityOptions = [
    { value: 'all', label: 'Todas las Instalaciones' },
    { value: 'central', label: 'Centro Principal' },
    { value: 'norte', label: 'Sucursal Norte' },
    { value: 'sur', label: 'Sucursal Sur' }
  ];

  const dateRangeOptions = [
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Esta Semana' },
    { value: 'month', label: 'Este Mes' },
    { value: 'quarter', label: 'Este Trimestre' }
  ];

  const handleRangeChange = (value) => {
    setSelectedRange(value);
    if (onDateRangeChange) {
      onDateRangeChange(value);
    }
  };

  const formatLastUpdated = (timestamp) => {
    if (!timestamp) return 'Nunca';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6 mb-4 md:mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold text-foreground mb-2">
            Panel de Control
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Monitoreo en tiempo real de rendimiento y asistencia
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-3">
          <Select
            options={facilityOptions}
            value={selectedFacility}
            onChange={setSelectedFacility}
            placeholder="Seleccionar instalación"
            className="w-full sm:w-48"
          />

          <Select
            options={dateRangeOptions}
            value={selectedRange}
            onChange={handleRangeChange}
            placeholder="Rango de fecha"
            className="w-full sm:w-40"
          />

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="default"
              iconName="RefreshCw"
              iconPosition="left"
              onClick={onRefreshToggle}
              className="flex-1 sm:flex-none"
            >
              Auto-actualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-success animate-pulse' : 'bg-muted'}`}></div>
          <span className="text-xs text-muted-foreground">
            {autoRefresh ? 'Actualización automática activa' : 'Actualización manual'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Icon name="Clock" size={14} color="var(--color-muted-foreground)" />
          <span className="text-xs text-muted-foreground">
            Última actualización: {formatLastUpdated(lastUpdated)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;