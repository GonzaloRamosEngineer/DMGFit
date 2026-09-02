// Marca de "este atleta entró con la clave por defecto (= su DNI)".
//
// La pone la pantalla de login, que es el único lugar donde se conoce la contraseña
// escrita, y la lee el portal para recomendarle una clave propia (sin obligarlo).
// Vive en sessionStorage: se recalcula en cada ingreso, así que el que la cambia deja
// de ver el aviso y el que no la cambia lo sigue viendo.
//
// Las constantes viven acá y no en el componente para que el login —que carga eager—
// no arrastre PasswordNudge y sus dependencias al bundle principal.

export const CLAVE_POR_DEFECTO_KEY = 'vcfit:clave-por-defecto';
export const CLAVE_ACTUALIZADA_EVENT = 'vcfit:clave-actualizada';
export const CLAVE_DETECTADA_EVENT = 'vcfit:clave-por-defecto-detectada';

// Todos los accesos van envueltos: en navegación privada el storage puede tirar.
export const leerClavePorDefecto = () => {
  try {
    return sessionStorage.getItem(CLAVE_POR_DEFECTO_KEY) === '1';
  } catch {
    return false;
  }
};

export const marcarClavePorDefecto = (esPorDefecto) => {
  try {
    if (esPorDefecto) sessionStorage.setItem(CLAVE_POR_DEFECTO_KEY, '1');
    else sessionStorage.removeItem(CLAVE_POR_DEFECTO_KEY);
  } catch {
    /* storage bloqueado */
  }
  window.dispatchEvent(new Event(CLAVE_DETECTADA_EVENT));
};

export const limpiarClavePorDefecto = () => {
  try {
    sessionStorage.removeItem(CLAVE_POR_DEFECTO_KEY);
  } catch {
    /* storage bloqueado */
  }
  window.dispatchEvent(new Event(CLAVE_ACTUALIZADA_EVENT));
};
