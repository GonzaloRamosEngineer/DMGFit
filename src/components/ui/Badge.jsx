import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import Icon from '../AppIcon';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wide border whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-muted text-text-secondary border-border',
        primary: 'bg-info-light text-primary border-primary/15',
        success: 'bg-success-light text-success border-success/20',
        warning: 'bg-warning-light text-warning border-warning/20',
        error: 'bg-error-light text-error border-error/20',
        info: 'bg-info-light text-info border-info/20',
      },
      size: {
        sm: 'px-2 py-0.5 text-[10px]',
        md: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
    },
  }
);

const iconSizeMap = { sm: 12, md: 13 };

const Badge = React.forwardRef(
  ({ className, variant, size = 'md', iconName, children, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {iconName && <Icon name={iconName} size={iconSizeMap[size] || 13} strokeWidth={2.5} />}
      {children}
    </span>
  )
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
export default Badge;
