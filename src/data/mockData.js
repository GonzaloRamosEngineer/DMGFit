// Centralized Mock Data for Multi-Role Platform

export const mockPlans = [
  {
    id: 'PLAN-001',
    name: 'Plan Elite',
    description: 'Entrenamiento personalizado de alto rendimiento con seguimiento individual',
    price: 150,
    capacity: 15,
    enrolled: 12,
    schedule: [
      { day: 'Lunes', time: '08:00 - 09:30' },
      { day: 'Miércoles', time: '08:00 - 09:30' },
      { day: 'Viernes', time: '08:00 - 09:30' }
    ],
    professors: ['Ana García', 'Carlos Martínez'],
    status: 'active',
    features: ['Entrenamiento personalizado', 'Nutrición incluida', 'Seguimiento semanal']
  },
  {
    id: 'PLAN-002',
    name: 'Plan Avanzado',
    description: 'Entrenamiento en grupo reducido con objetivos específicos',
    price: 90,
    capacity: 25,
    enrolled: 23,
    schedule: [
      { day: 'Martes', time: '10:00 - 11:00' },
      { day: 'Jueves', time: '10:00 - 11:00' },
      { day: 'Sábado', time: '09:00 - 10:00' }
    ],
    professors: ['Luis Rodríguez'],
    status: 'active',
    features: ['Grupos reducidos', 'Plan de entrenamiento', 'Evaluación mensual']
  },
  {
    id: 'PLAN-003',
    name: 'Plan Básico',
    description: 'Entrenamiento grupal para principiantes y mantenimiento',
    price: 50,
    capacity: 40,
    enrolled: 35,
    schedule: [
      { day: 'Lunes', time: '18:00 - 19:00' },
      { day: 'Miércoles', time: '18:00 - 19:00' },
      { day: 'Viernes', time: '18:00 - 19:00' }
    ],
    professors: ['María López', 'Pedro Sánchez'],
    status: 'active',
    features: ['Clases grupales', 'Acceso a instalaciones', 'Evaluación inicial']
  }
];

export const mockEnrollments = [
  { id: 'ENR-001', athleteId: 'ATH001', planId: 'PLAN-001', enrollmentDate: '2024-03-15', status: 'active' },
  { id: 'ENR-002', athleteId: 'ATH002', planId: 'PLAN-002', enrollmentDate: '2024-04-01', status: 'active' },
  { id: 'ENR-003', athleteId: 'ATH003', planId: 'PLAN-003', enrollmentDate: '2024-05-10', status: 'active' },
  { id: 'ENR-004', athleteId: 'ATH004', planId: 'PLAN-002', enrollmentDate: '2024-02-20', status: 'inactive' },
  { id: 'ENR-005', athleteId: 'ATH005', planId: 'PLAN-001', enrollmentDate: '2024-03-25', status: 'active' },
  { id: 'ENR-006', athleteId: 'ATH006', planId: 'PLAN-001', enrollmentDate: '2024-06-01', status: 'active' },
  { id: 'ENR-007', athleteId: 'ATH007', planId: 'PLAN-003', enrollmentDate: '2024-04-15', status: 'active' },
  { id: 'ENR-008', athleteId: 'ATH008', planId: 'PLAN-002', enrollmentDate: '2024-05-20', status: 'active' }
];

export const mockAttendance = [
  { id: 'ATT-001', athleteId: 'ATH001', sessionId: 'SES-001', date: '2026-01-06', status: 'present' },
  { id: 'ATT-002', athleteId: 'ATH001', sessionId: 'SES-002', date: '2026-01-08', status: 'present' },
  { id: 'ATT-003', athleteId: 'ATH001', sessionId: 'SES-003', date: '2026-01-10', status: 'present' },
  { id: 'ATT-004', athleteId: 'ATH002', sessionId: 'SES-004', date: '2026-01-07', status: 'present' },
  { id: 'ATT-005', athleteId: 'ATH002', sessionId: 'SES-005', date: '2026-01-09', status: 'absent' },
  { id: 'ATT-006', athleteId: 'ATH003', sessionId: 'SES-006', date: '2026-01-06', status: 'late' },
  { id: 'ATT-007', athleteId: 'ATH005', sessionId: 'SES-001', date: '2026-01-06', status: 'present' },
  { id: 'ATT-008', athleteId: 'ATH006', sessionId: 'SES-002', date: '2026-01-08', status: 'present' }
];

export const mockMetrics = [
  { id: 'MET-001', name: 'Fuerza', unit: 'kg', athleteId: 'ATH001', value: 87, date: '2026-01-10', trend: 'up' },
  { id: 'MET-002', name: 'Resistencia', unit: 'min', athleteId: 'ATH001', value: 45, date: '2026-01-10', trend: 'up' },
  { id: 'MET-003', name: 'Velocidad', unit: 'km/h', athleteId: 'ATH001', value: 18, date: '2026-01-10', trend: 'stable' },
  { id: 'MET-004', name: 'Fuerza', unit: 'kg', athleteId: 'ATH002', value: 75, date: '2026-01-09', trend: 'up' },
  { id: 'MET-005', name: 'Resistencia', unit: 'min', athleteId: 'ATH002', value: 50, date: '2026-01-09', trend: 'up' },
  { id: 'MET-006', name: 'Fuerza', unit: 'kg', athleteId: 'ATH005', value: 95, date: '2026-01-10', trend: 'up' }
];

