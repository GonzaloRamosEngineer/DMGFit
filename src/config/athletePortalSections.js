export const DEFAULT_ATHLETE_PORTAL_SECTION = 'inicio';

export const ATHLETE_PORTAL_SECTIONS = [
  {
    id: 'inicio',
    label: 'Inicio',
    icon: 'LayoutDashboard',
    path: '/athlete-portal',
    description: 'Resumen del atleta',
  },
  {
    id: 'cuenta',
    label: 'Cuenta',
    icon: 'BadgeCheck',
    path: '/athlete-portal/cuenta',
    description: 'Membresía y pagos',
  },
  {
    id: 'agenda',
    label: 'Agenda',
    icon: 'CalendarDays',
    path: '/athlete-portal/agenda',
    description: 'Turnos y asistencia',
  },
  {
    id: 'progreso',
    label: 'Progreso',
    icon: 'Activity',
    path: '/athlete-portal/progreso',
    description: 'Métricas y rendimiento',
  },
  {
    id: 'coach',
    label: 'Coach',
    icon: 'MessagesSquare',
    path: '/athlete-portal/coach',
    description: 'Feedback del staff',
  },
  {
    id: 'logros',
    label: 'Logros',
    icon: 'Trophy',
    path: '/athlete-portal/logros',
    description: 'Hitos y recompensas',
  },
];

export const ATHLETE_PORTAL_SECTION_IDS = new Set(
  ATHLETE_PORTAL_SECTIONS.map((section) => section.id)
);
