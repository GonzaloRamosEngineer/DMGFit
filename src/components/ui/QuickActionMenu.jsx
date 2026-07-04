import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../AppIcon';
import Button from './Button';

const MENU_WIDTH = 224; // w-56

const QuickActionMenu = ({
  entityId = '',
  entityType = 'athlete',
  availableActions = []
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
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

  const openMenu = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      // Alinea el borde derecho del menú con el del botón, abriendo hacia abajo.
      const left = Math.max(8, rect.right - MENU_WIDTH);
      setCoords({ top: rect.bottom + 8, left });
    }
    setIsOpen(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (menuRef?.current?.contains(event?.target) || triggerRef?.current?.contains(event?.target)) return;
      setIsOpen(false);
    };
    const handleEscape = (event) => {
      if (event?.key === 'Escape') setIsOpen(false);
    };
    // Al scrollear (incluido un contenedor con overflow interno) o redimensionar,
    // cerramos para evitar que el menú quede flotando en una posición vieja.
    const handleReflow = () => setIsOpen(false);

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleReflow, true);
    window.addEventListener('resize', handleReflow);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleReflow, true);
      window.removeEventListener('resize', handleReflow);
    };
  }, [isOpen]);

  const handleActionClick = (action) => {
    console.log(`Action triggered: ${action?.action} for entity: ${entityId}`);
    setIsOpen(false);
  };

  const toggleMenu = () => {
    if (isOpen) setIsOpen(false);
    else openMenu();
  };

  return (
    <div className="relative">
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        onClick={toggleMenu}
        aria-label="Quick actions menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Icon name="MoreVertical" size={20} color="var(--color-foreground)" />
      </Button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: MENU_WIDTH }}
          className="bg-popover border border-border rounded-lg shadow-lg z-dropdown"
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
        </div>,
        document.body
      )}
    </div>
  );
};

export default QuickActionMenu;
