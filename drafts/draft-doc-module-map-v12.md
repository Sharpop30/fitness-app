# מפת המודולים: אפליקציית ניהול מאמן כושר

**מעמד**: טיוטה לאישור הצוות, 01.10.2026, גרסה 12: מדוח שלב 4ה, פערים 2 ו-4, ומהכרעת הצוות 01.10.2026 על S12 (חלופה 1: המאמן אינו רואה את הגדרות העסק). גרסה 11 (בעל העסק) אושרה 30.09.2026. לפי התבנית template-module-map (פריט 47), חלק ב, ופרומפט צעד 27; מתודולוגיית הכוכב (פריט 45); מנגנון הבנייה (פריט 46). ממלאת את סעיפים 14 עד 16 ב-PRD.

## 1. פתיח

| השדה | הערך |
| :-- | :-- |
| הפרויקט | אפליקציית ניהול מאמן כושר (fitness-app) |
| השאלה האסטרטגית | **ליבה חדשה**. אין מערכת ארגונית קיימת להתחבר אליה. קוד FORM הוא מקור השראה בלבד (doc-work-plan, הכרעה 3.2) |
| יעד ההרצה | **Deployment לענן**. מסד, זהות ואחסון קבצים ב-Supabase; השרת כ-Endpoint יחיד ב-Supabase Edge Function; האפליקציה כאתר נייד (PWA). אחסון האתר: **GitHub Pages** (הכרעת הצוות) |
| המקורות | PRD גרסה 1.19; doc-mlp-scope גרסה 2; 12 סיפורי משתמש ו-12 מקרי שימוש (usecase-01 עד 12); doc-erd-conceptual ו-doc-erd-logical, גרסה 2; prototype-fitness-app גרסה 3 |
| גרסה ותאריך | 12, 01.10.2026 |

## 2. הליבה

**ישויות הליבה**: הישויות שיותר ממודול אחד צריך. כל השאר הם נתונים פרטיים של מודול.

| הישות | הטבלאות | המצבים והמעברים | מי מעביר |
| :-- | :-- | :-- | :-- |
| עסק ובעל עסק | BUSINESSES, OWNERS | פעיל ↔ לא פעיל | הקמה |
| מאמן | COACHES | הוזמן → פעיל ↔ לא פעיל | הקמה (הראשון), business (בהזמנה) |
| מתאמן | TRAINEES | הוזמן → פעיל → לא פעיל | trainees |
| תרגיל | EXERCISES | פעיל ↔ לא פעיל | exercises |
| תוכנית | PROGRAMS, WORKOUTS, WORKOUT_ITEMS | פעילה → לא פעילה (כשנבנית חדשה) | programs |
| אימון שבוצע | WORKOUT_LOGS, SET_RESULTS | נשמר → תוקן (סימון) | results |

**ה-Business Logic**, כללים ממוספרים:

1. למתאמן תוכנית פעילה אחת לכל היותר. תוכנית חדשה הופכת את הקודמת ללא פעילה.
2. החלפת תרגיל שומרת את המקום בסדר (sortOrder), ואינה נוגעת בתוצאות קודמות.
3. יעד לתרגיל: סטים וחזרות חיוביים, משקל לא שלילי (0 במשקל גוף).
4. תוצאה: חזרות ומשקל לא שליליים. תיקון מסמן isCorrected ואינו מזכה שוב במטבעות.
5. מאמן פועל רק על המתאמנים שלו; מתאמן פועל רק על הנתונים שלו; בעל העסק קורא את הנתונים של כל המאמנים בעסק שלו, בשמות ובסיכומים בלבד, בלי תוצאות אימון, הערות מאמן ויעדים אישיים, ואינו כותב לנתוני מתאמנים.
6. אין מחיקה פיזית בשום ישות. יציאה משימוש היא סימון לא פעיל.
7. השיא האישי, הרצף והיתרה מחושבים, ואינם נשמרים.
8. רצף: אינו מתאפס כל עוד עברו עד N ימים בין אימונים (N ב-SETTINGS, 3).
9. מאמן שייך לעסק אחד. מאמן עצמאי הוא עסק של אדם אחד, שהוא גם בעליו. ל-SETTINGS עסק, ולא מאמן: בעל העסק רואה ומעדכן אותן ב-S12; המאמן והמתאמן אינם רואים את הטבלה, והמודולים קוראים ממנה את הערכים שחלים עליהם (גרסה 12).
10. משתמש זהות אחד יכול להיות בעל עסק ומאמן באותו עסק, ועובר בין התפקידים בלי כניסה חוזרת.

## 3. המודולים

כל המודולים במצב ביצוע **אדם ממתין וכלל משיב (קוד רגיל)**, בדרגת מימוש **קוד רגיל**. אין AI בגרסה הראשונה.

### מודולי Backend

| מזהה | המודול | האחריות האחת | הדרישות | קורא מהליבה | כותב לליבה | נתונים פרטיים | מצב |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| M01 | trainees | הזמנה, הצטרפות ורשימת מתאמנים | 19 | מאמן, תוכנית | מתאמן | INVITES | טרם נבנה |
| M02 | exercises | רשימת התרגילים וסרטוני ההדגמה | 1, 10 | מאמן | תרגיל | | טרם נבנה |
| M03 | programs | בניית תוכנית והחלפת תרגיל | 1 | מתאמן, תרגיל | תוכנית | | טרם נבנה |
| M04 | results | הזנת תוצאות ותיקונן | 12 | תוכנית | אימון שבוצע | | טרם נבנה |
| M05 | progress | גרף התקדמות, שיא אישי ורצף | 4, 25 | אימון שבוצע, תרגיל | | | טרם נבנה |
| M06 | feedback | משוב מיידי והערות מאמן | 21 | אימון שבוצע | | COACH_NOTES | טרם נבנה |
| M07 | coins | מטבעות, יעד אישי ותגמולים | 6, 24 | אימון שבוצע, תרגיל | | PERSONAL_GOALS, COIN_TRANSACTIONS, REWARDS, REDEMPTIONS | טרם נבנה |
| M08 | challenges | אתגר שבועי והשלמה אוטומטית | 5 | אימון שבוצע, תוכנית | | CHALLENGES, CHALLENGE_COMPLETIONS | טרם נבנה |
| M09 | payments | בקשות תשלום ותשלום הדגמה | 2 | מתאמן | | PAYMENT_REQUESTS | טרם נבנה |
| M10 | invoices | חשבוניות הדגמה ממוספרות | 2 | מתאמן | | INVOICES | טרם נבנה |
| M11 | classes | שיעורים, הרשמה, המתנה, ביטול ונוכחות | 30 | מתאמן | | CLASSES, CLASS_REGISTRATIONS, LATE_CANCEL_REQUESTS | טרם נבנה |
| M12 | notifications | הודעות בתוך האפליקציה | 21, 25, 30 | מתאמן | | NOTIFICATIONS | טרם נבנה |
| M13 | home | מסך הבית של המאמן, של המתאמן ושל בעל העסק, מפעולות קיימות בלבד | 15, 19, 25 | הכול, דרך פעולות | | | טרם נבנה |
| M14 | settings | טבלת הייחוס של העסק, שבעל העסק משנה | 2, 5, 6, 15, 21, 25, 30 | עסק | | SETTINGS | טרם נבנה |
| M15 | business | מאמנים בעסק: הזמנה, הצטרפות, רשימה, כרטיס מאמן, ומדדי העסק | 15 | עסק ובעל עסק, מאמן, מתאמן | מאמן | COACH_INVITES | טרם נבנה |

### רכיבי הליבה והתשתית

| מזהה | הרכיב | האחריות | סוג |
| :-- | :-- | :-- | :-- |
| C01 | Endpoint ו-Orchestrator | שער יחיד: בדיקת הפונה, רשימת המותר, ניתוב, רישום | ליבה |
| C02 | Registry | רשימת המותר כטבלה (REGISTRY_ENTRIES) | ליבה, נתונים |
| C03 | Audit Log | רישום כל בקשה ותשובה (AUDIT_ENTRIES). כשל ברישום עוצר | ליבה |
| C04 | Repository | הקובץ היחיד שנוגע במסד ובאחסון הקבצים | Data Access |
| C05 | Error Codes | רשימה סגורה והסבר לבני אדם (ERROR_CODES) | ליבה, נתונים |

### מודולי ממשק

| מזהה | הממשק | הסוג | מה מאחוריו |
| :-- | :-- | :-- | :-- |
| I01 | Identity Connector | מתאם (Connector) | Supabase Auth |
| I02 | Payment Gateway | שער (Gateway) | מימוש מדומה בגרסה הראשונה, שמאשר; ספק אמיתי [טרם נקבע] |
| I03 | Invite Channel | מתאם | קישור לשיתוף, מלא מכתובת האתר (SITE_URL), ומייל דרך שירות ההזמנות של Supabase Auth. משמש להזמנת מתאמן ולהזמנת מאמן |
| I04 | File Storage | דרייבר בתוך ה-Repository | Supabase Storage, דלי אחד (videos) לסרטונים שהועלו: פתוח לצפייה, וכתיבה רק בכתובת חתומה שה-Endpoint מנפיק |

### מודולי Frontend

מודול העיצוב **D01**: אסימוני העיצוב של FORM ורכיבי הבסיס. כל המסכים משתמשים בו. כל מסך הוא מודול, ופונה ל-Endpoint היחיד בלבד:

"עוד" אצל המאמן ואצל בעל העסק, ו"אני" אצל המתאמן, הם תפריטי ניווט בתוך מעטפת האפליקציה, בלי פעולות משלהם, ואינם מסכים נוספים. המעבר בין בעל העסק למאמן יושב ב"עוד" של שניהם, ומוצג רק למשתמש שיש לו שני התפקידים.

| מאמן | מתאמן | בעל העסק | משותף |
| :-- | :-- | :-- | :-- |
| S01 בית מאמן · S02 מתאמנים והזמנה · S03 כרטיס מתאמן · S04 בניית תוכנית והחלפה · S05 תרגילים וסרטונים · S06 תוצאות והערות · S07 יעד אישי · S08 תשלומים וחשבוניות · S09 אתגר · S10 תגמולים · S11 שיעורים ונוכחות | S13 בית מתאמן · S14 אימון והזנה · S15 משוב · S16 האימונים שלי ותיקון · S17 שיעורים · S18 מטבעות · S19 תשלומים · S20 אתגר | S24 סקירה עסקית · S25 מאמנים והזמנה · S26 מדדים · S27 כרטיס מאמן · S12 הגדרות העסק | S21 גרף התקדמות · S22 הצטרפות בהזמנה, של מתאמן או של מאמן · S23 כניסה ובחירת תפקיד |

## 4. החוזה

**מעטפת הבקשה**: `{ caller, module, action, payload, lang }`. **מעטפת התשובה**: `{ ok, data, error }`. הפונה (caller) חובה, מתוך רשימה סגורה: מזהי המסכים S01 עד S27, מזהי המודולים M01 עד M15, ו-system.

**התפקיד** (גרסה 11): ה-Orchestrator מוצא את כל התפקידים של המשתמש (owner, coach, trainee, לפי OWNERS, COACHES ו-TRAINEES), ומקבל את הבקשה אם יש שורת Registry לפונה, למודול ולפעולה באחד מהם. התפקיד שבשורה עובר למודול. כשיותר מתפקיד אחד מתאים (S23), owner גובר על coach, כי הם באותו עסק ורואים אותם ערכים. מבנה המעטפה אינו משתנה.

### הפעולות

| המודול | הפעולה | המקור | מי רשאי |
| :-- | :-- | :-- | :-- |
| trainees | invite_trainee, accept_invite, list_trainees, get_trainee_card, get_me | UC4, UC12 | מאמן; accept: בעל ההזמנה, משתמש מזוהה שעוד אינו מאמן או מתאמן; get_me: בעל עסק, מאמן ומתאמן; list_trainees: גם business, בשם בעל העסק. get_trainee_card מרכיב את הכרטיס דרך ה-Orchestrator מ-programs.get_active_program, coins.get_balance, payments.list_payments ו-progress.get_streak |
| exercises | list_exercises, create_exercise, prepare_upload, attach_video, get_exercise | UC1, UC10 | מאמן; get: גם מתאמן |
| programs | get_active_program, save_program, swap_exercise, start_new_program | UC1 | מאמן; get: גם המתאמן שלו |
| results | log_workout, correct_result, list_results | UC3 | מתאמן (שלו); list: גם המאמן; list מ-business: ספירת אימונים לפי מתאמן בלבד, בלי הסטים (כלל 5) |
| progress | get_progress_chart, detect_personal_records, get_streak | UC5, UC6, UC9 | מאמן, מתאמן (שלו); detect: feedback בלבד; get_streak: trainees, home, business בלבד |
| feedback | build_feedback, add_coach_note, get_workout_notes | UC6 | build: results בלבד; note: מאמן |
| coins | award, get_balance, set_personal_goal, manage_rewards, redeem_reward, mark_reward_delivered | UC7 | award: results, challenges, classes בלבד |
| challenges | create_challenge, get_current_challenge, check_progress, list_completions, mark_prize_delivered | UC8 | check: results בלבד; list_completions: גם business |
| payments | create_payment_request, list_payments, pay_demo | UC2 | מאמן; pay_demo: מתאמן (שלו); list_payments: גם home ו-business, בשם בעל העסק |
| payment_gateway | charge | UC2 | payments בלבד |
| invite_channel | send_invite | UC4, UC12 | trainees, business בלבד |
| invoices | create_invoice, list_invoices | UC2 | create: payments בלבד |
| classes | publish_class, cancel_class, list_upcoming_classes, register, cancel_registration, list_registrations, mark_attendance, respond_to_spot_offer, request_late_cancel, decide_late_cancel | UC11 | לפי מקרה שימוש 11; list_upcoming_classes: גם home ו-business, בשם בעל העסק |
| notifications | notify_in_app, list_notifications, mark_read | UC6, UC9, UC11 | notify: classes, feedback בלבד |
| home | get_coach_home, get_trainee_home, get_owner_home | UC4, UC9, UC12 | מאמן; מתאמן; בעל העסק. get_owner_home מרכיב את המסך דרך ה-Orchestrator מ-payments.list_payments, classes.list_upcoming_classes, coins.manage_rewards (op: list), trainees.list_trainees ו-business.list_coaches, לכל העסק. get_coach_home מרכיב את המסך דרך ה-Orchestrator מ-trainees.list_trainees, payments.list_payments, classes.list_upcoming_classes, coins.manage_rewards (op: list), challenges.get_current_challenge ו-challenges.list_completions |
| settings | get_settings, update_settings, get_error_texts | כל מקרה שימוש עם טבלת ייחוס; get_error_texts: כלל החוזה 8 | get_settings: בעל העסק מ-S12, המאמן מ-S06 (noteMaxLength), והמודולים; update_settings: בעל העסק בלבד; get_error_texts: בעל עסק, מאמן ומתאמן, מ-S23, ומצטרף מ-S22 |
| business | invite_coach, accept_coach_invite, list_coaches, get_coach_card, get_kpis | UC12 | בעל העסק; accept: בעל ההזמנה, משתמש מזוהה שעוד אינו מאמן או מתאמן, מ-S22; list_coaches: גם home. get_coach_card מרכיב דרך ה-Orchestrator מ-trainees.list_trainees, payments.list_payments, classes.list_upcoming_classes ו-progress.get_streak. get_kpis מרכיב מ-trainees.list_trainees, payments.list_payments, challenges.list_completions ו-results.list_results |

