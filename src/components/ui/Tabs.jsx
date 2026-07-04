import React, { createContext, useContext, useId, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';
import Icon from '../AppIcon';

const TabsContext = createContext(null);

const Tabs = ({ value: controlledValue, defaultValue, onValueChange, className, children }) => {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolled;
  const groupId = useId();

  const setValue = (v) => {
    if (!isControlled) setUncontrolled(v);
    onValueChange?.(v);
  };

  return (
    <TabsContext.Provider value={{ value, setValue, groupId }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

const TabsList = ({ className, children }) => (
  <div className={cn('inline-flex items-center gap-1 p-1 rounded-2xl bg-muted', className)} role="tablist">
    {children}
  </div>
);

const TabsTrigger = ({ value, iconName, className, children }) => {
  const ctx = useContext(TabsContext);
  const active = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => ctx.setValue(value)}
      className={cn(
        'relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors',
        active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
        className
      )}
    >
      {active && (
        <motion.span
          layoutId={`tab-indicator-${ctx.groupId}`}
          className="absolute inset-0 rounded-xl bg-card shadow-sm"
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        />
      )}
      <span className="relative z-card flex items-center gap-1.5">
        {iconName && <Icon name={iconName} size={15} />}
        {children}
      </span>
    </button>
  );
};

const TabsContent = ({ value, className, children }) => {
  const ctx = useContext(TabsContext);
  if (ctx.value !== value) return null;
  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
};

export { Tabs, TabsList, TabsTrigger, TabsContent };
export default Tabs;
