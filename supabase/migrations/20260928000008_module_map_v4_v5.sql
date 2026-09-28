-- 0008: Registry rows from module map versions 4 and 5 that enter in stage 4b (stage 4b plan, task 1).
-- v4 (stage 4a report, gap 1): progress.get_streak for trainees and home. The rows for get_trainee_card enter in 4d.
-- v5 (stage 4b plan, decision 3): home reads rewards to deliver and challenge completions; S09 picks the exercise.
insert into registry_entries ("caller","moduleName","actionName","allowedRole") values
  ('M01','progress','get_streak','module'),
  ('M13','progress','get_streak','module'),
  ('M13','coins','manage_rewards','module'),
  ('M13','challenges','list_completions','module'),
  ('S09','exercises','list_exercises','coach');