**רשימת המותר (Registry)** היא טבלה: שורה לכל צירוף של פונה, מודול ופעולה מהטבלה שלמעלה. בקשה בלי שורה נדחית ונרשמת. הקובץ המלא נוצר בשלב 1 מהטבלה הזו.

**שורות שנוספו בגרסה 4** (מדוח שלב 4א, פער 1), לפונה מודול: M01 מול programs.get_active_program, coins.get_balance, payments.list_payments ו-progress.get_streak; M13 מול progress.get_streak. הן נכנסות ל-Registry בשלב שבונה את הפעולה: get_streak בשלב 4ב, get_trainee_card בסוף 4ד.

**שורות שנוספו בגרסה 5** (תוכנית שלב 4ב, הכרעה 3), נכנסות ל-Registry בשלב 4ב: M13 מול coins.manage_rewards ומול challenges.list_completions, כי get_coach_home מחזיר rewardsToDeliver ואת מספר המשלימים באתגר; ו-S09 מול exercises.list_exercises, לבחירת התרגיל באתגר מסוג "יעד בתרגיל".

**שורה שנוספה בגרסה 6** (שלב 4ב, משימה 3), נכנסת ל-Registry בשלב 4ב: M05 מול settings.get_settings, כי get_streak קורא את streakGapDays מ-SETTINGS (UC9 צעד 4, כלל 8).

**החוזים שנוספו בגרסה 7** (תוכנית שלב 4ג, הכרעות 2 עד 4): הקלט והתשובה של notifications.notify_in_app; הטווח של classes.list_upcoming_classes למאמן ולמתאמן; מה המתאמן רואה על נרשמים אחרים; ומבנה lateRequests. אין שורות Registry חדשות: כל השורות של 4ג קיימות מ-0002.

**החוזים שנוספו בגרסה 8** (תוכנית שלב 4ד, הכרעות 2 עד 6), ושורה אחת: S06 מול settings.get_settings, כדי שהמסך יציג את אורך ההערה המרבי (noteMaxLength) מ-SETTINGS ולא מספר קבוע (דוח 4ב, פער 2). נכנסת ל-Registry בשלב 4ד, יחד עם שלוש שורות M01 מגרסה 4 שנותרו (programs.get_active_program, coins.get_balance, payments.list_payments).

**החוזים שנוספו בגרסה 9** (תוכנית שלב 5, הכרעות 1 עד 5 ו-7), ושלוש שורות Registry, נכנסות ב-0012: S23 מול trainees.get_me, למאמן ולמתאמן; S05 מול exercises.prepare_upload, למאמן.

**הצטרפות בהזמנה** (תוכנית שלב 5, הכרעה 3): משתמש שזוהה בשירות הזהות ואין לו שורה ב-COACHES או ב-TRAINEES מקבל תפקיד trainee בלי מזהה מתאמן, ורק לבקשות S22 מול trainees.accept_invite ומול settings.get_error_texts (גרסה 10, כדי שהצטרפות שנכשלה תוצג בנוסח שלה, UC4 א). כל בקשה אחרת שלו נדחית ב-NOT_ALLOWED ונרשמת, כמו היום. ההצטרפות אטומית: המתאמן נוצר וההזמנה נסגרת יחד, בתנאי שהיא פתוחה ובתוקף, כך שאסימון אחד יוצר מתאמן אחד.

**החוזים שנוספו בגרסה 11** (usecase-12; הכרעות הצוות 3 עד 7 ב-doc-owner-role): התפקיד owner, המודול business (M15), הפעולה home.get_owner_home, המסכים S24 עד S27, SETTINGS לפי עסק, והרשאת update_settings לבעל העסק בלבד. השורות נכנסות ב-migration חדשה משלה, בשלב 4ה. השורה S12 מול settings.update_settings לתפקיד coach יוצאת משימוש (isActive=false, כלל 9 בחוקי הברזל).

**שורה ותשובות שנוספו בגרסה 12** (דוח שלב 4ה, פערים 2 ו-4; נכנסו כבר ב-0014 ובקוד של 4ה): M15 מול settings.get_settings, כי invite_coach קורא את inviteValidDays של העסק (UC12 צעד 4). והפעולות הקיימות כשבעל העסק פונה אליהן דרך M13 או M15 (תוכנית 4ה, הכרעה 5): לכל העסק כברירת מחדל, או למאמן אחד של העסק כש-coachID בקלט; מאמן מחוץ לעסק, או coachID שאינו מזהה, מחזיר NOT_ALLOWED. בעל העסק קורא בלבד: אינו מקבל שמות של נרשמים לשיעור, סטים, הערות או יעדים, ואינו מקדם הצעות מקום שפגו. מבנה התשובה לבעל העסק כתוב בטבלה שלמטה, ליד כל פעולה. ומהכרעת הצוות 01.10.2026 (חלופה 1): S12 הוא מסך של בעל העסק בלבד. השורה S12 מול settings.get_settings לתפקיד coach יוצאת משימוש (isActive=false), ו"הגדרות העסק" יורדות מ"עוד" של המאמן. ההגדרות ממשיכות לחול על המאמן דרך המודולים.

**הצטרפות מאמן בהזמנה** (גרסה 11): כמו הצטרפות מתאמן. משתמש מזוהה בלי שורה ב-OWNERS, ב-COACHES או ב-TRAINEES רשאי מ-S22 גם ל-business.accept_coach_invite. הקישור נושא ?coach=אסימון, ו-S22 בוחר את הפעולה לפיו. ההצטרפות אטומית: המאמן נוצר עם ה-BusinessID של ההזמנה, וההזמנה נסגרת יחד.

**הסרטון שהועלה** (תוכנית שלב 5, הכרעה 5): בשני צעדים, דרך ה-Endpoint. exercises.prepare_upload בודק את האורך מול videoMaxSeconds ואת הגודל מול videoMaxMegabytes, ומחזיר כתובת העלאה חתומה לנתיב אחד של התרגיל. client.ts מעלה את הקובץ לכתובת הזו. exercises.attach_video בסוג upload מקבל את הנתיב, ושומר אותו רק אחרי שה-Repository מצא את הקובץ בדלי. העלאה שלא הושלמה מחזירה UPLOAD_FAILED, והתרגיל נשאר בלי שינוי.

**השער המדומה** (תוכנית שלב 5, הכרעה 4): payment_gateway.charge מאשר. לבדיקת הכשל, משתנה סביבה מקומי (PAYMENT_GATEWAY_MODE=decline) גורם לו לדחות; תשובה שאינה מגיעה בזמן היא כשל. בשני המקרים payments מחזיר PAYMENT_GATEWAY_UNAVAILABLE, כמו בגרסה 8.

**התשלום לדוגמה, בלי מצב ביניים** (UC2 סעיף 7; תוכנית 4ד, הכרעה 3): payments.pay_demo פונה ל-payment_gateway.charge, ואז ל-invoices.create_invoice, ורק אז מסמן את הבקשה "שולמה", בתנאי שהיא עדיין פתוחה. create_invoice אידמפוטנטי לפי הבקשה, ולכן לבקשה ששולמה יש תמיד חשבונית, וניסיון חוזר אחרי כשל אינו יוצר חשבונית שנייה. שתי בקשות תשלום במקביל: אחת מצליחה, והשנייה מקבלת PAYMENT_ALREADY_PAID. כשל בשער, או שער שעוד לא נבנה, מחזיר PAYMENT_GATEWAY_UNAVAILABLE, והבקשה נשארת פתוחה בלי חשבונית.

**קריאה לאורך הקשר בין בקשה לחשבונית** (תוכנית 4ד, הכרעה 2): payments.list_payments מחזיר את מספר החשבונית של כל בקשה, ו-invoices.list_invoices את שם המתאמן ואת סוג התשלום של הבקשה. שני אלה נקראים ב-Repository לאורך הקשר שב-ERD (INVOICES.PaymentRequestID), לקריאה בלבד. הכתיבה ל-PAYMENT_REQUESTS נעשית רק ב-payments, ול-INVOICES רק ב-invoices.

**כשל אחרי שמירת אימון** (UC3 סעיף 7; דוח שלב 4א, פער 2): אין תור בגרסה הראשונה. התוצאות נשארות שמורות, והשדות של הפנייה שנכשלה חוזרים ריקים. coins.award אידמפוטנטי לפי eventRef, ולכן חישוב חוזר אפשרי בגרסה הבאה.

### טבלת פעולות המסכים

| המסך | הפעולות, ואותן בלבד |
| :-- | :-- |
| S01 | home.get_coach_home |
| S02 | trainees.list_trainees, trainees.invite_trainee |
| S03 | trainees.get_trainee_card |
| S04 | programs.get_active_program, save_program, swap_exercise, start_new_program; exercises.list_exercises |
| S05 | exercises.list_exercises, create_exercise, prepare_upload, attach_video, get_exercise |
| S06 | results.list_results; feedback.add_coach_note, get_workout_notes; settings.get_settings (noteMaxLength) |
| S07 | coins.set_personal_goal; exercises.list_exercises |
| S08 | payments.create_payment_request, list_payments; invoices.list_invoices; trainees.list_trainees |
| S09 | challenges.create_challenge, get_current_challenge, list_completions, mark_prize_delivered; exercises.list_exercises |
| S10 | coins.manage_rewards, mark_reward_delivered |
| S11 | classes.publish_class, cancel_class, list_upcoming_classes, list_registrations, mark_attendance, decide_late_cancel |
| S12 | settings.get_settings, update_settings; לבעל העסק בלבד |
| S13 | home.get_trainee_home; classes.respond_to_spot_offer; notifications.list_notifications, mark_read |
| S14 | programs.get_active_program; results.log_workout; exercises.get_exercise |
| S15 | (מציג את תשובת log_workout, בלי פעולה נוספת) |
| S16 | results.list_results, correct_result; feedback.get_workout_notes |
| S17 | classes.list_upcoming_classes, register, cancel_registration, request_late_cancel |
| S18 | coins.get_balance, redeem_reward |
| S19 | payments.list_payments, pay_demo; invoices.list_invoices |
| S20 | challenges.get_current_challenge |
| S21 | progress.get_progress_chart |
| S22 | trainees.accept_invite או business.accept_coach_invite, לפי הקישור; settings.get_error_texts, לפני ההצטרפות |
| S23 | שירות הזהות; trainees.get_me ו-settings.get_error_texts, פעם אחת אחרי הכניסה, והלקוח שומר את ההסברים. כש-get_me מחזיר יותר מתפקיד אחד, המסך מציע בחירה |
| S24 | home.get_owner_home |
| S25 | business.list_coaches, invite_coach |
| S26 | business.get_kpis |
| S27 | business.get_coach_card |

### מבנה התשובה של כל פעולה

השדה data בתשובה, לפי מה שהמסכים צריכים. השדות נקראים כמו ב-ERD. פעולת כתיבה שאין לה מה להחזיר מחזירה null.

| הפעולה | data |
| :-- | :-- |
| trainees.list_trainees | רשימה: TraineeID או InviteID, fullName, isActive, joined, hasProgram. מתאמן שהצטרף מזוהה ב-TraineeID. הזמנה פתוחה שתוקפה לא פג חוזרת עם InviteID, TraineeID ריק ו-joined=false, כי המתאמן נוצר רק בהצטרפות. לבעל העסק (גרסה 12): אותה רשימה לכל מאמן בטווח, ועם CoachID |
| trainees.invite_trainee | link, קישור ההזמנה לשיתוף: SITE_URL?join=אסימון. SITE_URL חסר מחזיר VALUE_NOT_SET |
| trainees.accept_invite | TraineeID. הקלט: token (אסימון ההזמנה מהקישור), fullName (ריק: השם שבהזמנה). המייל משירות הזהות. הזמנה שפגה או שכבר נוצלה מחזירה INVITE_EXPIRED; משתמש שכבר מאמן או מתאמן מחזיר NOT_ALLOWED |
| trainees.get_me | roles (רשימה: owner, coach, trainee), role (הראשון ברשימה, לתאימות), traineeID (ריק למי שאינו מתאמן), fullName |
| trainees.get_trainee_card | trainee, coins, streak, openPayments, workouts, payments, goal (עם exerciseName). הקלט: traineeID. workouts הוא מספר האימונים בתוכנית הפעילה (0 כשאין); openPayments מספר הבקשות הפתוחות; payments מספר הבקשות; goal היעד הפעיל, או ריק. פנייה שנכשלה מחזירה את השדה שלה ריק |
| exercises.list_exercises, get_exercise, create_exercise, attach_video | תרגיל או רשימה: ExerciseID, exerciseName, isBodyweight, videoType, videoUrl. בסרטון שהועלה, videoUrl היא כתובת הצפייה בדלי. הקלט של attach_video: exerciseID, ו-kind: link עם url, או upload עם path מ-prepare_upload |
| exercises.prepare_upload | uploadUrl, path. הקלט: exerciseID, seconds, megabytes, contentType. לא וידאו מחזיר VIDEO_INVALID; אורך מעל videoMaxSeconds או גודל מעל videoMaxMegabytes מחזירים VIDEO_TOO_LONG |
| programs.get_active_program | התוכנית, ובה workouts ובכל אחד items עם exerciseName ו-hasVideo; ו-inactive, רשימת התוכניות הלא פעילות |
| results.list_results | רשימת אימונים שבוצעו: WorkoutLogID, workoutName, performedAt, sets (עם isCorrected). לבעל העסק (גרסה 12, כלל 5): רשימה של TraineeID, CoachID ו-workouts, מספר האימונים מאז since בקלט (בלי since: מאז ומעולם), למתאמנים הפעילים בטווח. בלי אימונים ובלי סטים |
| results.log_workout | WorkoutLogID, ו-feedback: done, total, records, coins, goal, challenge, text |
| progress.get_progress_chart | exercises, selected, isBodyweight, points (date, value) |
| progress.get_streak | streak, streakGapDays (מ-SETTINGS). הקלט: traineeID. לבעל העסק (גרסה 12): מתאמן של מאמן כלשהו בעסק, אחרת NOT_ALLOWED |
| progress.detect_personal_records | records: שמות התרגילים שנשבר בהם שיא באימון. הקלט: workoutLogID, traineeID. שיא הוא ערך גבוה מכל האימונים הקודמים באותו תרגיל: המשקל, או החזרות בתרגיל משקל גוף (UC5 ב). באימון הראשון בתרגיל אין שיא. ערך מתוקן נספר בערכו המתוקן |
| feedback.get_workout_notes | רשימה: WorkoutLogID, noteText |
| coins.get_balance | balance, history, rewards (הקטלוג הפעיל), goal (היעד האישי הפעיל, עם exerciseName, או ריק) |
| coins.manage_rewards | rewards, redemptions (עם fullName ו-rewardName). op בקלט: list או add. לבעל העסק (גרסה 12): op list בלבד, וכל op אחר NOT_ALLOWED; התשובה redemptions בלבד, עם RedemptionID, CoachID ו-status |
| coins.redeem_reward | balance |
| challenges.get_current_challenge | האתגר, end, coins, ולמתאמן progress (value, target, exempt) |
| challenges.list_completions | רשימה: TraineeID, fullName, completedAt, prizeDeliveredAt. לבעל העסק (גרסה 12): המשלימים באתגר השבוע של כל מאמן בטווח, עם TraineeID, CoachID ו-completedAt |
| payments.list_payments | רשימה: PaymentRequestID, fullName, paymentType, amount, status, createdAt, invoiceNumber, מהחדשה לישנה. למאמן, traineeID בקלט מסנן למתאמן אחד שלו; המתאמן מקבל רק את שלו. לבעל העסק (גרסה 12): הבקשות של כל מאמן בטווח, ובנוסף CoachID ו-paidAt, לסכומי החודש |
| payments.create_payment_request | null. הקלט: traineeID, paymentType (monthly או pack10). הסכום נקרא מ-SETTINGS (priceMonthly, pricePack10) ונשמר בבקשה. מחיר חסר או סוג לא מוכר מחזירים VALUE_NOT_SET |
| payments.pay_demo | invoiceNumber. הקלט: paymentRequestID |
| payment_gateway.charge | null. הקלט: paymentRequestID, amount. אין שדה כרטיס. דחייה או חוסר תשובה: PAYMENT_GATEWAY_UNAVAILABLE |
| invite_channel.send_invite | null. הקלט: name, email, link. השירות לא אישר שליחה (כולל מייל שכבר רשום בשירות הזהות): INVITE_DELIVERY_FAILED |
| invoices.create_invoice | invoiceNumber. הקלט: paymentRequestID, amount. חשבונית אחת לכל בקשה, מסומנת הדגמה |
| invoices.list_invoices | רשימה: invoiceNumber, fullName, paymentType, amount, issuedAt, isDemo, מהחדשה לישנה, באותו סינון כמו list_payments |
| classes.list_upcoming_classes | classes (עם registered, waitlist, myStatus, myWaitPosition), cancelHours, ולמאמן lateRequests (LateCancelRequestID, fullName, startsAt). הטווח: למאמן, שיעורים מתחילת היום לפני שלושה ימים, כדי לסמן נוכחות אחרי השיעור (UC11 צעד 9); למתאמן, שיעורים שעוד לא התחילו. למאמן, registered (TraineeID, fullName, attended) ו-waitlist (TraineeID, fullName); למתאמן, registered ו-waitlist כרשימות באותו אורך, בלי שמות ובלי מזהים, כך שנראה רק מספר המקומות התפוסים והממתינים, ו-myStatus ו-myWaitPosition שלו (כלל 5). לבעל העסק (גרסה 12): classes בלבד, מתחילת השבוע (יום ראשון), לכל מאמן בטווח, עם ClassID, CoachID, startsAt, place, capacity, status ו-registered (מספר), בלי שמות; lateRequests ריק |
| classes.list_registrations | שיעור אחד באותו מבנה |
| classes.register | status, position |
| classes.mark_attendance | awarded, מספר המתאמנים שקיבלו מטבעות |
| notifications.notify_in_app | null. הקלט: traineeID, messageText. המודול הפונה (classes או feedback) כותב את הנוסח, ו-notifications בודק שהמתאמן שייך למאמן של הבקשה |
| notifications.list_notifications | רשימת הודעות שלא נקראו: NotificationID, messageText, createdAt |
| home.get_coach_home | activeTrainees, openPayments, classesToday, lateRequests, rewardsToDeliver, challenge |
| home.get_owner_home | incomeMonth, paidMonth, openPayments, openAmount, coaches, pendingCoaches, activeTrainees, classesWeek (registered, capacity), rewardsToDeliver. כל הסכומים לכל העסק. פנייה שנכשלה מחזירה את השדה שלה ריק |
| business.list_coaches | רשימה: CoachID או CoachInviteID, fullName, joined, trainees (מספר). הזמנה פתוחה שתוקפה לא פג חוזרת עם CoachInviteID ו-joined=false |
| business.invite_coach | link, SITE_URL?coach=אסימון. SITE_URL חסר מחזיר VALUE_NOT_SET. פרט קשר לא תקין: INVITE_INVALID |
| business.accept_coach_invite | CoachID. הקלט: token, fullName. הזמנה שפגה או נוצלה: INVITE_EXPIRED; משתמש שכבר מאמן או מתאמן: NOT_ALLOWED |
| business.get_coach_card | coach, trainees (TraineeID, fullName, hasProgram, streak), income (סכום הבקשות ששולמו), upcomingClasses. הקלט: coachID של העסק, אחרת NOT_ALLOWED. בלי תוצאות, הערות ויעדים (כלל 5) |
| business.get_kpis | activeTrainees, withProgram, invoicedPayments, allPayments, challengeCompletions, loggedThisWeek. לכל העסק. היעדים אינם בתשובה: הם [טרם נקבע] ב-doc-okr-kpi |
| home.get_trainee_home | reminder, streak, streakGapDays, coins, nextWorkout, nextClass, challenge, offers |
| settings.get_settings | כל ערכי SETTINGS של העסק, מפתח וערך, ו-canEdit (אמת לבעל העסק) |
| settings.update_settings | null. הקלט: values, מפתח וערך. רק מפתחות שכבר קיימים לעסק, אחרת NOT_ALLOWED. ערך ריק, או מספר לא תקין במפתח מספרי, מחזיר VALUE_NOT_SET, ושום ערך אינו נשמר. המטבעות שלמים ולא שליליים; המחירים, חלונות הזמן, הרצף, אורך הסרטון, תוקף ההזמנה ואורך ההערה שלמים וחיוביים. מפתח שלא נשלח נשאר כמו שהוא |
| settings.get_error_texts | לכל קוד שגיאה, ההסבר לבני אדם |

### הפניות מ-results.log_workout

אחרי השמירה, results פונה דרך ה-Orchestrator לשלושה מודולים (UC3 צעד 7; דוח שלב 4א, פער 10). כל בקשה נושאת workoutLogID ו-traineeID.

| הפעולה | תוספת בקלט | data | מה results מעביר ל-feedback שב-log_workout |
| :-- | :-- | :-- | :-- |
| feedback.build_feedback | | records (שמות התרגילים עם שיא, מ-progress.detect_personal_records), text | records, text |
| coins.award | reason: "workout", eventRef: workoutLogID | coins (הזיכוי), goal (האם היעד האישי הושג) | coins, goal |
| challenges.check_progress | | challenge (האם האתגר הושלם עכשיו) | challenge |

done ו-total מחושבים ב-results. פנייה שנכשלה מחזירה את השדות שלה ריקים: records רשימה ריקה, coins אפס, goal ו-challenge שקר, text ריק.

### קודי השגיאה, רשימה סגורה (28 קודים)

| הקוד | ההסבר לקוד | ההסבר לבני אדם |
| :-- | :-- | :-- |
| CALLER_MISSING | אין שדה פונה | משהו השתבש. נסה שוב |
| CALLER_INVALID | הפונה אינו ברשימה הסגורה | משהו השתבש. נסה שוב |
| ACTION_NOT_ALLOWED | אין שורה ב-Registry | הפעולה הזו אינה זמינה כאן |
| AUDIT_FAILED | הרישום ביומן נכשל, והבקשה לא נותבה | הפעולה לא בוצעה. נסה שוב בעוד רגע |
| UNEXPECTED_ERROR | תקלה לא צפויה במודול, שאינה תקלת מסד | משהו השתבש. נסה שוב |
| NOT_ALLOWED | הפונה אינו מורשה על הנתון הזה | אין לך גישה לזה |
| STORAGE_UNAVAILABLE | המסד לא החזיר תשובה | השינוי לא נשמר כרגע. נסה שוב |
| VALUE_NOT_SET | ערך נדרש חסר ב-SETTINGS ("עדיין לא") | הערך עוד לא הוגדר בהגדרות |
| PROGRAM_INVALID | יעד חסר או לא חיובי | חסר מידע בתרגיל. השלם סטים, חזרות ומשקל |
| NO_ACTIVE_PROGRAM | אין תוכנית פעילה | התוכנית שלך בהכנה אצל המאמן |
| RESULT_INVALID | תוצאה שלילית או לא מספרית | יש ערך לא תקין באחד הסטים |
| NOTE_INVALID | הערה ריקה או ארוכה מדי | ההערה ריקה או ארוכה מדי |
| INVITE_INVALID | פרט קשר לא תקין | פרט הקשר לא תקין |
| INVITE_EXPIRED | ההזמנה פגה | ההזמנה כבר לא בתוקף. בקש חדשה |
| INVITE_DELIVERY_FAILED | הערוץ לא אישר שליחה | ההזמנה לא נשלחה. אפשר לשלוח שוב או להעתיק קישור |
| VIDEO_INVALID | לא סרטון, או קישור לא תקין | זה לא נראה כמו סרטון |
| VIDEO_TOO_LONG | אורך מעל המותר | אפשר להעלות סרטון של עד דקה |
| UPLOAD_FAILED | אחסון הקבצים לא אישר | הסרטון לא עלה. נסה שוב |
| PAYMENT_ALREADY_PAID | בקשה ששולמה | הבקשה הזו כבר שולמה |
| PAYMENT_GATEWAY_UNAVAILABLE | השער לא הגיב | התשלום לא הושלם. לא בוצע חיוב |
| COINS_INSUFFICIENT | יתרה נמוכה מהמחיר | אין מספיק מטבעות |
| COINS_ALREADY_AWARDED | האירוע כבר זוכה | לא מוצג למשתמש |
| CHALLENGE_EXISTS | כבר יש אתגר לשבוע | כבר יש אתגר השבוע |
| CHALLENGE_INVALID | יעד חסר או לא חיובי | חסר יעד לאתגר |
| CLASS_INVALID | פרטי שיעור חסרים | חסרים פרטים בשיעור |
| ALREADY_REGISTERED | כבר רשום או ממתין | אתה כבר רשום לשיעור הזה |
| CANCEL_TOO_LATE | בתוך חלון הביטול | עבר מועד הביטול. אפשר לבקש חריגה |
| SPOT_OFFER_EXPIRED | זמן ההיענות להצעה עבר | המקום כבר הוצע לבא בתור |

**קלט לא תקין בלי קוד ייעודי** (דוח שלב 4א, פער 7; תוכנית שלב 4ב, הכרעות 6 ו-7): הרשימה נשארת סגורה, והמסך מציג נוסח משלו. תרגיל בלי שם ויעד אישי חסר או לא חיובי מחזירים PROGRAM_INVALID. תגמול בלי שם או מחיר מחזיר VALUE_NOT_SET, כמו באב הטיפוס המאושר. פעולת שיעורים על שיעור שבוטל או שכבר התחיל, ו-notify_in_app עם קלט לא תקין, מחזירים NOT_ALLOWED (דוח 4ג, פער 5).

ההסברים לבני אדם נשמרים ב-ERROR_CODES, ולא בקוד. "אסור" (NOT_ALLOWED, ACTION_NOT_ALLOWED) ו"עדיין לא" (VALUE_NOT_SET) הם קודים נפרדים.

## 5. תרשימים

- **תרשים אב, הארכיטקטורה**: diagram-06-architecture.mmd. ערוצים, Endpoint ו-Orchestrator, המודולים, ה-Repository, המסד והממשקים. כל חיבור עובר דרך ה-Orchestrator.
- **תרשים בן, המודולים העסקיים**: diagram-06a-modules.mmd.
- **הנתונים**: diagram-07 עד 07f (07, 07a ו-07f בגרסה 2). **הזרימות**: diagram-uc01 עד uc12.

## 6. מערך הבדיקות

כל הבדיקות על נתונים סינתטיים מסומנים, מופרדים מנתוני אמת, ומוסרים לפני מסירה.

| הרמה | מה נבדק | המקור |
| :-- | :-- | :-- |
| Unit | כל מודול מול קריטריוני הקבלה של הסיפור שלו. דוגמה, M07: קלט "אימון נשמר" פעמיים עם אותו eventRef; פלט צפוי: זיכוי אחד ו-COINS_ALREADY_AWARDED בשני | קריטריוני הקבלה במקרי השימוש |
| Integration | המעטפה, פונה חסר, פונה לא תקין, פעולה בלי שורה ב-Registry, וקוד שגיאה שאינו ברשימה | טבלאות החוזה, ה-Registry וקודי השגיאה |
| System | כל מקרה שימוש מקצה לקצה, בשלושה אשכולות: נורמה, קצה, כשל, לפי הזרימות החלופיות בכל מקרה שימוש. ובדיקת ההפרדה: בעל עסק אינו רואה עסק אחר, ומאמן אינו רואה מאמן אחר | usecase-01 עד 12 |
| UAT | אישור המסכים (שלב 2), ואישור הפריסה (שלב 7) | הצוות |

**מבחני הקבלה המבניים**, בסוף כל שלב: חיבור למסד בקובץ אחד; כל מסך פונה ל-Endpoint אחד ומצהיר על עצמו; כל בקשה מותירה שורות Audit עם מזהה משותף; ערכים משתנים נקראים מ-SETTINGS; קודי השגיאה בקוד ובמפה זהים; כיוון תלות אחד בלי ייבוא בין מודולים; חיפוש מפתחות במאגר ובקוד המסכים מחזיר אפס.

## 7. סדר הבנייה והשערים

| השלב | מה נבנה | בדיקת הקבלה | שער |
| :-- | :-- | :-- | :-- |
| 1. חוזה ושלד | פרויקט Supabase, כל הטבלאות מה-ERD הלוגי, Endpoint ו-Orchestrator, Registry, Audit, Repository, ERROR_CODES, SETTINGS | בקשה מותרת עוברת ונרשמת; בקשה אסורה נדחית ונרשמת | **פרויקט Supabase פתוח, והרשאה לצוות** |
| 2. עיצוב ומסכים | D01 ו-S01 עד S23 על נתוני הדגמה, בלי פנייה לשרת | **אישור המסכים בידי הצוות** | |
| 3. Slice ראשון | S04 מול programs ו-Repository מלא, על נתוני הדגמה במסד | שינוי בתוכנית במסד נראה במסך | |
| 4. מודולי הליבה העסקית | 4א: trainees, exercises, programs, results. 4ב: progress, feedback, coins, challenges, home. 4ג: classes, notifications. 4ד: payments, invoices, settings | Unit, Integration ו-System ירוקים לכל תת שלב | |
| 4ה. עסק ובעל עסק | ה-migration של BUSINESSES, OWNERS ו-COACH_INVITES, BusinessID ב-COACHES וב-SETTINGS; התפקיד owner ב-Orchestrator; M15 business; home.get_owner_home; S24 עד S27; S12 לפי התפקיד; S22 ו-S23 לשני התפקידים | Unit, Integration ו-System ירוקים, כולל Regression על כל מה שנבנה, ובדיקת ההפרדה | **אישור הצוות על אב הטיפוס גרסה 3** |
| 5. ממשקי הקלט | Identity, Invite Channel, File Storage, Payment Gateway המדומה | כל ממשק מול החוזה שלו | ספק מייל: הוכרע בתוכנית שלב 5 (הכרעה 8). המייל המובנה של Supabase בגרסה הראשונה; מתאמנים אמיתיים בקישור |
| 6. AI | לא בגרסה הראשונה | | |
| 7. נתוני אמת ופריסה | הסרת נתוני ההדגמה, יצירת העסק וחשבון בעל העסק, שהוא גם המאמן הראשון, רשימת התרגילים וקישורי היוטיוב, פריסה | מבחני הקבלה המבניים כולם | **אישור הפריסה בידי הצוות** |

## 8. הכרעות פתוחות

| הערך | מי קורא | היכן יושב | איזה שלב עוצר |
| :-- | :-- | :-- | :-- |
| חשבון Supabase: מי פותח, ובאיזה אזור | הכול | מסמך הבנייה | שלב 1 |
| תוכן הרשימה המוכנה וקישורי היוטיוב | exercises | נתוני ההקמה | שלב 7 |
| משך שמירת מקום, תוקף הזמנה, אורך הערה, גודל קובץ | classes, trainees, feedback, exercises | SETTINGS | אינו עוצר: ערכים מאושרים באב הטיפוס. גודל הקובץ: videoMaxMegabytes, 50 (תוכנית שלב 5, הכרעה 7) |
| ספק מייל חיצוני (SMTP) להזמנות למתאמנים שאינם בצוות | invite_channel | החלפת מימוש | אינו עוצר: הכרעת צוות לפני שלב 7 |
| יעדים מספריים למדדים | דוחות | doc-okr-kpi | אינו עוצר |
| ספק סליקה אמיתי | payment_gateway | החלפת מימוש | אינו עוצר |

## 9. מבחן ההחלפה

