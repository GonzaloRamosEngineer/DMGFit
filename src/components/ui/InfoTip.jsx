import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../AppIcon';

const TIP_WIDTH = 264;

// Burbuja de ayuda "?" para explicar un indicador en lenguaje llano.
// Popover por portal con posición fija (los layouts una-pantalla tienen
// contenedores con overflow interno que recortarían un absolute).
// Desktop: abre por hover/focus; touch: tap abre, tap/click afuera/ESC cierra.
const InfoTip = ({ title, text }) => {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, above: false });
  const triggerRef = useRef(null);
  const tipRef = useRef(null);

  const openTip = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const left = Math.min(
        Math.max(8, rect.left + rect.width / 2 - TIP_WIDTH / 2),
        window.innerWidth - TIP_WIDTH - 8
      );
      // Si no hay ~150px libres abajo, abre hacia arriba.
      const above = rect.bottom + 150 > window.innerHeight;
      setCoords({
        top: above ? window.innerHeight - rect.top + 8 : rect.bottom + 8,
        left,
        above,
      });
    }
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setPinned(false);
  }, []);

  const handleClick = () => {
    if (pinned) {
      close();
    } else {
      openTip();
      setPinned(true);
    }
  };

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event) => {
      if (tipRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)) return;
      close();
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') close();
    };
    const handleReflow = () => close();

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleReflow, true);
    window.addEventListener('resize', handleReflow);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleReflow, true);
      window.removeEventListener('resize', handleReflow);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleClick}
        onMouseEnter={() => !open && openTip()}
        onMouseLeave={() => !pinned && setOpen(false)}
        onFocus={() => !open && openTip()}
        onBlur={() => !pinned && setOpen(false)}
        aria-label={`¿Qué significa ${title || 'este indicador'}?`}
        aria-expanded={open}
        className="p-2 -m-2 shrink-0 rounded-full text-text-tertiary hover:text-primary focus-visible:text-primary focus-visible:outline-none transition-colors"
      >
        <Icon name="HelpCircle" size={15} strokeWidth={2.25} />
      </button>

      {open && createPortal(
        <div
          ref={tipRef}
          role="tooltip"
          style={{
            position: 'fixed',
            left: coords.left,
            width: TIP_WIDTH,
            ...(coords.above ? { bottom: coords.top } : { top: coords.top }),
          }}
          className="bg-popover border border-border rounded-2xl shadow-lg p-4 z-dropdown"
        >
          {title && (
            <p className="text-xs font-bold text-text-primary mb-1">{title}</p>
          )}
          <p className="text-xs text-text-secondary leading-relaxed">{text}</p>
        </div>,
        document.body
      )}
    </>
  );
};

export { InfoTip };
export default InfoTip;
