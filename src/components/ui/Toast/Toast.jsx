import React from 'react';
import { motion } from 'framer-motion';
import { cva } from 'class-variance-authority';
import { cn } from '../../../utils/cn';
import Icon from '../../AppIcon';

const toastVariants = cva(
  'relative flex items-start gap-3 w-80 max-w-[calc(100vw-2rem)] p-4 rounded-2xl border bg-card shadow-lg',
  {
    variants: {
      variant: {
        success: 'border-success/20',
        error: 'border-error/20',
        warning: 'border-warning/20',
        info: 'border-info/20',
      },
    },
    defaultVariants: { variant: 'info' },
  }
);

const iconConfig = {
  success: { name: 'CheckCircle', cls: 'text-success' },
  error: { name: 'XCircle', cls: 'text-error' },
  warning: { name: 'AlertTriangle', cls: 'text-warning' },
  info: { name: 'Info', cls: 'text-info' },
};

const Toast = ({ id, variant = 'info', title, description, onDismiss }) => {
  const cfg = iconConfig[variant] || iconConfig.info;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.96 }}
      transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(toastVariants({ variant }))}
      role="status"
    >
      <Icon name={cfg.name} size={20} className={cn('shrink-0 mt-0.5', cfg.cls)} />
      <div className="min-w-0 flex-1">
        {title && <p className="text-sm font-bold text-text-primary">{title}</p>}
        {description && <p className="text-sm text-text-secondary break-words">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss?.(id)}
        aria-label="Cerrar"
        className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-text-tertiary hover:bg-muted hover:text-text-primary transition-colors"
      >
        <Icon name="X" size={14} />
      </button>
    </motion.div>
  );
};

export default Toast;
