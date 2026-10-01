-- 0016: module map v13 (stage 7 plan, task 1; decisions 3 to 7). Eight Registry rows and the error texts.
-- No table, no new error code: ERROR_CODES stays 28.

insert into registry_entries ("caller","moduleName","actionName","allowedRole") values
  -- The coach's screens show their numbers from SETTINGS, and get only the keys they show (design-stage gaps 1 to 3; rule 9).
  ('S05','settings','get_settings','coach'),   -- videoMaxSeconds, videoMaxMegabytes
  ('S07','settings','get_settings','coach'),   -- coinsGoal
  ('S08','settings','get_settings','coach'),   -- priceMonthly, pricePack10
  ('S11','settings','get_settings','coach'),   -- coinsAttendance
  -- Changing this week's challenge (design-stage gap 9; rule 11; usecase-08 v3).
  ('S09','challenges','update_challenge','coach'),
  -- The invite is checked when S22 opens, before any sign-in (design review, finding 15; usecase-04 v4, usecase-12 v3).
  ('S22','trainees','check_invite','trainee'),
  ('S22','business','check_coach_invite','trainee'),
  -- The trainee's name on the trainee home (design-stage gap 7).
  ('M13','trainees','get_me','module');

-- The words for people follow prototype 3.2, which governs wording (CLAUDE.md section 1; design review, finding 36).
update error_codes set "humanText" = v.t
  from (values
    ('CALLER_MISSING',              'משהו השתבש. אפשר לנסות שוב'),
    ('CALLER_INVALID',              'משהו השתבש. אפשר לנסות שוב'),
    ('AUDIT_FAILED',                'הפעולה לא בוצעה. אפשר לנסות שוב בעוד רגע'),
    ('UNEXPECTED_ERROR',            'משהו השתבש. אפשר לנסות שוב'),
    ('STORAGE_UNAVAILABLE',         'השינוי לא נשמר כרגע. אפשר לנסות שוב'),
    ('PROGRAM_INVALID',             'חסר מידע בתרגיל. צריך סטים, חזרות ומשקל'),
    ('NO_ACTIVE_PROGRAM',           'התוכנית שלך עוד בהכנה אצל המאמן'),
    ('RESULT_INVALID',              'יש ערך לא תקין באחד הסטים. כדאי לבדוק ולנסות שוב'),
    ('NOTE_INVALID',                'ההערה ריקה או ארוכה מדי. אפשר לקצר ולנסות שוב'),
    ('INVITE_INVALID',              'פרט הקשר לא תקין. כדאי לבדוק ולנסות שוב'),
    ('INVITE_EXPIRED',              'ההזמנה כבר לא בתוקף. אפשר לבקש הזמנה חדשה'),
    ('VIDEO_INVALID',               'זה לא נראה כמו סרטון. כדאי לנסות קישור אחר'),
    ('VIDEO_TOO_LONG',              'הסרטון ארוך או גדול מהמותר. המגבלה כתובה ליד כפתור ההעלאה'),
    ('UPLOAD_FAILED',               'הסרטון לא עלה. אפשר לנסות שוב'),
    ('PAYMENT_GATEWAY_UNAVAILABLE', 'התשלום לא הושלם. לא בוצע חיוב, ואפשר לנסות שוב'),
    ('CHALLENGE_EXISTS',            'כבר יש אתגר השבוע. אפשר ליצור את הבא בשבוע הבא'),
    ('CHALLENGE_INVALID',           'חסר יעד לאתגר, או שמתאמן כבר השלים אותו. אחרי השלמה אפשר לשנות רק שם ופרס'),
    ('CLASS_INVALID',               'חסרים פרטים בשיעור. צריך להשלים ולנסות שוב'),
    ('ALREADY_REGISTERED',          'כבר יש הרשמה לשיעור הזה')
  ) as v(code, t)
 where "errorCode" = v.code;

-- The words for developers that map v13 widened.
update error_codes set "developerText" = 'ההזמנה פגה, נוצלה או אינה קיימת' where "errorCode" = 'INVITE_EXPIRED';
update error_codes set "developerText" = 'אורך או גודל מעל המותר ב-SETTINGS' where "errorCode" = 'VIDEO_TOO_LONG';
update error_codes set "developerText" = 'יעד חסר או לא חיובי, או שינוי יעד אחרי השלמה' where "errorCode" = 'CHALLENGE_INVALID';
