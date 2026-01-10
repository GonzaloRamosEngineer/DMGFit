import React, { useState, useRef, useEffect } from 'react';
import Icon from '../AppIcon';
import Button from './Button';

const QuickActionMenu = ({
  entityId = '',
  entityType = 'athlete',
  availableActions = []
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  const defaultActions = {
    athlete: [
      { id: 'schedule', label: 'Programar Sesión', icon: 'Calendar', action: 'schedule' },
      { id: 'message', label: 'Enviar Mensaje', icon: 'MessageSquare', action: 'message' },
      { id: 'payment', label: 'Recordatorio de Pago', icon: 'Bell', action: 'payment' },
      { id: 'profile', label: 'Ver Perfil', icon: 'User', action: 'profile' }
    ],
    payment: [
      { id: 'send-reminder', label: 'Enviar Recordatorio', icon: 'Bell', action: 'reminder' },
      { id: 'mark-paid', label: 'Marcar como Pagado', icon: 'CheckCircle', action: 'markPaid' },
      { id: 'view-history', label: 'Ver Historial', icon: 'History', action: 'history' }
    ]
  };

  const actions = availableActions?.length > 0
    ? availableActions
    : defaultActions?.[entityType] || defaultActions?.athlete;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef?.current && !menuRef?.current?.contains(event?.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event?.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleActionClick = (action) => {
    console.log(`Action triggered: ${action?.action} for entity: ${entityId}`);
    setIsOpen(false);
  };

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMenu}
        aria-label="Quick actions menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Icon name="MoreVertical" size={20} color="var(--color-foreground)" />
      </Button>
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-56 bg-popover border border-border rounded-lg shadow-lg z-dropdown"
          role="menu"
          aria-orientation="vertical"
        >
          <div className="py-2">
            {actions?.map((action) => (
              <button
                key={action?.id}
                onClick={() => handleActionClick(action)}
                className="w-full flex items-center px-4 py-3 text-sm text-popover-foreground hover:bg-muted transition-smooth"
                role="menuitem"
              >
                <Icon
                  name={action?.icon}
                  size={18}
                  color="var(--color-primary)"
                  className="mr-3"
                />
                <span>{action?.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickActionMenu;