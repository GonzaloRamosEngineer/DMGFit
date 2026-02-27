#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'STAFF_EMAIL',
  'STAFF_PASSWORD',
  'NON_STAFF_EMAIL',
  'NON_STAFF_PASSWORD',
  'TEST_ATHLETE_ID',
  'TEST_WEEKLY_SCHEDULE_ID'
];

const env = Object.fromEntries(required.map((k) => [k, process.env[k]]));
const missing = required.filter((k) => !env[k]);
if (missing.length) {
  console.error(`❌ Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const TZ = process.env.KIOSK_TIMEZONE || 'America/Montevideo';
const TEST_DNI = process.env.TEST_DNI || null;
const TEST_PHONE = process.env.TEST_PHONE || null;

function logResult(ok, label, detail = '') {
  const icon = ok ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} - ${label}${detail ? ` :: ${detail}` : ''}`);
}

async function signIn(email, password) {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
  return client;
}

async function expectBlockedOrZero(op, label) {
  try {
    const res = await op();
    const blocked = Boolean(res.error) || (Array.isArray(res.data) && res.data.length === 0);
    logResult(blocked, label, res.error?.message || 'RLS zero-row block');
    return blocked;
  } catch (e) {
    logResult(true, label, e.message);
    return true;
  }
}

async function expectError(op, label) {
  const res = await op();
  const ok = Boolean(res.error);
  logResult(ok, label, res.error?.message || 'unexpected success');
  return ok;
}

async function expectSuccess(op, label) {
  const res = await op();
  const ok = !res.error;
  logResult(ok, label, res.error?.message || 'ok');
  return { ok, res };
}

