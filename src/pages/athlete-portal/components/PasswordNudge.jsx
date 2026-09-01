import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../../components/AppIcon';

// Aviso (no bloqueante) para el atleta que sigue usando la clave con la que nació
// su cuenta: su propio DNI. No se obliga a cambiarla — se recomienda.
//
// Cómo se sabe: el DNI es público (se dicta en el kiosco), así que una clave igual
// al DNI no protege nada. La marca la deja la pantalla de login, que es el único
// lugar donde se conoce la contraseña escrita. Al cambiarla, el aviso desaparece
// solo y no vuelve mientras la clave sea propia.

export const CLAVE_POR_DEFECTO_KEY = 'vcfit:clave-por-defecto';
export const CLAVE_ACTUALIZADA_EVENT = 'vcfit:clave-actualizada';

const leerFlag = () => {
  try {
    return sessionStorage.getItem(CLAVE_POR_DEFECTO_KEY) === '1';
  } catch {
    return false;
  }
};

const PasswordNudge = ({ enCuenta = false }) => {
  const [visible, setVisible] = useState(leerFlag);

  useEffect(() => {
    const ocultar = () => setVisible(false);
    window.addEventListener(CLAVE_ACTUALIZADA_EVENT, ocultar);
    return () => window.removeEventListener(CLAVE_ACTUALIZADA_EVENT, ocultar);
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
