-- 0010: atomic class registration writes (stage 4c plan, decision 5, approved 28.09.2026). No table changes.
-- UC11 section 7 and flow e: checking for a free spot and registering are one action in the database, so the
-- number registered never passes the capacity. A lock per class serialises every change to its registrations.
-- UC11 step 7 (team decision): a spot that frees up is offered to the first on the waitlist for spotOfferHours,
-- and then passes to the next in line. There is no scheduled process (decision 6): every change first moves on
-- the offers that ran out. Each function returns the trainees that got an offer now, and the module tells them.
-- Called only from supabase/functions/api/repository.ts with the service role; closed to the browser roles.

-- Internal: under the class lock, closes the offers that ran out and offers each free spot to the next waiting.
create or replace function public.classes_offer_spots(p_class uuid, p_hours numeric) returns uuid[]
language plpgsql as $$
declare
  k record;
  taken int;
  nxt uuid;
  offered uuid[] := '{}';
begin
  select "capacity", "startsAt", "status" into k from classes where "ClassID" = p_class;
  update class_registrations set "status" = 'cancelled', "offerExpiresAt" = null
   where "ClassID" = p_class and "status" = 'offered' and "offerExpiresAt" <= now();
  if k."status" <> 'active' or k."startsAt" <= now() then return offered; end if;
  loop
    select count(*) into taken from class_registrations
     where "ClassID" = p_class and "status" in ('registered', 'offered');
    exit when taken >= k."capacity";
    select "TraineeID" into nxt from class_registrations
     where "ClassID" = p_class and "status" = 'waitlist'
     order by "waitlistPosition", "createdAt" limit 1;
    exit when nxt is null;
    -- The spot is held for spotOfferHours, and never past the start of the class.
    update class_registrations
       set "status" = 'offered', "offerExpiresAt" = least(now() + p_hours * interval '1 hour', k."startsAt")
     where "ClassID" = p_class and "TraineeID" = nxt;
    offered := offered || nxt;
  end loop;
  return offered;
end $$;

-- UC11 steps 4 and 5, flows b and e. status: registered, waitlist, already (flow b) or closed (cancelled or started).
create or replace function public.classes_register(p_class uuid, p_trainee uuid, p_hours numeric) returns jsonb
language plpgsql as $$
declare
  k record;
  offered uuid[];
  cur text;
  taken int;
  pos int;
  st text;
begin
  select "capacity", "startsAt", "status" into k from classes where "ClassID" = p_class for update;
  if not found or k."status" <> 'active' or k."startsAt" <= now() then
    return jsonb_build_object('status', 'closed');
  end if;
  offered := public.classes_offer_spots(p_class, p_hours);

  select "status" into cur from class_registrations where "ClassID" = p_class and "TraineeID" = p_trainee;
  if cur in ('registered', 'waitlist', 'offered') then
    return jsonb_build_object('status', 'already', 'offered', to_jsonb(offered));
  end if;

  select count(*) into taken from class_registrations
   where "ClassID" = p_class and "status" in ('registered', 'offered');
  st := case when taken < k."capacity" then 'registered' else 'waitlist' end;
  select coalesce(max("waitlistPosition"), 0) + 1 into pos from class_registrations where "ClassID" = p_class;

  -- One row per class and trainee (unique in the ERD): a cancelled registration is used again.
  insert into class_registrations ("ClassID","TraineeID","status","waitlistPosition")
  values (p_class, p_trainee, st, case when st = 'waitlist' then pos end)
  on conflict ("ClassID","TraineeID") do update
    set "status" = excluded."status", "waitlistPosition" = excluded."waitlistPosition",
        "offerExpiresAt" = null, "attended" = null;

  if st = 'waitlist' then
    select count(*) into pos from class_registrations
     where "ClassID" = p_class and "status" = 'waitlist' and "waitlistPosition" <= pos;
  else
    pos := null;
  end if;
  return jsonb_build_object('status', st, 'position', pos, 'offered', to_jsonb(offered));
end $$;

-- p_op: cancel (UC11 step 6, or a late cancel the coach approved), accept or decline (step 7), or expire, which
-- only moves on the offers that ran out (p_trainee null). status: ok, none (nothing to change), or expired (an
-- answer to an offer that is no longer open, SPOT_OFFER_EXPIRED).
create or replace function public.classes_release_spot(p_class uuid, p_trainee uuid, p_op text, p_hours numeric) returns jsonb
language plpgsql as $$
declare
  offered uuid[];
  cur text;
  st text := 'ok';
begin
  perform 1 from classes where "ClassID" = p_class for update;
  if not found then return jsonb_build_object('status', 'none', 'offered', '[]'::jsonb); end if;
  offered := public.classes_offer_spots(p_class, p_hours);

  if p_op <> 'expire' then
    select "status" into cur from class_registrations where "ClassID" = p_class and "TraineeID" = p_trainee;
    if p_op = 'cancel' then
      if cur in ('registered', 'waitlist') then
        update class_registrations set "status" = 'cancelled', "offerExpiresAt" = null
         where "ClassID" = p_class and "TraineeID" = p_trainee;
      else
        st := 'none';
      end if;
    elsif p_op in ('accept', 'decline') then
      if cur = 'offered' then
        update class_registrations
           set "status" = case when p_op = 'accept' then 'registered' else 'cancelled' end, "offerExpiresAt" = null
         where "ClassID" = p_class and "TraineeID" = p_trainee;
      else
        st := 'expired';
      end if;
    end if;
    offered := offered || public.classes_offer_spots(p_class, p_hours);
  end if;
  return jsonb_build_object('status', st, 'offered', to_jsonb(offered));
end $$;

revoke all on function public.classes_offer_spots(uuid, numeric) from public, anon, authenticated;
revoke all on function public.classes_register(uuid, uuid, numeric) from public, anon, authenticated;
revoke all on function public.classes_release_spot(uuid, uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.classes_offer_spots(uuid, numeric) to service_role;
grant execute on function public.classes_register(uuid, uuid, numeric) to service_role;
grant execute on function public.classes_release_spot(uuid, uuid, text, numeric) to service_role;
