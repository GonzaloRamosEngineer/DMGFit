import React from 'react';
import { cn } from '../../utils/cn';
import Icon from '../AppIcon';

const EmptyState = ({
  iconName = 'Inbox',
  title,
  description,
  action,
  className,
  ...props
}) => (
  <div
    className={cn('flex flex-col items-center justify-center text-center px-6 py-12', className)}
    {...props}
  >
    <div className="w-14 h-14 rounded-full bg-muted text-text-tertiary flex items-center justify-center mb-4">
      <Icon name={iconName} size={26} />
    </div>
    {title && <p className="text-base font-bold text-text-primary">{title}</p>}
    {description && <p className="text-sm text-text-secondary mt-1 max-w-sm">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export { EmptyState };
export default EmptyState;