export const mockSessions = [
  {
    id: 'SES-001',
    planId: 'PLAN-001',
    date: '2026-01-06',
    time: '08:00 - 09:30',
    professor: 'Ana García',
    type: 'Entrenamiento de Fuerza',
    location: 'Sala Principal',
    attendees: ['ATH001', 'ATH005', 'ATH006'],
    status: 'completed'
  },
  {
    id: 'SES-002',
    planId: 'PLAN-001',
    date: '2026-01-08',
    time: '08:00 - 09:30',
    professor: 'Ana García',
    type: 'Cardio Intensivo',
    location: 'Sala Principal',
    attendees: ['ATH001', 'ATH006'],
    status: 'completed'
  },
  {
    id: 'SES-003',
    planId: 'PLAN-001',
    date: '2026-01-10',
    time: '08:00 - 09:30',
    professor: 'Ana García',
    type: 'Entrenamiento Funcional',
    location: 'Sala Principal',
    attendees: ['ATH001', 'ATH005'],
    status: 'completed'
  },
  {
    id: 'SES-004',
    planId: 'PLAN-002',
    date: '2026-01-07',
    time: '10:00 - 11:00',
    professor: 'Luis Rodríguez',
    type: 'Entrenamiento de Resistencia',
    location: 'Sala Cardio',
    attendees: ['ATH002', 'ATH008'],
    status: 'completed'
  },
  {
    id: 'SES-005',
    planId: 'PLAN-002',
    date: '2026-01-09',
    time: '10:00 - 11:00',
    professor: 'Luis Rodríguez',
    type: 'Circuito de Fuerza',
    location: 'Sala Cardio',
    attendees: ['ATH008'],
    status: 'completed'
  }
];

export const mockNotes = [
  {
    id: 'NOTE-001',
    athleteId: 'ATH001',
    professorId: 'PROF-001',
    professorName: 'Ana García',
    content: 'Excelente progreso en fuerza. Continuar con el plan actual.',
    date: '2026-01-08',
    type: 'positive',
    sessionId: 'SES-002'
  },
  {
    id: 'NOTE-002',
    athleteId: 'ATH001',
    professorId: 'PROF-001',
    professorName: 'Ana García',
    content: 'Mejorar técnica en sentadillas. Practicar con peso ligero.',
    date: '2026-01-05',
    type: 'improvement',
    sessionId: null
  },
  {
    id: 'NOTE-003',
    athleteId: 'ATH002',
    professorId: 'PROF-002',
    professorName: 'Luis Rodríguez',
    content: 'Buen rendimiento en cardio. Aumentar intensidad gradualmente.',
    date: '2026-01-07',
    type: 'positive',
    sessionId: 'SES-004'
  },
  {
    id: 'NOTE-004',
    athleteId: 'ATH005',
    professorId: 'PROF-001',
    professorName: 'Ana García',
    content: 'Rendimiento excepcional. Considerar plan de competición.',
    date: '2026-01-10',
    type: 'positive',
    sessionId: 'SES-003'
  }
];

export const mockProfessors = [
  {
    id: 'PROF-001',
    name: 'Ana García',
    email: 'ana.garcia@digitalmatch.com',
    specialization: 'Entrenamiento de Fuerza',
    plans: ['PLAN-001'],
    athletes: ['ATH001', 'ATH005', 'ATH006']
  },
  {
    id: 'PROF-002',
    name: 'Luis Rodríguez',
    email: 'luis.rodriguez@digitalmatch.com',
    specialization: 'Resistencia y Cardio',
    plans: ['PLAN-002'],
    athletes: ['ATH002', 'ATH008']
  },
  {
    id: 'PROF-003',
    name: 'Carlos Martínez',
    email: 'carlos.martinez@digitalmatch.com',
    specialization: 'Entrenamiento Funcional',
    plans: ['PLAN-001'],
    athletes: ['ATH001', 'ATH006']
  },
  {
    id: 'PROF-004',
    name: 'María López',
    email: 'maria.lopez@digitalmatch.com',
    specialization: 'Fitness General',
    plans: ['PLAN-003'],
    athletes: ['ATH003', 'ATH007']
  }
];

// Helper functions to get related data
export const getAthletesByProfessor = (professorName) => {
  const professor = mockProfessors?.find(p => p?.name === professorName);
  return professor?.athletes || [];
};

export const getPlansByProfessor = (professorName) => {
  const professor = mockProfessors?.find(p => p?.name === professorName);
  return mockPlans?.filter(plan => professor?.plans?.includes(plan?.id));
};

export const getAthleteEnrollment = (athleteId) => {
  return mockEnrollments?.find(e => e?.athleteId === athleteId && e?.status === 'active');
};

export const getAthletePlan = (athleteId) => {
  const enrollment = getAthleteEnrollment(athleteId);
  return mockPlans?.find(p => p?.id === enrollment?.planId);
};

export const getAthleteAttendance = (athleteId) => {
  return mockAttendance?.filter(a => a?.athleteId === athleteId);
};

export const getAthleteMetrics = (athleteId) => {
  return mockMetrics?.filter(m => m?.athleteId === athleteId);
};

export const getAthleteNotes = (athleteId) => {
  return mockNotes?.filter(n => n?.athleteId === athleteId);
};

export const getSessionsByProfessor = (professorName) => {
  return mockSessions?.filter(s => s?.professor === professorName);
};

export const getSessionsByPlan = (planId) => {
  return mockSessions?.filter(s => s?.planId === planId);
};