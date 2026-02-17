import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const AutomatedReminderControl = ({ settings, onSettingsChange, loading = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Toggle Switch Component
  const Toggle = ({ label, checked, onChange }) => (
    <div className="flex items-center justify-between py-2 cursor-pointer" onClick={() => onChange(!checked)}>
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <div className={`w-10 h-5 flex items-center rounded-full p-1 duration-300 ease-in-out ${checked ? 'bg-green-500' : 'bg-slate-600'}`}>
        <div className={`bg-white w-3 h-3 rounded-full shadow-md transform duration-300 ease-in-out ${checked ? 'translate-x-5' : ''}`}></div>
      </div>
    </div>
  );

  const ChannelCheckbox = ({ label, value, checked, onChange }) => (
    <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
      checked ? 'bg-blue-600/20 border-blue-500/50 text-blue-200' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
    }`}>
      <input 
        type="checkbox" 
        className="hidden" 
        checked={checked} 
        onChange={(e) => onChange(e.target.checked)} 
      />
      <Icon name={value === 'whatsapp' ? 'MessageCircle' : value === 'email' ? 'Mail' : 'Smartphone'} size={14} />
      <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
    </label>
  );

  if (loading) return <div className="h-24 bg-slate-800 rounded-2xl animate-pulse"></div>;

  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden transition-all duration-300">
      
      {/* Header (Always Visible) */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-700/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${settings?.enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
             <Icon name="Zap" size={18} />
          </div>
          <div>
             <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-0.5">Automatización</p>
             <p className="text-sm font-bold text-white">Recordatorios de Pago</p>
          </div>
        </div>
        <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-slate-500" />
      </div>

      {/* Expanded Controls */}
      {isExpanded && (
        <div className="p-4 border-t border-slate-700/50 space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
          
          <Toggle 
            label="Activar Envío Automático" 
            checked={settings?.enabled} 
            onChange={(val) => onSettingsChange({ ...settings, enabled: val })} 
          />

          {settings?.enabled && (
            <>
              {/* Frequency Selector */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Frecuencia</label>
                <select 
                  value={settings?.frequency}
                  onChange={(e) => onSettingsChange({ ...settings, frequency: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                >
                  <option value="daily">Diario (Agresivo)</option>
                  <option value="weekly">Semanal (Recomendado)</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>

              {/* Channels */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Canales</label>
                <div className="grid grid-cols-2 gap-2">
                  {['email', 'whatsapp'].map(ch => (
                    <ChannelCheckbox 
                      key={ch} 
                      value={ch} 
                      label={ch} 
                      checked={settings?.channels?.includes(ch)}
                      onChange={(checked) => {
                        const newCh = checked 
                          ? [...(settings.channels || []), ch]
                          : settings.channels.filter(c => c !== ch);
                        onSettingsChange({ ...settings, channels: newCh });
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-lg shadow-blue-900/20">
                  Guardar
                </button>
                <button className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-bold transition-colors">
                  <Icon name="Send" size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AutomatedReminderControl;