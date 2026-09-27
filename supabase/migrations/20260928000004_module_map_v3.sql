-- 0004: module map version 3 (gaps 1-3 from the stage 2 report, approved 28.09.2026).
insert into registry_entries ("caller","moduleName","actionName","allowedRole") values
  ('S07','exercises','list_exercises','coach'),
  ('S08','trainees','list_trainees','coach'),
  ('S23','settings','get_error_texts','coach'),
  ('S23','settings','get_error_texts','trainee');
