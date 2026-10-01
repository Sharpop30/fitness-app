-- 0014: the Registry rows of module map v11 (stage 4e plan, task 2; usecase-12 section 10). Reference data only.

insert into registry_entries ("caller","moduleName","actionName","allowedRole") values
  -- The owner signs in (UC12 step 1) and sets the business SETTINGS (step 10).
  ('S23','trainees','get_me','owner'),
  ('S23','settings','get_error_texts','owner'),
  ('S12','settings','get_settings','owner'),
  ('S12','settings','update_settings','owner'),
  -- The owner's screens (UC12 steps 2, 3, 8, 9).
  ('S24','home','get_owner_home','owner'),
  ('S25','business','list_coaches','owner'),
  ('S25','business','invite_coach','owner'),
  ('S26','business','get_kpis','owner'),
  ('S27','business','get_coach_card','owner'),
  -- A newcomer joins as a coach (UC12 steps 6, 7; map v11, "joining as a coach"). The newcomer's role is trainee
  -- without an ID, as for a trainee invite (map v9).
  ('S22','business','accept_coach_invite','trainee'),
  -- M15 reaches the invite channel, the existing actions on the owner's behalf, and SETTINGS for inviteValidDays (UC12 step 4).
  ('M15','invite_channel','send_invite','module'),
  ('M15','trainees','list_trainees','module'),
  ('M15','payments','list_payments','module'),
  ('M15','classes','list_upcoming_classes','module'),
  ('M15','progress','get_streak','module'),
  ('M15','challenges','list_completions','module'),
  ('M15','results','list_results','module'),
  ('M15','settings','get_settings','module'),
  -- home.get_owner_home counts the coaches (map v11, home).
  ('M13','business','list_coaches','module');

-- Only the owner changes SETTINGS (rule 9; UC12 alternative f). The coach's row goes out of use, not away (rule 6).
update registry_entries set "isActive" = false
 where "caller" = 'S12' and "moduleName" = 'settings' and "actionName" = 'update_settings' and "allowedRole" = 'coach';
