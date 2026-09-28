-- 0011: Registry rows and one human text from module map versions 4 and 8 that enter in stage 4d (stage 4d plan, task 1).
-- v4 (stage 4a report, gap 1): get_trainee_card builds the card from programs, coins and payments. Its row to
-- progress.get_streak entered in 0008, so three rows are left (stage 4d plan, decision 7).
-- v8 (stage 4d plan, decision 5): S06 reads noteMaxLength instead of a fixed "280" (stage 4b report, gap 2).
insert into registry_entries ("caller","moduleName","actionName","allowedRole") values
  ('M01','programs','get_active_program','module'),
  ('M01','coins','get_balance','module'),
  ('M01','payments','list_payments','module'),
  ('S06','settings','get_settings','coach');

-- v8 (stage 4d plan, decision 6): the window is read from SETTINGS, so the text has no fixed number (stage 4c report, gap 4).
update error_codes set "humanText" = 'עבר מועד הביטול. אפשר לבקש חריגה' where "errorCode" = 'CANCEL_TOO_LATE';
