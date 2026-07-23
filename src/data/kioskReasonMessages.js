export const kioskReasonMessages = {
  OK: 'Acceso permitido.',
  OK_OFF_SCHEDULE: 'Acceso permitido fuera de sus días/horarios asignados.',
  OK_TURNO_FULL: 'Acceso permitido con el turno completo.',
  OK_OVERDUE: 'Acceso permitido con la cuota vencida.',
  OK_GRACE: 'Acceso permitido en período de gracia (cuota vencida).',
  OK_PENDING: 'Acceso permitido con la cuota pendiente de registro.',
  ALREADY_TODAY: 'Ya registró su acceso hoy.',
  DUPLICATE_CHECKIN: 'Ya registraste ingreso para este turno hoy.',
  NO_ASSIGNMENT: 'No tienes una asignación activa para este horario.',
  OUT_OF_WINDOW: 'Estás fuera de la ventana horaria permitida.',
  PAYMENT_BLOCKED: 'Tu cuota está vencida. Regularizá tu pago para ingresar.',
  NO_BALANCE: 'Sin accesos disponibles este mes.',
  NOT_ACTIVE: 'Cuenta inactiva.',
  MISSING_IDENTIFIER: 'No se ingresó DNI o teléfono.',
  USER_NOT_FOUND: 'DNI/teléfono no encontrado en el sistema.',
  ATHLETE_NOT_FOUND: 'No figura como atleta.',
  COACH_NOT_FOUND: 'Perfil de profesor sin registro.'
};

export const defaultKioskErrorMessage = 'No se pudo validar tu acceso en este momento.';
