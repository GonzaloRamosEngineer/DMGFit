import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const BulkActionsBar = ({ selectedCount, onAction, onClearSelection }) => {
  if (selectedCount === 0) return null;

  const bulkActions = [
    { id: 'message', label: 'Enviar Mensaje', icon: 'MessageSquare' },
    { id: 'schedule', label: 'Programar Sesión', icon: 'Calendar' },
    { id: 'payment', label: 'Recordatorio de Pago', icon: 'Bell' },
    { id: 'export', label: 'Exportar Selección', icon: 'Download' },
    { id: 'assign', label: 'Asignar Entrenador', icon: 'UserPlus' }
  ];

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-4xl px-4">
      <div className="bg-card border border-primary rounded-lg shadow-glow-primary p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon name="CheckSquare" size={20} color="var(--color-primary)" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {selectedCount} {selectedCount === 1 ? 'atleta seleccionado' : 'atletas seleccionados'}
              </p>
              <p className="text-xs text-muted-foreground">Elige una acción para aplicar</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:ml-auto">
            {bulkActions?.map((action) => (
              <Button
                key={action?.id}
                variant="outline"
                size="sm"
                onClick={() => onAction(action?.id)}
                iconName={action?.icon}
                iconPosition="left"
                className="flex-shrink-0"
              >
                <span className="hidden sm:inline">{action?.label}</span>
              </Button>
            ))}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              iconName="X"
              className="flex-shrink-0"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkActionsBar;