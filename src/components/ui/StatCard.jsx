import React from 'react';
import Icon from '../AppIcon';
import { Card } from './Card';
import { Skeleton } from './Skeleton';
import InfoTip from './InfoTip';
import { cn } from '../../utils/cn';

// Tono semántico: colorea SOLO el chip del ícono; el color fuerte queda
// reservado a lo que pide acción (danger también pinta el valor).
const TONES = {
  neutral: { chip: 'bg-info-light text-primary', value: 'text-text-primary' },
  success: { chip: 'bg-success-light text-success', value: 'text-text-primary' },
  warning: { chip: 'bg-warning-light text-warning', value: 'text-text-primary' },
  danger: { chip: 'bg-error-light text-error', value: 'text-error' },
};

// Card de KPI unificada para todas las pantallas: label en lenguaje claro,
// valor grande, subtítulo opcional y burbuja "?" que explica el indicador.
const StatCard = ({
  label,
  value,
  subtitle,
  icon,
  tone = 'neutral',
  info,
  loading = false,
  className,
}) => {
  if (loading) {
    return (
      <Card padding="none" className={cn('p-4 md:p-5', className)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2.5 py-0.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
        </div>
      </Card>
    );
  }

  const tones = TONES[tone] || TONES.neutral;

  return (
    <Card padding="none" className={cn('p-4 md:p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-0.5 mb-1.5">
            <p className="text-xs md:text-sm font-semibold text-text-secondary leading-snug">
              {label}
            </p>
            {info && <InfoTip title={label} text={info} />}
          </div>
          <p className={`text-2xl md:text-3xl font-black tracking-tight leading-none ${tones.value}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-[11px] md:text-xs font-medium text-text-tertiary mt-1.5 leading-snug">
              {subtitle}
            </p>
          )}
        </div>

        {icon && (
          <div className={`w-9 h-9 md:w-10 md:h-10 shrink-0 rounded-xl flex items-center justify-center ${tones.chip}`}>
            <Icon name={icon} size={18} className="md:hidden" />
            <Icon name={icon} size={20} className="hidden md:block" />
          </div>
        )}
      </div>
    </Card>
  );
};

export { StatCard };
export default StatCard;
