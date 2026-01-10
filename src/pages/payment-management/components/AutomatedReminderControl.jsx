import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import { Checkbox } from '../../../components/ui/Checkbox';

const AutomatedReminderControl = ({ settings, onSettingsChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const frequencyOptions = [
    { value: 'daily', label: 'Diario' },
    { value: 'weekly', label: 'Semanal' },
    { value: 'biweekly', label: 'Quincenal' },
    { value: 'monthly', label: 'Mensual' }
  ];

  const channelOptions = [
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'push', label: 'Notificación Push' }
  ];

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
            <Icon name="Bell" size={20} color="var(--color-warning)" />
          </div>
          <div>
            <h3 className="text-base md:text-lg font-heading font-semibold text-foreground">
              Recordatorios Automáticos
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground">
              {settings?.enabled ? 'Activo' : 'Inactivo'} • {settings?.frequency}
            </p>
          </div>
        </div>
        <Icon
          name={isExpanded ? 'ChevronUp' : 'ChevronDown'}
          size={20}
          color="var(--color-muted-foreground)"
        />
      </div>
      {isExpanded && (
        <div className="mt-6 space-y-4 pt-4 border-t border-border">
          <Checkbox
            label="Habilitar recordatorios automáticos"
            description="Enviar recordatorios de pago automáticamente"
            checked={settings?.enabled}
            onChange={(e) => onSettingsChange({ ...settings, enabled: e?.target?.checked })}
          />

          {settings?.enabled && (
            <>
              <Select
                label="Frecuencia de Recordatorios"
                options={frequencyOptions}
                value={settings?.frequency}
                onChange={(value) => onSettingsChange({ ...settings, frequency: value })}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Canales de Comunicación
                </label>
                <div className="space-y-2">
                  {channelOptions?.map((channel) => (
                    <Checkbox
                      key={channel?.value}
                      label={channel?.label}
                      checked={settings?.channels?.includes(channel?.value)}
                      onChange={(e) => {
                        const newChannels = e?.target?.checked
                          ? [...settings?.channels, channel?.value]
                          : settings?.channels?.filter(c => c !== channel?.value);
                        onSettingsChange({ ...settings, channels: newChannels });
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="default" size="sm" fullWidth>
                  <Icon name="Save" size={16} className="mr-2" />
                  Guardar Configuración
                </Button>
                <Button variant="outline" size="sm" fullWidth>
                  <Icon name="Send" size={16} className="mr-2" />
                  Enviar Ahora
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AutomatedReminderControl;