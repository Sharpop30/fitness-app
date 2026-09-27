-- 0006: atomic program writes (stage 3 plan, decision 3, approved 28.09.2026). No table changes.
-- UC1 section 7: no partial save. Business Logic rule 1: a new program deactivates the previous one in one step.
-- Called only from supabase/functions/api/repository.ts with the service role; closed to the browser roles.

create or replace function public.program_save(p_program uuid, p_workouts jsonb) returns void
language plpgsql as $$
declare
  is_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  w jsonb; it jsonb; wi int := 0; ii int; w_id uuid; it_id uuid;
begin
  for w in select value from jsonb_array_elements(p_workouts) loop
    w_id := null;
    if (w->>'WorkoutID') ~* is_uuid then
      update workouts set "workoutName" = w->>'workoutName', "sortOrder" = wi
       where "WorkoutID" = (w->>'WorkoutID')::uuid and "ProgramID" = p_program
      returning "WorkoutID" into w_id;
    end if;
    if w_id is null then -- a workout added on the screen
      insert into workouts ("ProgramID","workoutName","sortOrder") values (p_program, w->>'workoutName', wi)
      returning "WorkoutID" into w_id;
    end if;

    ii := 0;
    for it in select value from jsonb_array_elements(w->'items') loop
      it_id := null;
      if (it->>'WorkoutItemID') ~* is_uuid then
        update workout_items set "ExerciseID" = (it->>'ExerciseID')::uuid, "sortOrder" = ii,
               "targetSets" = (it->>'targetSets')::int, "targetReps" = (it->>'targetReps')::int,
               "targetWeight" = (it->>'targetWeight')::numeric
         where "WorkoutItemID" = (it->>'WorkoutItemID')::uuid and "WorkoutID" = w_id
        returning "WorkoutItemID" into it_id;
      end if;
      if it_id is null then -- an exercise added on the screen
        insert into workout_items ("WorkoutID","ExerciseID","sortOrder","targetSets","targetReps","targetWeight")
        values (w_id, (it->>'ExerciseID')::uuid, ii, (it->>'targetSets')::int, (it->>'targetReps')::int, (it->>'targetWeight')::numeric);
      end if;
      ii := ii + 1;
    end loop;
    wi := wi + 1;
  end loop;
end $$;

create or replace function public.program_start_new(p_trainee uuid, p_program_name text, p_workout_name text) returns uuid
language plpgsql as $$
declare new_id uuid;
begin
  -- The previous program is kept, inactive, with its results (UC1 alternative e; rule 6: no physical delete).
  update programs set "isActive" = false, "deactivatedAt" = now() where "TraineeID" = p_trainee and "isActive";
  insert into programs ("TraineeID","programName") values (p_trainee, p_program_name) returning "ProgramID" into new_id;
  insert into workouts ("ProgramID","workoutName","sortOrder") values (new_id, p_workout_name, 0);
  return new_id;
end $$;

revoke all on function public.program_save(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.program_start_new(uuid, text, text) from public, anon, authenticated;
grant execute on function public.program_save(uuid, jsonb) to service_role;
grant execute on function public.program_start_new(uuid, text, text) to service_role;