(async () => {
  let failed = 0;

  const staff = await signIn(env.STAFF_EMAIL, env.STAFF_PASSWORD);
  const user = await signIn(env.NON_STAFF_EMAIL, env.NON_STAFF_PASSWORD);

  console.log('\n=== RLS: access_logs (non-staff) ===');
  if (!(await expectBlockedOrZero(
    () => user.from('access_logs').select('id').limit(1),
    'non-staff SELECT access_logs blocked'
  ))) failed++;

  if (!(await expectError(
    () => user.from('access_logs').insert({ access_granted: true, reason_code: 'OK' }),
    'non-staff INSERT access_logs access_granted=true denied'
  ))) failed++;

  const deniedInsert = await expectSuccess(
    () => user
      .from('access_logs')
      .insert({
  athlete_id: env.TEST_ATHLETE_ID,
  access_granted: false,
  reason_code: 'PAYMENT_BLOCKED',
  rejection_reason: 'rls harness denied'
}),
    'non-staff INSERT access_logs access_granted=false allowed'
  );
  if (!deniedInsert.ok) failed++;

  const deniedLogId = deniedInsert.res?.data?.id;
  if (!(await expectBlockedOrZero(
    () => user.from('access_logs').update({ rejection_reason: 'should fail' }).eq('id', deniedLogId).select('id'),
    'non-staff UPDATE access_logs blocked'
  ))) failed++;

  if (!(await expectBlockedOrZero(
    () => user.from('access_logs').delete().eq('id', deniedLogId).select('id'),
    'non-staff DELETE access_logs blocked'
  ))) failed++;

  console.log('\n=== RLS: counters/assignments (non-staff) ===');
  if (!(await expectBlockedOrZero(
    () => user.from('athlete_monthly_counters').select('id').limit(1),
    'non-staff SELECT athlete_monthly_counters blocked'
  ))) failed++;

  if (!(await expectError(
    () => user.from('athlete_monthly_counters').insert({
      athlete_id: env.TEST_ATHLETE_ID,
      period_start: '2099-01-01',
      period_end: '2099-01-31',
      allowed_sessions: 1,
      consumed_sessions: 0
    }),
    'non-staff INSERT athlete_monthly_counters denied'
  ))) failed++;

  if (!(await expectBlockedOrZero(
    () => user.from('athlete_monthly_counters').update({ allowed_sessions: 999 }).eq('athlete_id', env.TEST_ATHLETE_ID).select('id'),
    'non-staff UPDATE athlete_monthly_counters blocked'
  ))) failed++;

  if (!(await expectBlockedOrZero(
    () => user.from('athlete_slot_assignments').select('id').limit(1),
    'non-staff SELECT athlete_slot_assignments blocked'
  ))) failed++;

  if (!(await expectError(
    () => user.from('athlete_slot_assignments').insert({
      athlete_id: env.TEST_ATHLETE_ID,
      weekly_schedule_id: env.TEST_WEEKLY_SCHEDULE_ID,
      starts_on: '2099-01-01',
      is_active: true
    }),
    'non-staff INSERT athlete_slot_assignments denied'
  ))) failed++;

  if (!(await expectBlockedOrZero(
    () => user.from('athlete_slot_assignments').update({ is_active: false }).eq('athlete_id', env.TEST_ATHLETE_ID).select('id'),
    'non-staff UPDATE athlete_slot_assignments blocked'
  ))) failed++;

  console.log('\n=== RLS: staff access ===');
  const staffSelectLogs = await expectSuccess(
    () => staff.from('access_logs').select('id').limit(1),
    'staff SELECT access_logs allowed'
  );
  if (!staffSelectLogs.ok) failed++;

  const staffCounterInsert = await expectSuccess(
    () => staff.from('athlete_monthly_counters').insert({
      athlete_id: env.TEST_ATHLETE_ID,
      period_start: '2099-03-01',
      period_end: '2099-03-31',
      allowed_sessions: 4,
      consumed_sessions: 0
    }).select('id').single(),
    'staff INSERT athlete_monthly_counters allowed'
  );
  if (!staffCounterInsert.ok) failed++;

  const staffCounterId = staffCounterInsert.res?.data?.id;
  if (!(await expectSuccess(
    () => staff.from('athlete_monthly_counters').update({ allowed_sessions: 5 }).eq('id', staffCounterId).select('id').single(),
    'staff UPDATE athlete_monthly_counters allowed'
  )).ok) failed++;

  if (!(await expectSuccess(
    () => staff.from('athlete_monthly_counters').delete().eq('id', staffCounterId).select('id').single(),
    'staff DELETE athlete_monthly_counters allowed'
  )).ok) failed++;

  const staffAssignmentInsert = await expectSuccess(
    () => staff.from('athlete_slot_assignments').insert({
      athlete_id: env.TEST_ATHLETE_ID,
      weekly_schedule_id: env.TEST_WEEKLY_SCHEDULE_ID,
      starts_on: '2099-04-01',
      ends_on: '2099-04-01',
      is_active: false
    }).select('id').single(),
    'staff INSERT athlete_slot_assignments allowed'
  );
  if (!staffAssignmentInsert.ok) failed++;

  const staffAssignmentId = staffAssignmentInsert.res?.data?.id;
  if (!(await expectSuccess(
    () => staff.from('athlete_slot_assignments').update({ ends_on: '2099-04-02' }).eq('id', staffAssignmentId).select('id').single(),
    'staff UPDATE athlete_slot_assignments allowed'
  )).ok) failed++;

  if (!(await expectSuccess(
    () => staff.from('athlete_slot_assignments').delete().eq('id', staffAssignmentId).select('id').single(),
    'staff DELETE athlete_slot_assignments allowed'
  )).ok) failed++;

  console.log('\n=== RPC path (non-staff authenticated) ===');
  const pNow = new Date().toISOString();
  const rpc = await user.rpc('kiosk_check_in', {
    p_dni: TEST_DNI,
    p_phone: TEST_PHONE,
    p_now: pNow,
    p_timezone: TZ
  });
  const rpcOk = !rpc.error;
  logResult(rpcOk, 'non-staff EXECUTE kiosk_check_in allowed', rpc.error?.message || JSON.stringify(rpc.data));
  if (!rpcOk) failed++;

  const verifyByStaff = await staff
    .from('access_logs')
    .select('id, athlete_id, weekly_schedule_id, reason_code, access_granted, idempotency_key, check_in_time')
    .eq('athlete_id', rpc.data?.athlete_id ?? env.TEST_ATHLETE_ID)
    .order('check_in_time', { ascending: false })
    .limit(1);

  logResult(
    !verifyByStaff.error && (verifyByStaff.data?.length ?? 0) > 0,
    'staff can verify RPC produced access_logs row',
    verifyByStaff.error?.message || `rows=${verifyByStaff.data?.length ?? 0}`
  );
  if (verifyByStaff.error || (verifyByStaff.data?.length ?? 0) === 0) failed++;

  console.log(`\n=== RESULT: ${failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`} ===`);
  process.exit(failed === 0 ? 0 : 1);
})();
