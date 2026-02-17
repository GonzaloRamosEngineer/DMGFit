import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const DateRangeSelector = ({ selectedRange, onRangeChange, customDates, onCustomDatesChange, loading = false }) => {
  const isCustom = selectedRange === 'custom';

  const presetOptions = [
    { value: 'thisMonth', label: 'Este Mes' },
    { value: 'lastMonth', label: 'Mes Anterior' },
    { value: 'thisQuarter', label: 'Trimestre Actual' },
    { value: 'thisYear', label: 'Año Actual' },
    { value: 'custom', label: 'Personalizado...' }
  ];

  return (
    <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto bg-white p-1 rounded-2xl border border-slate-100 shadow-sm">
      
      {/* Dropdown Principal */}
      <div className="relative group w-full sm:w-48">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
           <Icon name="Calendar" size={16} />
        </div>
        <select
          value={selectedRange}
          onChange={(e) => onRangeChange(e.target.value)}
          disabled={loading}
          className="w-full bg-transparent pl-9 pr-8 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 outline-none appearance-none cursor-pointer hover:bg-slate-50 rounded-xl transition-colors h-10"
        >
          {presetOptions.map(opt => (
            <option key={opt.value} value={opt.value} className="text-slate-900 bg-white">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-blue-500 transition-colors">
           <Icon name="ChevronDown" size={14} />
        </div>
      </div>

      {/* Inputs Personalizados (Animación de aparición) */}
      {isCustom && (
        <div className="flex items-center gap-2 animate-fade-in pl-2 border-l border-slate-100 w-full sm:w-auto overflow-x-auto">
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Desde</span>
            <input
              type="date"
              value={customDates?.start}
              onChange={(e) => onCustomDatesChange({ ...customDates, start: e.target.value })}
              disabled={loading}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none w-24 p-1"
            />
          </div>
          <Icon name="ArrowRight" size={12} className="text-slate-300" />
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Hasta</span>
            <input
              type="date"
              value={customDates?.end}
              onChange={(e) => onCustomDatesChange({ ...customDates, end: e.target.value })}
              disabled={loading}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none w-24 p-1"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangeSelector;