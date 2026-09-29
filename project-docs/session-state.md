# סיכום מצב: fitness-app

| שדה | ערך |
| :-- | :-- |
| תאריך | 29.09.2026 |
| הצ'ט | Claude Code, צ'ט שלב 5 |

## מה נסגר

1. **תשתית**: מאגר GitHub ציבורי Sharpop30/fitness-app, מסונכרן ל-Google Drive. הקליטה לפורמט הקבוע הושלמה: file-system-index, יומן אישורים, רישום ריצה, תיקיות התור.
2. **אבחון**: הגדרת הפרויקט, מיפוי תהליכים (גרסה 2), יעדים ומדדים. היעדים המספריים פתוחים בהכרעת הצוות.
3. **אפיון**: גבולות הגרסה הראשונה; 11 סיפורי משתמש בפורמט ששת המרכיבים (1, 2, 4, 5, 6+24, 10, 12, 19, 21, 25, 30); 11 מקרי שימוש עם תרשימים.
4. **ה-PRD**: גרסה 1.18. מולאו סעיפים 1 עד 7, 9 עד 12, 21, 22 ו-37.

## מה נסגר מאז הסיכום הקודם

5. **אב טיפוס** גרסה 1 אושר ופורסם (https://claude.ai/artifact/KDJkGC7zMEFhtQiwNbsufL). האימות מול משתמשים נדחה בהכרעת הצוות.
6. **ERD** רעיוני ולוגי (26 טבלאות, אין מחיקה פיזית), **מפת המודולים** גרסה 2, **מסמך הבנייה** CLAUDE.md.
7. **Supabase**: פרויקט fitness-app (ovnnhmueoaufgbtipwpd), מקושר למאגר.
8. **שלב 1, החוזה והשלד: נסגר.** Unit 6/6, Integration 8/8, בענן: 26 טבלאות עם RLS, 28 קודי שגיאה, 90 שורות Registry. הדוח: findings-stage-1.md.
9. ה-PRD בגרסה 1.20.
10. **שלב 2, העיצוב והמסכים: נסגר.** 23 מסכים אושרו (תצוגה: https://claude.ai/artifact/KDuZ5xb597GS94nnE43jkL). מפת המודולים גרסה 3. בדיקות: 71/71 באפליקציה. הדוח: findings-stage-2.md.
11. **שלב 3, ה-Slice הראשון: נסגר.** S04 מול programs, על נתוני הדגמה במסד, מקומי ובענן. client.ts מנתב את S04 ל-Endpoint אחרי כניסה במייל וסיסמה; כל שאר המסכים על ההדגמה. בענן: migrations 0005 (נתוני הדגמה) ו-0006 (שמירה אטומית), הפונקציה api, וארבעה משתמשי הדגמה שהצוות יצר (הסיסמאות אצל הצוות). בדיקות: Unit 16, Integration 14, System 9, Vitest 76. CLAUDE.md גרסה 2, usecase-01 גרסה 2. הדוח: findings-stage-3.md.

12. **שלב 4א, trainees, exercises, programs ו-results: נסגר.** M01 (list_trainees, invite_trainee), M02 (create_exercise, attach_video, get_exercise) ו-M04 (log_workout, correct_result, list_results). LIVE_SCREENS: S02, S04 ו-S05. בענן: migration 0007 (שמירת אימון ותיקון אטומיים) והפונקציה api. בדיקות על מסד נקי: Unit 48, Integration 23, System 28, Vitest 79. מפת המודולים גרסה 4, ו-usecase-03, 04 ו-09 גרסה 2. הדוח: findings-stage-4a.md.

13. **שלב 4ב, progress, feedback, coins, challenges ו-home: נסגר.** M05 (גרף, שיא, רצף), M06 (משוב, הערות מאמן), M07 (מטבעות, יעד, תגמולים, מימוש), M08 (אתגר שבועי), M13 (בית מתאמן ובית מאמן). LIVE_SCREENS: 13 מסכים (S02, S04 עד S07, S09, S10, S14 עד S16, S18, S20, S21); מסכי המתאמן יעבדו בדפדפן עם כניסת מתאמן בשלב 5. בענן: migrations 0008 (Registry, מפה גרסאות 4 עד 6) ו-0009 (מטבעות אטומיים), והפונקציה api. בדיקות על מסד נקי: Unit 114, Integration 30, System 60, Vitest 90. מפת המודולים גרסה 6; CLAUDE.md גרסה 3; usecase-05 עד 08 גרסה 2 ו-usecase-09 גרסה 3. הסקירה וההדגמה הציבוריות עודכנו למצב 4ב. הדוח: findings-stage-4b.md.

14. **שלב 4ג, classes ו-notifications: נסגר.** M11 (פרסום, הרשמה, רשימת המתנה, הצעת מקום שפוקעת בפעולה הבאה, ביטול עד cancelHours ובקשה חריגה, ביטול שיעור, נוכחות עם מטבעות) ו-M12 (הודעות בתוך האפליקציה). הערת מאמן מגיעה כהודעה (פער 4 מ-4ב). LIVE_SCREENS: 16 מסכים, ובהם S11, S13 ו-S17. בענן: migration 0010 (פונקציות הרשמה אטומיות, סגורות לדפדפן) והפונקציה api. בדיקות על מסד נקי: Unit 153, Integration 37, System 75, Vitest 96. מפת המודולים גרסה 7; usecase-11 גרסה 2 ו-usecase-06 גרסה 3. הדוח: findings-stage-4c.md.

15. **שלב 4ד, payments, invoices ו-settings: נסגר. שלב 4 הושלם.** M09 (בקשת תשלום במחיר מ-SETTINGS, רשימה, תשלום הדגמה: חיוב, חשבונית, ואז "שולמה"), M10 (חשבונית אחת לכל בקשה), M14 update_settings (מפתחות קיימים, הכול או כלום), ו-M01 get_trainee_card. LIVE_SCREENS: 21 מסכים; רק S22 ו-S23 על ההדגמה. בית המאמן בלי שורות סירוב. בענן: migration 0011 (שלוש שורות M01, S06 מול get_settings, נוסח CANCEL_TOO_LATE) והפונקציה api. בדיקות על מסד נקי: Unit 177, Integration 44, System 89, Vitest 104. מפת המודולים גרסה 8; CLAUDE.md גרסה 4; usecase-02 גרסה 2. התשלום המוצלח מקצה לקצה ממתין לשער I02 בשלב 5. הדוח: findings-stage-4d.md.

16. **שלב 5, הממשקים: נסגר.** I01 (הרשמה, כניסה לשני התפקידים דרך trainees.get_me, כניסה מקישור המייל, חידוש, כניסה שנשמרת בין טעינות, יציאה; בשרת, מצטרף רשאי רק ל-S22), I02 (שער הדגמה שמאשר; התשלום המוצלח מקצה לקצה), I03 (קישור מלא מ-SITE_URL, ומייל דרך שירות ההזמנות של Supabase Auth), I04 (הדלי videos, העלאה בשני צעדים דרך exercises.prepare_upload, נגן ב-S05 וב-S14). settings.get_error_texts נבנה בשרת. S12 מציג את המגבלות ואת התזכורת. 23 המסכים ב-LIVE_SCREENS. בענן: migration 0012, הפונקציה api ו-SITE_URL; הצוות שינה את הגדרות הזהות, נכנס כמאמן וכנועה, ושלח הזמנה במייל שהגיעה. בדיקות על מסד נקי: Unit 198, Integration ו-System 157 (ואחד במצב decline), Vitest 114. מפת המודולים גרסה 10; CLAUDE.md גרסה 6; usecase-04 גרסה 3 ו-usecase-10 גרסה 2; נוסח מייל ההזמנה בעברית אושר (doc-invite-email-template.md). הדוח: findings-stage-5.md.

## מה ממתין

| השלב | מה |
| :-- | :-- |
| 7 | נתוני אמת ופריסה, לפי CLAUDE.md סעיף 6 (שלב 6, AI, אינו בגרסה הראשונה). להכין בתוכנית: הסרת נתוני ההדגמה, הזמנת הבדיקה בענן ומשתמשי הזהות שנשארו (דוח 5, פערים 5 ו-10), קישורי היוטיוב האמיתיים, קובץ GitHub Actions, ו-SITE_URL מול כתובת הפריסה |
| לצוות, בלוח הבקרה | נוסח מייל ההזמנה (doc-invite-email-template.md) אושר, אבל Supabase מאפשר לערוך את התבנית רק אחרי הגדרת SMTP משלכם. לכן ההדבקה תלויה בהכרעה על ספק מייל חיצוני למתאמנים שאינם בצוות: להכרעה לפני שלב 7 (דוח 5, פער 2) |
| חובות פתוחים | פער 1 מ-4ב (שם תרגיל לא פעיל ב-S04) עם פער 11 מ-4א; פערים 12 ו-13 מ-4א (S05, S02); מבחני uc01 על מסד משומש; אימות פער 14 מ-4א בשלב 7 (נראה שוב בענן ב-4ג); מחיקת שורת הבדיקה ב-stage3-acceptance (דוח 4ד, פער 8) |
| להכרעת הצוות | כפולי Drive: presentations/presentation-community 2 במאגר, output/presentation-community 2 מחוץ למאגר, ותיקיית הספרייה "course-library 3" (CLAUDE.md סעיף 10 קורא לה course-library) |

## כלים במחשב

~/bin: gh, supabase, deno, node, npm, npx. Docker Desktop נדרש פתוח לבדיקות מקומיות.

**הרצה מקומית** (עודכן בשלב 5): קובצי הערכים של הפונקציה supabase/functions/.env ו-.env.decline, מחוץ ל-Git (SITE_URL, PUBLIC_API_URL, PAYMENT_GATEWAY_MODE). הכשל של השער: `supabase functions serve --env-file supabase/functions/.env.decline`, ואז `PAYMENT_GATEWAY_MODE=decline node --test tests/system/uc02-payments.test.mjs tests/integration/stage4d.test.mjs`. שינוי ב-config.toml (למשל כתובות ההחזרה) נטען רק אחרי `supabase stop` ו-`supabase start`. המייל המקומי: Mailpit בפורט 54324. בדיקת S05 ו-S14 בבדיקות התוכן (LIVE_DB=1) צריכה שמבחן UC10 רץ קודם על אותו מסד.  .claude/launch.json בשורש הפרויקט (מחוץ ל-Git): fitness-app (פורט 5174, מול המסד המקומי, app/.env.local) ו-fitness-app-cloud (פורט 5175, מול הענן, app/.env.cloud.local). שני קובצי הערכים אינם במאגר. הבדיקות המקומיות: `supabase db reset --local`, `supabase functions serve`, ואז `node --test --test-concurrency=1 tests/integration/*.test.mjs tests/system/*.test.mjs`; הן יוצרות את משתמשי ההדגמה המקומיים בעצמן (tests/system/demo-users.mjs). בדיקות התוכן של המסכים מול המסד: `LIVE_DB=1 npx vitest run` בתיקייה app. מבחני uc01 משלב 3 דורשים מסד נקי. מבחני 4ב עד 4ד יוצרים לעצמם מאמן ומתאמנים חדשים "(test)", אימונים בתאריכים יחסיים ושיעורים בשעות יחסיות (freshWorld, workoutDaysAgo, classInHours ו-paymentRequest ב-demo-users.mjs), ולכן אינם תלויים ביום ההרצה. שאילתת קריאה בענן: `supabase db query --linked`.

**ההצגה**: הסקירה https://claude.ai/artifact/1SurjPwYwJHiCm5yGGK5Rf וההדגמה https://claude.ai/artifact/SAimtvMbbnEynAMCPzU6UA. ההדגמה נבנית מהקוד (`vite build` עם ערכי VITE_ ריקים, והקוד מוטמע בעמוד אחד), על נתוני דוגמה ובלי כתובת שרת. הבנייה האחרונה ב-presentations/fitness-app-demo.html, מחוץ למאגר.

**לידיעה**: סנכרון Drive יוצר עותקים כפולים בשם "X 2" (קבצים ותיקיות). migration כפולה שוברת את `db reset` ואת ההעלאה לענן. לבדוק ב-`git status` בפתיחת כל שלב.

## הנחיית המשך

פתח שיחה חדשה ב-Claude Code במחשב הצוות, קרא את CLAUDE.md גרסה 6, את file-system-index, את הקובץ הזה, את findings-stage-5.md ואת doc-module-map.md גרסה 10, והתחל בתוכנית שלב 7 (נתוני אמת ופריסה) לפי פרומפט 2 במנגנון הבנייה. הפריסה לייצור דורשת אישור הצוות (CLAUDE.md סעיף 10). לפני התוכנית: `git pull` של main, `git status` לבדיקת כפולים מסנכרון Drive, ו-Docker Desktop פתוח. כל התשובות לצוות בעברית.
