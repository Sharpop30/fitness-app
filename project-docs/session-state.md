# סיכום מצב: fitness-app

| שדה | ערך |
| :-- | :-- |
| תאריך | 28.09.2026 |
| הצ'ט | Claude Code, צ'ט שלב 4א |

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

## מה ממתין

| השלב | מה |
| :-- | :-- |
| 4ב | progress, feedback, coins, challenges, home. לבנות לפי החוזה שבמפה גרסה 4, "הפניות מ-results.log_workout": log_workout כבר פונה ל-build_feedback, award ו-check_progress. progress.get_streak חדש, ושורות ה-Registry שלו (M01, M13) נכנסות בשלב הזה. S14, S15, S16 ו-S06 עוברים ל-Endpoint כשהפעולות שלהם בנויות. חובות: בדיקת תוכן ל-S04 בבלוק החי של screens.test.tsx, ופערים 12 ו-13 (S05, S02) כשהמסכים נפתחים שוב |
| 4ג עד 7 | לפי CLAUDE.md סעיף 6. get_trainee_card בסוף 4ד |

## כלים במחשב

~/bin: gh, supabase, deno, node, npm, npx. Docker Desktop נדרש פתוח לבדיקות מקומיות.

**הרצה מקומית**: .claude/launch.json בשורש הפרויקט (מחוץ ל-Git): fitness-app (פורט 5174, מול המסד המקומי, app/.env.local) ו-fitness-app-cloud (פורט 5175, מול הענן, app/.env.cloud.local). שני קובצי הערכים אינם במאגר. הבדיקות המקומיות: `supabase db reset --local`, `supabase functions serve`, ואז `node --test --test-concurrency=1 tests/integration/*.test.mjs tests/system/*.test.mjs`; הן יוצרות את משתמשי ההדגמה המקומיים בעצמן (tests/system/demo-users.mjs). בדיקות התוכן של המסכים מול המסד: `LIVE_DB=1 npx vitest run` בתיקייה app. מבחני uc01 משלב 3 דורשים מסד נקי. שאילתת קריאה בענן: `supabase db query --linked`.

**לידיעה**: סנכרון Drive יוצר עותקים כפולים בשם "X 2" (קבצים ותיקיות). migration כפולה שוברת את `db reset` ואת ההעלאה לענן. לבדוק ב-`git status` בפתיחת כל שלב.

## הנחיית המשך

פתח שיחה חדשה ב-Claude Code במחשב הצוות, קרא את CLAUDE.md, את file-system-index, את הקובץ הזה, את findings-stage-4a.md ואת doc-module-map.md גרסה 4, והתחל בתוכנית שלב 4ב לפי פרומפט 2 במנגנון הבנייה. לפני התוכנית: `git pull` של main, `git status` לבדיקת כפולים מסנכרון Drive, ו-Docker Desktop פתוח.