| מה מחליפים | מה נשבר |
| :-- | :-- |
| Supabase במסד אחר | שום דבר מחוץ ל-Repository |
| המימוש המדומה בספק סליקה אמיתי | שום דבר מחוץ ל-Payment Gateway |
| שירות הזהות | שום דבר מחוץ ל-Identity Connector |
| מסך, או ערכת העיצוב | שום דבר מחוץ למסך, או ל-D01 |
| מודול עסקי, למשל משוב ב-AI בשלב הבא | שום דבר: אותן פעולות ב-Registry |
| אחסון האתר | שום דבר: האתר סטטי ופונה ל-Endpoint אחד |
| תפקיד בעל העסק | שום דבר במודולים של המאמן והמתאמן, מלבד SETTINGS לפי העסק |

## 10. יומן גרסאות

| גרסה | תאריך | מה השתנה | מי אישר |
| :-- | :-- | :-- | :-- |
| 1 | 28.09.2026 | המפה המקורית. הכרעות: GitHub Pages; חשבון Supabase קיים של הצוות | הצוות |
| 2 | 28.09.2026 | מפערי דוח שלב 1: נוסף קוד השגיאה UNEXPECTED_ERROR, ונוספה הפעולה invite_channel.send_invite. מה לא השתנה: הליבה, המודולים, שאר הפעולות והקודים, וסדר הבנייה | הצוות |
| 3 | 28.09.2026 | מפערי דוח שלב 2: exercises.list_exercises לשורת S07; trainees.list_trainees לשורת S08; פעולה חדשה settings.get_error_texts מ-S23; תפריטי "עוד" ו"אני" כחלק ממעטפת הניווט; ומבנה התשובה של כל פעולה. מה לא השתנה: הליבה, מבנה המעטפה, המודולים והקודים | הצוות |
| 4 | 28.09.2026 | מפערי דוח שלב 4א: M01 קורא מהליבה גם "תוכנית" (פער 9); progress מחשב את הרצף בפעולה חדשה get_streak, ו-get_trainee_card מרכיב את הכרטיס מ-programs, coins, payments ו-progress, עם חמש שורות Registry לפונה מודול (פער 1); coins.get_balance מחזיר גם goal; מבנה התשובה של list_trainees עם InviteID (פער 3); החוזה בין results לבין feedback, coins ו-challenges (פער 10); בלי תור לחישוב חוזר בגרסה הראשונה (פער 2). מה לא השתנה: הליבה, מבנה המעטפה, המודולים, קודי השגיאה וסדר הבנייה | הצוות |
| 5 | 28.09.2026 | מתוכנית שלב 4ב, הכרעות 3, 5, 6 ו-7: שלוש שורות Registry, M13 מול coins.manage_rewards ו-challenges.list_completions, ו-S09 מול exercises.list_exercises; פירוט המקורות של get_coach_home; מבנה הקלט והתשובה של progress.detect_personal_records והגדרת השיא; הקודים לקלט לא תקין בלי קוד ייעודי. מה לא השתנה: הליבה, מבנה המעטפה, המודולים, רשימת קודי השגיאה (28) וסדר הבנייה | הצוות |
| 6 | 28.09.2026 | מפער שנמצא בשלב 4ב, משימה 3: שורת Registry אחת, M05 מול settings.get_settings, ל-streakGapDays של get_streak. מה לא השתנה: כל השאר | הצוות |
| 7 | 28.09.2026 | מתוכנית שלב 4ג, הכרעות 2, 3 ו-4: החוזה של notifications.notify_in_app (traineeID, messageText; data null); הטווח של classes.list_upcoming_classes (למאמן משלושה ימים אחורה, למתאמן שיעורים שעוד לא התחילו); המתאמן מקבל את הנרשמים והממתינים בלי שמות ומזהים; ומבנה lateRequests. מה לא השתנה: הליבה, מבנה המעטפה, המודולים, הפעולות, ה-Registry, רשימת קודי השגיאה (28) וסדר הבנייה | הצוות |
| 8 | 28.09.2026 | מתוכנית שלב 4ד, הכרעות 2 עד 6, ומדוח 4ג, פער 5: שורת Registry אחת, S06 מול settings.get_settings (noteMaxLength); הסדר ב-pay_demo בלי מצב ביניים; הקריאה לאורך הקשר בין בקשה לחשבונית; החוזים של create_payment_request, charge, create_invoice, update_settings ו-get_trainee_card, והסינון של list_payments ו-list_invoices; ההסבר לבני אדם של CANCEL_TOO_LATE בלי מספר קבוע; NOT_ALLOWED על שיעור שבוטל או התחיל ועל קלט לא תקין ב-notify_in_app. מה לא השתנה: הליבה, מבנה המעטפה, המודולים, הפעולות, רשימת קודי השגיאה (28) וסדר הבנייה | הצוות |
| 9 | 29.09.2026 | מתוכנית שלב 5, הכרעות 1 עד 5, 7 ו-8: הפעולות trainees.get_me ו-exercises.prepare_upload, ושלוש שורות Registry (S23 מול get_me למאמן ולמתאמן, S05 מול prepare_upload); מי רשאי ל-accept_invite והקלט שלו; קישור ההזמנה מ-SITE_URL; החוזים של send_invite, charge ו-attach_video בהעלאה; הדלי videos; videoMaxMegabytes; השער של שלב 5 הוכרע. מה לא השתנה: הליבה, מבנה המעטפה, המודולים, רשימת קודי השגיאה (28), הטבלאות וסדר הבנייה |
| 10 | 29.09.2026 | מפער שנמצא בשלב 5, משימה 7: שורת Registry אחת, S22 מול settings.get_error_texts לתפקיד trainee, והמצטרף רשאי לה, כדי שהזמנה שפגה תוצג בנוסח שלה (UC4 א). נכנסת ב-0012. מה לא השתנה: כל השאר |
| 11 | 30.09.2026 | מ-usecase-12 ומהכרעות הצוות ב-doc-owner-role (מסלול ב, הכרעות 3 עד 7): ישות הליבה עסק ובעל עסק; כללים 5, 9 ו-10; M15 business; home.get_owner_home; התפקיד owner ב-Orchestrator; S24 עד S27, ו-S12 משותף; SETTINGS לפי עסק, ו-update_settings לבעל העסק בלבד; הצטרפות מאמן ב-S22; get_me מחזיר roles; שלב 4ה. מה לא השתנה: מבנה המעטפה, רשימת קודי השגיאה (28), ושאר המודולים והפעולות |
| 12 | 01.10.2026 | מדוח שלב 4ה, פערים 2 ו-4: שורת Registry אחת, M15 מול settings.get_settings; הקלט והתשובה של list_trainees, list_payments, list_upcoming_classes, manage_rewards, get_streak, list_completions ו-list_results כשבעל העסק פונה אליהן. ומהכרעת הצוות 01.10.2026: S12 לבעל העסק בלבד, כלל 9, והשורה של המאמן מול get_settings ב-S12 יוצאת משימוש. מה לא השתנה: הליבה, מבנה המעטפה, המודולים, הפעולות, רשימת קודי השגיאה (28) וסדר הבנייה | הצוות |
