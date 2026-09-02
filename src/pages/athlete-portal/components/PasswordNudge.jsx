import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import {
  CLAVE_ACTUALIZADA_EVENT,
  CLAVE_DETECTADA_EVENT,
  leerClavePorDefecto,
} from '../../../utils/clavePorDefecto';

// Aviso (no bloqueante) para el atleta que sigue usando la clave con la que nació
// su cuenta: su propio DNI. No se obliga a cambiarla — se recomienda.
//
// Cómo se sabe: el DNI es público (se dicta en el kiosco), así que una clave igual
// al DNI no protege nada. La marca la deja la pantalla de login, que es el único
// lugar donde se conoce la contraseña escrita. Al cambiarla, el aviso desaparece
// solo y no vuelve mientras la clave sea propia.

const PasswordNudge = ({ enCuenta = false }) => {
  const [visible, setVisible] = useState(leerClavePorDefecto);

  useEffect(() => {
    const ocultar = () => setVisible(false);
    // Red de seguridad por si la marca llega DESPUÉS del montaje: el login redirige
    // apenas cambia la sesión, así que el orden entre "poner la marca" y "montar el
    // portal" no está garantizado. Releer acá cubre ese caso sin depender del timing.
    const releer = () => setVisible(leerClavePorDefecto());

    window.addEventListener(CLAVE_ACTUALIZADA_EVENT, ocultar);
    window.addEventListener(CLAVE_DETECTADA_EVENT, releer);
    releer();

    return () => {
      window.removeEventListener(CLAVE_ACTUALIZADA_EVENT, ocultar);
      window.removeEventListener(CLAVE_DETECTADA_EVENT, releer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900">
      <Icon name="KeyRound" size={18} className="shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">Tu contraseña sigue siendo tu DNI.</p>
        <p className="text-xs font-semibold opacity-80">
          {enCuenta
            ? 'Te recomendamos ponerte una propia con el botón "Contraseña", acá abajo.'
            : 'Te recomendamos ponerte una propia: tu DNI lo conoce cualquiera que te haya visto fichar.'}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!enCuenta && (
          <Link
            to="/athlete-portal/cuenta"
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Cambiarla
          </Link>
        )}
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
        >
          Ahora no
        </button>
      </div>
    </div>
  );
};

export default PasswordNudge;
