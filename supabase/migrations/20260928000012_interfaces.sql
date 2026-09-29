-- 0012: the interfaces of stage 5 (stage 5 plan, task 1; module map v9). No table changes.

-- Module map v9 (stage 5 plan, decisions 1 and 5): S23 learns who signed in; S05 asks for an upload address.
-- Module map v10 (a gap in stage 5, task 7): S22 reads the error texts, so a newcomer sees why a join failed (UC4 a).
insert into registry_entries ("caller","moduleName","actionName","allowedRole") values
  ('S23','trainees','get_me','coach'),
  ('S23','trainees','get_me','trainee'),
  ('S05','exercises','prepare_upload','coach'),
  ('S22','settings','get_error_texts','trainee');

-- UC10 section 7 v2 (stage 5 plan, decision 7): the largest upload, for every coach that has the other video value.
insert into settings ("CoachID","settingKey","settingValue")
select s."CoachID", 'videoMaxMegabytes', '50' from settings s
 where s."settingKey" = 'videoMaxSeconds'
on conflict ("CoachID","settingKey") do nothing;

-- I04 (stage 5 plan, decision 5): one bucket for uploaded videos. Open for viewing, like a YouTube link; writing
-- only through a signed upload address that the Endpoint issues. The hard limit matches videoMaxMegabytes.
insert into storage.buckets ("id","name","public","file_size_limit","allowed_mime_types")
values ('videos', 'videos', true, 52428800, array['video/*'])
on conflict ("id") do nothing;

-- UC4 step 5 (stage 5 plan, decision 3): joining is one action in the database. The trainee is created and the
-- invite closed together, only while it is open and valid, so one token makes one trainee even when two try at once.
-- status: joined (with traineeID), expired (unknown, used or past its date: INVITE_EXPIRED), taken (the identity
-- user is already a coach or a trainee: NOT_ALLOWED, UC4 d).
-- Called only from supabase/functions/api/repository.ts with the service role; closed to the browser roles.
create or replace function public.trainees_accept_invite(p_token text, p_auth uuid, p_name text, p_email text) returns jsonb
language plpgsql as $$
declare
  inv record;
  tid uuid;
begin
  select "InviteID", "CoachID", "inviteeName", "status", "expiresAt" into inv
    from invites where "token" = p_token for update;
  if not found or inv."status" <> 'open' or inv."expiresAt" <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  if exists (select 1 from coaches where "authUserID" = p_auth) or exists (select 1 from trainees where "authUserID" = p_auth) then
    return jsonb_build_object('status', 'taken');
  end if;

  insert into trainees ("CoachID", "authUserID", "fullName", "email")
  values (inv."CoachID", p_auth, coalesce(nullif(btrim(p_name), ''), inv."inviteeName"), p_email)
  returning "TraineeID" into tid;
  update invites set "status" = 'accepted', "TraineeID" = tid where "InviteID" = inv."InviteID";
  return jsonb_build_object('status', 'joined', 'traineeID', tid);
end $$;

revoke all on function public.trainees_accept_invite(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.trainees_accept_invite(text, uuid, text, text) to service_role;
