import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';
import Icon from '../AppIcon';

const sizeMap = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw]',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

const Modal = ({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  footer,
  hideClose = false,
  closeOnOverlay = true,
  closeOnEsc = true,
  className,
  children,
}) => {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Enfocar el panel al abrir.
    const t = setTimeout(() => panelRef.current?.focus(), 0);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && closeOnEsc) {
        onClose?.();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const nodes = panelRef.current.querySelectorAll(FOCUSABLE);
        if (nodes.length === 0) {
          e.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, closeOnEsc, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-foreground/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeOnOverlay ? onClose : undefined}
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title || undefined}
            className={cn(
              'relative w-full bg-card text-card-foreground rounded-3xl shadow-2xl outline-none flex flex-col max-h-[90vh]',
              sizeMap[size] || sizeMap.md,
              className
            )}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {(title || !hideClose) && (
              <div className="flex items-start justify-between gap-4 p-6 pb-4 border-b border-border">
                <div className="min-w-0">
                  {title && <h3 className="text-lg font-bold tracking-tight text-text-primary truncate">{title}</h3>}
                  {subtitle && <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>}
                </div>
                {!hideClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Cerrar"
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-text-secondary hover:bg-muted hover:text-text-primary transition-colors"
                  >
                    <Icon name="X" size={18} />
                  </button>
                )}
              </div>
            )}

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">{children}</div>

            {footer && <div className="p-6 pt-4 border-t border-border">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export { Modal };
export default Modal;
