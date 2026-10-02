-- 0021: a fixed search_path for every function of ours (stage 7c, Security Advisor of the team, 03.10.2026: twelve
-- "Function Search Path Mutable" warnings). None is SECURITY DEFINER and all are closed to the browser, so the risk was
-- low; fixing it means no object of the same name elsewhere can ever stand in for a table. demo.unload and
-- setup.create_business (0017, 0019) are not in the cloud yet, and get it too. pg_temp last, for demo.unload's tables.
alter function public.business_accept_coach_invite(text, uuid, text, text) set search_path = public, pg_temp;
alter function public.classes_offer_spots(uuid, numeric)                   set search_path = public, pg_temp;
alter function public.classes_register(uuid, uuid, numeric)                set search_path = public, pg_temp;
alter function public.classes_release_spot(uuid, uuid, text, numeric)      set search_path = public, pg_temp;
alter function public.coins_achieve_goal(uuid, integer)                    set search_path = public, pg_temp;
alter function public.coins_redeem(uuid, uuid)                             set search_path = public, pg_temp;
alter function public.program_save(uuid, jsonb)                            set search_path = public, pg_temp;
alter function public.program_start_new(uuid, text, text)                  set search_path = public, pg_temp;
alter function public.results_correct(uuid, jsonb)                         set search_path = public, pg_temp;
alter function public.results_log_workout(uuid, uuid, jsonb)               set search_path = public, pg_temp;
alter function public.trainees_accept_invite(text, uuid, text, text)       set search_path = public, pg_temp;
alter function demo.load()                                                 set search_path = public, pg_temp;
alter function demo.unload()                                               set search_path = public, pg_temp;
alter function setup.create_business(text, text, text)                     set search_path = public, pg_temp;
