-- 0017: demo.unload() (stage 7 plan, task 19; decision 8; CLAUDE.md v10, rule 9, the one declared exception).
-- Removes the demo data from the cloud, once, in stage 7c: every row of the demo businesses, and the rows made from them
-- while testing in the cloud. The demo business is the one with ID d0000000... (demo.load since 0013), or the one holding
-- the demo coach (the cloud, where the move in 0013 gave it a random ID). AUDIT_ENTRIES stay: they are the log.
-- One function, one transaction. Every foreign key is "on delete restrict", so if any row outside the demo still points
-- at a demo row, the delete fails and nothing is removed. Not called by the regular tests; locally demo.load() puts the
-- data back. Lives in the closed schema demo, which the Data API does not expose.

create or replace function demo.unload() returns jsonb
language plpgsql as $$
declare
  p constant text := 'd0000000-0000-4000-8000-00000000';
  n jsonb := '{}'::jsonb;
  c int;
begin
  create temp table _b on commit drop as
    select "BusinessID" as id from businesses where "BusinessID"::text like 'd0000000-%'
    union select "BusinessID" from coaches where "CoachID" = (p || '0001')::uuid;
  create temp table _c on commit drop as select "CoachID" as id from coaches where "BusinessID" in (select id from _b);
  create temp table _t on commit drop as select "TraineeID" as id from trainees where "CoachID" in (select id from _c);
  create temp table _l on commit drop as select "WorkoutLogID" as id from workout_logs where "TraineeID" in (select id from _t);
  create temp table _w on commit drop as
    select w."WorkoutID" as id from workouts w join programs pr on pr."ProgramID" = w."ProgramID"
     where pr."TraineeID" in (select id from _t);
  create temp table _e on commit drop as
    select "ExerciseID" as id from exercises
     where "CoachID" in (select id from _c) or ("CoachID" is null and "ExerciseID"::text like 'd0000000-%');

  delete from late_cancel_requests where "ClassRegistrationID" in
    (select "ClassRegistrationID" from class_registrations
      where "TraineeID" in (select id from _t) or "ClassID" in (select "ClassID" from classes where "CoachID" in (select id from _c)));
  get diagnostics c = row_count; n := n || jsonb_build_object('late_cancel_requests', c);
  delete from class_registrations
   where "TraineeID" in (select id from _t) or "ClassID" in (select "ClassID" from classes where "CoachID" in (select id from _c));
  get diagnostics c = row_count; n := n || jsonb_build_object('class_registrations', c);
  delete from classes where "CoachID" in (select id from _c);
  get diagnostics c = row_count; n := n || jsonb_build_object('classes', c);

  delete from invoices where "PaymentRequestID" in
    (select "PaymentRequestID" from payment_requests where "TraineeID" in (select id from _t) or "CoachID" in (select id from _c));
  get diagnostics c = row_count; n := n || jsonb_build_object('invoices', c);
  delete from payment_requests where "TraineeID" in (select id from _t) or "CoachID" in (select id from _c);
  get diagnostics c = row_count; n := n || jsonb_build_object('payment_requests', c);

  delete from challenge_completions
   where "TraineeID" in (select id from _t) or "ChallengeID" in (select "ChallengeID" from challenges where "CoachID" in (select id from _c));
  get diagnostics c = row_count; n := n || jsonb_build_object('challenge_completions', c);
  delete from challenges where "CoachID" in (select id from _c);
  get diagnostics c = row_count; n := n || jsonb_build_object('challenges', c);

  delete from redemptions where "TraineeID" in (select id from _t) or "RewardID" in (select "RewardID" from rewards where "CoachID" in (select id from _c));
  get diagnostics c = row_count; n := n || jsonb_build_object('redemptions', c);
  delete from coin_transactions where "TraineeID" in (select id from _t);
  get diagnostics c = row_count; n := n || jsonb_build_object('coin_transactions', c);
  delete from rewards where "CoachID" in (select id from _c);
  get diagnostics c = row_count; n := n || jsonb_build_object('rewards', c);

  delete from notifications where "TraineeID" in (select id from _t);
  get diagnostics c = row_count; n := n || jsonb_build_object('notifications', c);
  delete from personal_goals where "TraineeID" in (select id from _t);
  get diagnostics c = row_count; n := n || jsonb_build_object('personal_goals', c);

  delete from coach_notes where "WorkoutLogID" in (select id from _l) or "CoachID" in (select id from _c);
  get diagnostics c = row_count; n := n || jsonb_build_object('coach_notes', c);
  delete from set_results where "WorkoutLogID" in (select id from _l);
  get diagnostics c = row_count; n := n || jsonb_build_object('set_results', c);
  delete from workout_logs where "WorkoutLogID" in (select id from _l);
  get diagnostics c = row_count; n := n || jsonb_build_object('workout_logs', c);
  delete from workout_items where "WorkoutID" in (select id from _w);
  get diagnostics c = row_count; n := n || jsonb_build_object('workout_items', c);
  delete from workouts where "WorkoutID" in (select id from _w);
  get diagnostics c = row_count; n := n || jsonb_build_object('workouts', c);
  delete from programs where "TraineeID" in (select id from _t);
  get diagnostics c = row_count; n := n || jsonb_build_object('programs', c);
  delete from exercises where "ExerciseID" in (select id from _e);
  get diagnostics c = row_count; n := n || jsonb_build_object('exercises', c);

  delete from invites where "CoachID" in (select id from _c);
  get diagnostics c = row_count; n := n || jsonb_build_object('invites', c);
  delete from trainees where "TraineeID" in (select id from _t);
  get diagnostics c = row_count; n := n || jsonb_build_object('trainees', c);
  delete from coach_invites where "BusinessID" in (select id from _b);
  get diagnostics c = row_count; n := n || jsonb_build_object('coach_invites', c);
  delete from coaches where "CoachID" in (select id from _c);
  get diagnostics c = row_count; n := n || jsonb_build_object('coaches', c);
  delete from settings where "BusinessID" in (select id from _b);
  get diagnostics c = row_count; n := n || jsonb_build_object('settings', c);
  delete from owners where "BusinessID" in (select id from _b);
  get diagnostics c = row_count; n := n || jsonb_build_object('owners', c);
  delete from businesses where "BusinessID" in (select id from _b);
  get diagnostics c = row_count; n := n || jsonb_build_object('businesses', c);

  return n;
end $$;

revoke all on function demo.unload() from public, anon, authenticated;
