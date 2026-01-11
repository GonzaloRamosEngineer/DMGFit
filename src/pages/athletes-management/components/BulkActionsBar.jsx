import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const BulkActionsBar = ({ selectedCount, onAction, onClearSelection }) => {
  if (!selectedCount || selectedCount === 0) return null;

  const bulkActions = [
    { id: 'message', label: 'Mensaje', icon: 'MessageSquare' },
    { id: 'schedule', label: 'Programar', icon: 'Calendar' },
    { id: 'payment', label: 'Recordatorio', icon: 'Bell' },
    { id: 'export', label: 'Exportar', icon: 'Download' }
  ];

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-4xl px-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-primary/50 rounded-xl shadow-glow-primary p-4 backdrop-blur-md bg-opacity-95">
        <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              {selectedCount}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Seleccionados
              </p>
              <button 
                onClick={onClearSelection}
                className="text-xs text-muted-foreground hover:text-primary underline transition-colors"
              >
                Desmarcar todo
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            {bulkActions.map((action) => (
              <Button
                key={action.id}
                variant="outline"
                size="sm"
                onClick={() => onAction(action.id)}
                iconName={action.icon}
                className="flex-shrink-0"
              >
                <span className="hidden sm:inline">{action.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkActionsBar;