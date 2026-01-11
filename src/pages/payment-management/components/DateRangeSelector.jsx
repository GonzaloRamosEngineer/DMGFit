import React, { useState } from 'react';
import Select from '../../../components/ui/Select';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const DateRangeSelector = ({ selectedRange, onRangeChange, customDates, onCustomDatesChange, loading = false }) => {
  const [showCustom, setShowCustom] = useState(false);

  const presetOptions = [
    { value: 'thisMonth', label: 'Este Mes' },
    { value: 'lastMonth', label: 'Mes Anterior' },
    { value: 'thisQuarter', label: 'Este Trimestre' },
    { value: 'thisYear', label: 'Este Año' },
    { value: 'custom', label: 'Personalizado' }
  ];

  const handleRangeChange = (value) => {
    onRangeChange(value);
    setShowCustom(value === 'custom');
  };

  return (
    <div className="space-y-3">
      <Select
        label="Período de Facturación"
        options={presetOptions}
        value={selectedRange}
        onChange={handleRangeChange}
        placeholder="Seleccionar período"
        disabled={loading}
      />
      {showCustom && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-muted/50 rounded-lg animate-in fade-in slide-in-from-top-2">
          <Input
            type="date"
            label="Fecha Inicio"
            value={customDates?.start}
            onChange={(e) => onCustomDatesChange({ ...customDates, start: e.target.value })}
            disabled={loading}
          />
          <Input
            type="date"
            label="Fecha Fin"
            value={customDates?.end}
            onChange={(e) => onCustomDatesChange({ ...customDates, end: e.target.value })}
            disabled={loading}
          />
          <div className="col-span-1 md:col-span-2">
            <Button variant="outline" size="sm" fullWidth disabled={loading}>
              <Icon name="Calendar" size={16} className="mr-2" />
              Aplicar Fechas
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangeSelector;