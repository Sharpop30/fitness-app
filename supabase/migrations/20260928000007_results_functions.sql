-- 0007: atomic results writes (stage 4a plan, decision 5, approved 28.09.2026). No table changes.
-- UC3 section 7: a performed workout is saved whole or not at all. Business Logic rule 4: a correction marks
-- isCorrected on the sets that changed, and only on them.
-- Called only from supabase/functions/api/repository.ts with the service role; closed to the browser roles.

create or replace function public.results_log_workout(p_trainee uuid, p_workout uuid, p_sets jsonb) returns uuid
language plpgsql as $$
declare log_id uuid;
begin
  insert into workout_logs ("TraineeID","WorkoutID") values (p_trainee, p_workout) returning "WorkoutLogID" into log_id;
  insert into set_results ("WorkoutLogID","ExerciseID","setNumber","reps","weight","isDone")
  select log_id, (s->>'ExerciseID')::uuid, (s->>'setNumber')::int, (s->>'reps')::int, (s->>'weight')::numeric, (s->>'isDone')::boolean
    from jsonb_array_elements(p_sets) s;
  return log_id;
end $$;

create or replace function public.results_correct(p_log uuid, p_sets jsonb) returns void
language plpgsql as $$
begin
  update set_results r
     set "reps" = (s->>'reps')::int, "weight" = (s->>'weight')::numeric, "isDone" = (s->>'isDone')::boolean,
         "isCorrected" = true, "correctedAt" = now()
    from jsonb_array_elements(p_sets) s
   where r."WorkoutLogID" = p_log and r."SetResultID" = (s->>'SetResultID')::uuid
     and (r."reps", r."weight", r."isDone") is distinct from ((s->>'reps')::int, (s->>'weight')::numeric, (s->>'isDone')::boolean);
end $$;

revoke all on function public.results_log_workout(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.results_correct(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.results_log_workout(uuid, uuid, jsonb) to service_role;
grant execute on function public.results_correct(uuid, jsonb) to service_role;
