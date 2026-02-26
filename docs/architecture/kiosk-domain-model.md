# Kiosk domain model (Phase 1)

This document defines the initial database-only foundation for the kiosk enforcement domain.

## Assignment lifecycle (`athlete_slot_assignments`)

- A row links one athlete to one weekly schedule slot assignment window.
- Assignment windows are represented by `starts_on` and optional `ends_on`.
- `is_active = true` indicates rows that are currently enforceable by business logic in later phases.
- Overlap prevention is enforced for active windows per athlete through an exclusion constraint on date ranges.
- `assigned_reason_code` is available for future linkage to standardized reason semantics.

## Monthly counter lifecycle (`athlete_monthly_counters`)

- A row represents one athlete’s monthly (or period-based) session budget.
- `allowed_sessions` is the assigned budget for the period.
- `consumed_sessions` tracks usage within the same period.
- A check constraint enforces `consumed_sessions <= allowed_sessions`.
- A uniqueness constraint (`athlete_id`, `period_start`, `period_end`) prevents duplicate counter periods.

## Reason code philosophy (`kiosk_reason_codes`)

- Reason codes are normalized into a dedicated table for consistent interpretation.
- `code` is the stable key, while `category` and `description` support grouping and operator clarity.
- `is_active` supports non-destructive deprecation of reason codes over time.
- This table is intentionally isolated from current kiosk UX flow until a later integration phase.

## Phase 2 atomic enforcement notes

- `public.kiosk_check_in(...)` centralizes validation, consumption, and logging in one DB transaction.
- Duplicate guard uses `access_logs.local_checkin_date` (gym local date) + `athlete_id` + `weekly_schedule_id` for clarity and deterministic behavior.
- Timezone policy: duplicate/day guards must be evaluated with gym local timezone (`p_timezone`), not UTC day boundaries.
- Historical compatibility is preserved: old `access_logs` rows can keep `reason_code` and `weekly_schedule_id` as `NULL`.
