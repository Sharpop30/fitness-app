-- 0003: module map version 2 (gaps 1 and 2 from the stage 1 report, approved 28.09.2026).
insert into error_codes ("errorCode","developerText","humanText") values
  ('UNEXPECTED_ERROR','תקלה לא צפויה במודול, שאינה תקלת מסד','משהו השתבש. נסה שוב');
insert into registry_entries ("caller","moduleName","actionName","allowedRole") values
  ('M01','invite_channel','send_invite','module');
