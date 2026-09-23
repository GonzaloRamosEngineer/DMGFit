import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import Button from './Button';

const ConfirmContext = createContext(null);

const DEFAULTS = {
  title: '¿Confirmar acción?',
  message: '',
  confirmLabel: 'Confirmar',
  cancelLabel: 'Cancelar',
  variant: 'default', // 'default' | 'danger'
};

export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState(null); // { ...options }
  const [tick, setTick] = useState(0); // fuerza re-render de un `message` interactivo
  const resolver = useRef(null);

  const confirm = useCallback((options = {}) => {
    setTick(0);
    setState({ ...DEFAULTS, ...options });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={!!state}
        onClose={() => settle(false)}
        size="sm"
        title={state?.title}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => settle(false)}>
              {state?.cancelLabel}
            </Button>
            <Button
              variant={state?.variant === 'danger' ? 'danger' : 'default'}
              onClick={() => settle(true)}
              autoFocus
            >
              {state?.confirmLabel}
            </Button>
          </div>
        }
      >
        {/* `message` acepta tres formas:
            - texto: se envuelve en <p>.
            - contenido propio: para confirmaciones que se leen mejor como filas.
            - función: para diálogos con estado propio (ej. tildar/destildar atletas).
              Se la llama con { rerender } y se vuelve a ejecutar en cada cambio. */}
        {typeof state?.message === 'string' ? (
          state.message && <p className="text-sm text-text-secondary">{state.message}</p>
        ) : typeof state?.message === 'function' ? (
          <React.Fragment key={tick}>
            {state.message({ rerender: () => setTick((t) => t + 1) })}
          </React.Fragment>
        ) : (
          state?.message
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>');
  return ctx.confirm;
};

export default ConfirmProvider;
