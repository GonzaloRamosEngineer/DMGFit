import { describe, it, expect } from 'vitest';
import { getInitialSelectedSlotIds } from './ModifyAthleteScheduleModal';

// Turnos disponibles del plan, tal como los devuelve plan_slot_availability
const planSlots = [
  { weekly_schedule_id: 'lun-18', day_of_week: 1, remaining: 3 },
  { weekly_schedule_id: 'mie-18', day_of_week: 3, remaining: 2 },
  { weekly_schedule_id: 'vie-18', day_of_week: 5, remaining: 5 },
];

describe('getInitialSelectedSlotIds', () => {
  it('preselecciona los turnos asignados que pertenecen al plan', () => {
    const assigned = [
      { id: 'a1', weekly_schedule_id: 'lun-18' },
      { id: 'a2', weekly_schedule_id: 'mie-18' },
    ];
    expect(getInitialSelectedSlotIds(assigned, planSlots, 3)).toEqual(['lun-18', 'mie-18']);
  });

  it('descarta los turnos que ya no son del plan (cambio de plan)', () => {
    const assigned = [
      { id: 'a1', weekly_schedule_id: 'mar-20' }, // de un plan anterior
      { id: 'a2', weekly_schedule_id: 'vie-18' },
    ];
    expect(getInitialSelectedSlotIds(assigned, planSlots, 2)).toEqual(['vie-18']);
  });

  it('no preselecciona más turnos que la frecuencia (le bajaron la frecuencia)', () => {
    const assigned = [
      { id: 'a1', weekly_schedule_id: 'lun-18' },
      { id: 'a2', weekly_schedule_id: 'mie-18' },
      { id: 'a3', weekly_schedule_id: 'vie-18' },
    ];
    expect(getInitialSelectedSlotIds(assigned, planSlots, 2)).toEqual(['lun-18', 'mie-18']);
  });

  it('resuelve el id desde la relación anidada weekly_schedule', () => {
    const assigned = [{ id: 'a1', weekly_schedule: { id: 'vie-18' } }];
    expect(getInitialSelectedSlotIds(assigned, planSlots, 1)).toEqual(['vie-18']);
  });

  it('tolera la relación anidada como array (forma de PostgREST)', () => {
    const assigned = [{ id: 'a1', weekly_schedule: [{ id: 'mie-18' }] }];
    expect(getInitialSelectedSlotIds(assigned, planSlots, 1)).toEqual(['mie-18']);
  });

  it('devuelve vacío sin datos o sin frecuencia', () => {
    expect(getInitialSelectedSlotIds(undefined, undefined, undefined)).toEqual([]);
    expect(getInitialSelectedSlotIds([{ weekly_schedule_id: 'lun-18' }], planSlots, 0)).toEqual([]);
    expect(getInitialSelectedSlotIds([{ weekly_schedule_id: 'lun-18' }], [], 3)).toEqual([]);
  });
});
