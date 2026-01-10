import React from 'react';

const AlertBadge = ({ count = 0, severity = 'warning', position = 'right' }) => {
  if (count === 0) return null;

  const severityStyles = {
    critical: 'bg-error text-error-foreground',
    warning: 'bg-warning text-warning-foreground',
    info: 'bg-accent text-accent-foreground'
  };

  const positionStyles = {
    right: 'absolute -top-1 -right-1',
    left: 'absolute -top-1 -left-1',
    inline: 'ml-auto'
  };

  const displayCount = count > 99 ? '99+' : count;

  return (
    <span
      className={`
        ${positionStyles?.[position]}
        ${severityStyles?.[severity]}
        inline-flex items-center justify-center
        min-w-[20px] h-5 px-1.5
        text-xs font-medium font-data
        rounded-full
        transition-smooth
        z-card
      `}
      aria-label={`${count} notifications`}
    >
      {displayCount}
    </span>
  );
};

export default AlertBadge;