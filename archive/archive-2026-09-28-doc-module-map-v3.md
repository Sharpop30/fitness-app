# מפת המודולים: אפליקציית ניהול מאמן כושר

**מעמד**: מאושר, 28.09.2026, גרסה 3. לפי התבנית template-module-map (פריט 47), חלק ב, ופרומפט צעד 27; מתודולוגיית הכוכב (פריט 45); מנגנון הבנייה (פריט 46). ממלאת את סעיפים 14 עד 16 ב-PRD.

## 1. פתיח

| השדה | הערך |
| :-- | :-- |
| הפרויקט | אפליקציית ניהול מאמן כושר (fitness-app) |
| השאלה האסטרטגית | **ליבה חדשה**. אין מערכת ארגונית קיימת להתחבר אליה. קוד FORM הוא מקור השראה בלבד (doc-work-plan, הכרעה 3.2) |
| יעד ההרצה | **Deployment לענן**. מסד, זהות ואחסון קבצים ב-Supabase; השרת כ-Endpoint יחיד ב-Supabase Edge Function; האפליקציה כאתר נייד (PWA). אחסון האתר: **GitHub Pages** (הכרעת הצוות) |
| המקורות | PRD גרסה 1.19; doc-mlp-scope; 11 סיפורי משתמש ו-11 מקרי שימוש (usecase-01 עד 11); doc-erd-conceptual ו-doc-erd-logical; prototype-fitness-app גרסה 1 |
| גרסה ותאריך | 3, 28.09.2026 |

## 2. הליבה

**ישויות הליבה**: הישויות שיותר ממודול אחד צריך. כל השאר הם נתונים פרטיים של מודול.

| הישות | הטבלאות | המצבים והמעברים | מי מעביר |
| :-- | :-- | :-- | :-- |
| מאמן | COACHES | פעיל ↔ לא פעיל | הקמה |
| מתאמן | TRAINEES | הוזמן → פעיל → לא פעיל | trainees |
| תרגיל | EXERCISES | פעיל ↔ לא פעיל | exercises |
| תוכנית | PROGRAMS, WORKOUTS, WORKOUT_ITEMS | פעילה → לא פעילה (כשנבנית חדשה) | programs |
| אימון שבוצע | WORKOUT_LOGS, SET_RESULTS | נשמר → תוקן (סימון) | results |

**ה-Business Logic**, כללים ממוספרים:

1. למתאמן תוכנית פעילה אחת לכל היותר. תוכנית חדשה הופכת את הקודמת ללא פעילה.
2. החלפת תרגיל שומרת את המקום בסדר (sortOrder), ואינה נוגעת בתוצאות קודמות.
3. יעד לתרגיל: סטים וחזרות חיוביים, משקל לא שלילי (0 במשקל גוף).
4. תוצאה: חזרות ומשקל לא שליליים. תיקון מסמן isCorrected ואינו מזכה שוב במטבעות.
5. מאמן פועל רק על המתאמנים שלו; מתאמן פועל רק על הנתונים שלו.
6. אין מחיקה פיזית בשום ישות. יציאה משימוש היא סימון לא פעיל.
7. השיא האישי, הרצף והיתרה מחושבים, ואינם נשמרים.
8. רצף: אינו מתאפס כל עוד עברו עד N ימים בין אימונים (N ב-SETTINGS, 3).

## 3. המודולים

כל המודולים במצב ביצוע **אדם ממתין וכלל משיב (קוד רגיל)**, בדרגת מימוש **קוד רגיל**. אין AI בגרסה הראשונה.

### מודולי Backend

| מזהה | המודול | האחריות האחת | הדרישות | קורא מהליבה | כותב לליבה | נתונים פרטיים | מצב |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| M01 | trainees | הזמנה, הצטרפות ורשימת מתאמנים | 19 | מאמן | מתאמן | INVITES | טרם נבנה |
| M02 | exercises | רשימת התרגילים וסרטוני ההדגמה | 1, 10 | מאמן | תרגיל | | טרם נבנה |
| M03 | programs | בניית תוכנית והחלפת תרגיל | 1 | מתאמן, תרגיל | תוכנית | | טרם נבנה |
| M04 | results | הזנת תוצאות ותיקונן | 12 | תוכנית | אימון שבוצע | | טרם נבנה |
| M05 | progress | גרף התקדמות ושיא אישי | 4 | אימון שבוצע, תרגיל | | | טרם נבנה |
| M06 | feedback | משוב מיידי והערות מאמן | 21 | אימון שבוצע | | COACH_NOTES | טרם נבנה |
| M07 | coins | מטבעות, יעד אישי ותגמולים | 6, 24 | אימון שבוצע, תרגיל | | PERSONAL_GOALS, COIN_TRANSACTIONS, REWARDS, REDEMPTIONS | טרם נבנה |
| M08 | challenges | אתגר שבועי והשלמה אוטומטית | 5 | אימון שבוצע, תוכנית | | CHALLENGES, CHALLENGE_COMPLETIONS | טרם נבנה |
| M09 | payments | בקשות תשלום ותשלום הדגמה | 2 | מתאמן | | PAYMENT_REQUESTS | טרם נבנה |
| M10 | invoices | חשבוניות הדגמה ממוספרות | 2 | מתאמן | | INVOICES | טרם נבנה |
| M11 | classes | שיעורים, הרשמה, המתנה, ביטול ונוכחות | 30 | מתאמן | | CLASSES, CLASS_REGISTRATIONS, LATE_CANCEL_REQUESTS | טרם נבנה |
| M12 | notifications | הודעות בתוך האפליקציה | 21, 25, 30 | מתאמן | | NOTIFICATIONS | טרם נבנה |
| M13 | home | מסך הבית של המאמן ושל המתאמן, מפעולות קיימות בלבד | 19, 25 | הכול, דרך פעולות | | | טרם נבנה |
| M14 | settings | טבלת הייחוס שהמאמן משנה | 2, 5, 6, 21, 25, 30 | מאמן | | SETTINGS | טרם נבנה |

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
| I02 | Payment Gateway | שער (Gateway) | מימוש מדומה בגרסה הראשונה; ספק אמיתי [טרם נקבע] |
| I03 | Invite Channel | מתאם | קישור לשיתוף, ומייל דרך Supabase |
| I04 | File Storage | דרייבר בתוך ה-Repository | Supabase Storage, לסרטונים שהועלו |

### מודולי Frontend

מודול העיצוב **D01**: אסימוני העיצוב של FORM ורכיבי הבסיס. כל המסכים משתמשים בו. כל מסך הוא מודול, ופונה ל-Endpoint היחיד בלבד:

"עוד" אצל המאמן ו"אני" אצל המתאמן הם תפריטי ניווט בתוך מעטפת האפליקציה, בלי פעולות משלהם, ואינם מסכים נוספים.

| מאמן | מתאמן | משותף |
| :-- | :-- | :-- |
| S01 בית מאמן · S02 מתאמנים והזמנה · S03 כרטיס מתאמן · S04 בניית תוכנית והחלפה · S05 תרגילים וסרטונים · S06 תוצאות והערות · S07 יעד אישי · S08 תשלומים וחשבוניות · S09 אתגר · S10 תגמולים · S11 שיעורים ונוכחות · S12 הגדרות | S13 בית מתאמן · S14 אימון והזנה · S15 משוב · S16 האימונים שלי ותיקון · S17 שיעורים · S18 מטבעות · S19 תשלומים · S20 אתגר | S21 גרף התקדמות · S22 הצטרפות בהזמנה · S23 כניסה |

## 4. החוזה

**מעטפת הבקשה**: `{ caller, module, action, payload, lang }`. **מעטפת התשובה**: `{ ok, data, error }`. הפונה (caller) חובה, מתוך רשימה סגורה: מזהי המסכים S01 עד S23, מזהי המודולים M01 עד M14, ו-system.

### הפעולות

| המודול | הפעולה | המקור | מי רשאי |
| :-- | :-- | :-- | :-- |
| trainees | invite_trainee, accept_invite, list_trainees, get_trainee_card | UC4 | מאמן; accept: בעל ההזמנה |
| exercises | list_exercises, create_exercise, attach_video, get_exercise | UC1, UC10 | מאמן; get: גם מתאמן |
| programs | get_active_program, save_program, swap_exercise, start_new_program | UC1 | מאמן; get: גם המתאמן שלו |
| results | log_workout, correct_result, list_results | UC3 | מתאמן (שלו); list: גם המאמן |
| progress | get_progress_chart, detect_personal_records | UC5, UC6 | מאמן, מתאמן (שלו); detect: feedback בלבד |
| feedback | build_feedback, add_coach_note, get_workout_notes | UC6 | build: results בלבד; note: מאמן |
| coins | award, get_balance, set_personal_goal, manage_rewards, redeem_reward, mark_reward_delivered | UC7 | award: results, challenges, classes בלבד |
| challenges | create_challenge, get_current_challenge, check_progress, list_completions, mark_prize_delivered | UC8 | check: results בלבד |
| payments | create_payment_request, list_payments, pay_demo | UC2 | מאמן; pay_demo: מתאמן (שלו) |
| payment_gateway | charge | UC2 | payments בלבד |
| invite_channel | send_invite | UC4 | trainees בלבד |
| invoices | create_invoice, list_invoices | UC2 | create: payments בלבד |
| classes | publish_class, cancel_class, list_upcoming_classes, register, cancel_registration, list_registrations, mark_attendance, respond_to_spot_offer, request_late_cancel, decide_late_cancel | UC11 | לפי מקרה שימוש 11 |
| notifications | notify_in_app, list_notifications, mark_read | UC6, UC9, UC11 | notify: classes, feedback בלבד |
| home | get_coach_home, get_trainee_home | UC4, UC9 | מאמן; מתאמן |
| settings | get_settings, update_settings, get_error_texts | כל מקרה שימוש עם טבלת ייחוס; get_error_texts: כלל החוזה 8 | מאמן; get_settings: גם המודולים; get_error_texts: מאמן ומתאמן, מ-S23 |

**רשימת המותר (Registry)** היא טבלה: שורה לכל צירוף של פונה, מודול ופעולה מהטבלה שלמעלה. בקשה בלי שורה נדחית ונרשמת. הקובץ המלא נוצר בשלב 1 מהטבלה הזו.

### טבלת פעולות המסכים

| המסך | הפעולות, ואותן בלבד |
| :-- | :-- |
| S01 | home.get_coach_home |
| S02 | trainees.list_trainees, trainees.invite_trainee |
| S03 | trainees.get_trainee_card |
| S04 | programs.get_active_program, save_program, swap_exercise, start_new_program; exercises.list_exercises |
| S05 | exercises.list_exercises, create_exercise, attach_video, get_exercise |
| S06 | results.list_results; feedback.add_coach_note, get_workout_notes |
| S07 | coins.set_personal_goal; exercises.list_exercises |
| S08 | payments.create_payment_request, list_payments; invoices.list_invoices; trainees.list_trainees |
| S09 | challenges.create_challenge, get_current_challenge, list_completions, mark_prize_delivered |
| S10 | coins.manage_rewards, mark_reward_delivered |
| S11 | classes.publish_class, cancel_class, list_upcoming_classes, list_registrations, mark_attendance, decide_late_cancel |
| S12 | settings.get_settings, update_settings |
| S13 | home.get_trainee_home; classes.respond_to_spot_offer; notifications.list_notifications, mark_read |
| S14 | programs.get_active_program; results.log_workout; exercises.get_exercise |
| S15 | (מציג את תשובת log_workout, בלי פעולה נוספת) |
| S16 | results.list_results, correct_result; feedback.get_workout_notes |
| S17 | classes.list_upcoming_classes, register, cancel_registration, request_late_cancel |
| S18 | coins.get_balance, redeem_reward |
| S19 | payments.list_payments, pay_demo; invoices.list_invoices |
| S20 | challenges.get_current_challenge |
| S21 | progress.get_progress_chart |
| S22 | trainees.accept_invite |
| S23 | שירות הזהות; settings.get_error_texts, פעם אחת אחרי הכניסה, והלקוח שומר את ההסברים |

### מבנה התשובה של כל פעולה

השדה data בתשובה, לפי מה שהמסכים צריכים. השדות נקראים כמו ב-ERD. פעולת כתיבה שאין לה מה להחזיר מחזירה null.

| הפעולה | data |
| :-- | :-- |
| trainees.list_trainees | רשימה: TraineeID, fullName, isActive, joined, hasProgram |
| trainees.invite_trainee | link, קישור ההזמנה לשיתוף |
| trainees.accept_invite | TraineeID |
| trainees.get_trainee_card | trainee, coins, streak, openPayments, workouts, payments, goal (עם exerciseName) |
| exercises.list_exercises, get_exercise, create_exercise, attach_video | תרגיל או רשימה: ExerciseID, exerciseName, isBodyweight, videoType, videoUrl |
| programs.get_active_program | התוכנית, ובה workouts ובכל אחד items עם exerciseName ו-hasVideo; ו-inactive, רשימת התוכניות הלא פעילות |
| results.list_results | רשימת אימונים שבוצעו: WorkoutLogID, workoutName, performedAt, sets (עם isCorrected) |
| results.log_workout | WorkoutLogID, ו-feedback: done, total, records, coins, goal, challenge, text |
| progress.get_progress_chart | exercises, selected, isBodyweight, points (date, value) |
| feedback.get_workout_notes | רשימה: WorkoutLogID, noteText |
| coins.get_balance | balance, history, rewards (הקטלוג הפעיל) |
| coins.manage_rewards | rewards, redemptions (עם fullName ו-rewardName). op בקלט: list או add |
| coins.redeem_reward | balance |
| challenges.get_current_challenge | האתגר, end, coins, ולמתאמן progress (value, target, exempt) |
| challenges.list_completions | רשימה: TraineeID, fullName, completedAt, prizeDeliveredAt |
| payments.list_payments | רשימה: PaymentRequestID, fullName, paymentType, amount, status, createdAt, invoiceNumber |
| payments.pay_demo | invoiceNumber |
| invoices.list_invoices | רשימה: invoiceNumber, fullName, paymentType, amount, issuedAt, isDemo |
| classes.list_upcoming_classes | classes (עם registered, waitlist, myStatus, myWaitPosition), cancelHours, ולמאמן lateRequests |
| classes.list_registrations | שיעור אחד באותו מבנה |
| classes.register | status, position |
| classes.mark_attendance | awarded, מספר המתאמנים שקיבלו מטבעות |
| notifications.list_notifications | רשימת הודעות שלא נקראו: NotificationID, messageText, createdAt |
| home.get_coach_home | activeTrainees, openPayments, classesToday, lateRequests, rewardsToDeliver, challenge |
| home.get_trainee_home | reminder, streak, streakGapDays, coins, nextWorkout, nextClass, challenge, offers |
| settings.get_settings | כל ערכי SETTINGS של המאמן, מפתח וערך |
| settings.get_error_texts | לכל קוד שגיאה, ההסבר לבני אדם |

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
| CANCEL_TOO_LATE | בתוך חלון הביטול | אפשר לבטל עד 24 שעות לפני. אפשר לבקש חריגה |
| SPOT_OFFER_EXPIRED | זמן ההיענות להצעה עבר | המקום כבר הוצע לבא בתור |

ההסברים לבני אדם נשמרים ב-ERROR_CODES, ולא בקוד. "אסור" (NOT_ALLOWED, ACTION_NOT_ALLOWED) ו"עדיין לא" (VALUE_NOT_SET) הם קודים נפרדים.

## 5. תרשימים

- **תרשים אב, הארכיטקטורה**: diagram-06-architecture.mmd. ערוצים, Endpoint ו-Orchestrator, המודולים, ה-Repository, המסד והממשקים. כל חיבור עובר דרך ה-Orchestrator.
- **תרשים בן, המודולים העסקיים**: diagram-06a-modules.mmd.
- **הנתונים**: diagram-07 עד 07f (מאושרים). **הזרימות**: diagram-uc01 עד uc11 (מאושרים).

## 6. מערך הבדיקות

כל הבדיקות על נתונים סינתטיים מסומנים, מופרדים מנתוני אמת, ומוסרים לפני מסירה.

| הרמה | מה נבדק | המקור |
| :-- | :-- | :-- |
| Unit | כל מודול מול קריטריוני הקבלה של הסיפור שלו. דוגמה, M07: קלט "אימון נשמר" פעמיים עם אותו eventRef; פלט צפוי: זיכוי אחד ו-COINS_ALREADY_AWARDED בשני | קריטריוני הקבלה במקרי השימוש |
| Integration | המעטפה, פונה חסר, פונה לא תקין, פעולה בלי שורה ב-Registry, וקוד שגיאה שאינו ברשימה | טבלאות החוזה, ה-Registry וקודי השגיאה |
| System | כל מקרה שימוש מקצה לקצה, בשלושה אשכולות: נורמה, קצה, כשל, לפי הזרימות החלופיות בכל מקרה שימוש | usecase-01 עד 11 |
| UAT | אישור המסכים (שלב 2), ואישור הפריסה (שלב 7) | הצוות |

**מבחני הקבלה המבניים**, בסוף כל שלב: חיבור למסד בקובץ אחד; כל מסך פונה ל-Endpoint אחד ומצהיר על עצמו; כל בקשה מותירה שורות Audit עם מזהה משותף; ערכים משתנים נקראים מ-SETTINGS; קודי השגיאה בקוד ובמפה זהים; כיוון תלות אחד בלי ייבוא בין מודולים; חיפוש מפתחות במאגר ובקוד המסכים מחזיר אפס.

## 7. סדר הבנייה והשערים

| השלב | מה נבנה | בדיקת הקבלה | שער |
| :-- | :-- | :-- | :-- |
| 1. חוזה ושלד | פרויקט Supabase, כל הטבלאות מה-ERD הלוגי, Endpoint ו-Orchestrator, Registry, Audit, Repository, ERROR_CODES, SETTINGS | בקשה מותרת עוברת ונרשמת; בקשה אסורה נדחית ונרשמת | **פרויקט Supabase פתוח, והרשאה לצוות** |
| 2. עיצוב ומסכים | D01 ו-S01 עד S23 על נתוני הדגמה, בלי פנייה לשרת | **אישור המסכים בידי הצוות** | |
| 3. Slice ראשון | S04 מול programs ו-Repository מלא, על נתוני הדגמה במסד | שינוי בתוכנית במסד נראה במסך | |
| 4. מודולי הליבה העסקית | 4א: trainees, exercises, programs, results. 4ב: progress, feedback, coins, challenges, home. 4ג: classes, notifications. 4ד: payments, invoices, settings | Unit, Integration ו-System ירוקים לכל תת שלב | |
| 5. ממשקי הקלט | Identity, Invite Channel, File Storage, Payment Gateway המדומה | כל ממשק מול החוזה שלו | ספק מייל: המכסה של Supabase מספיקה? |
| 6. AI | לא בגרסה הראשונה | | |
| 7. נתוני אמת ופריסה | הסרת נתוני ההדגמה, יצירת חשבון המאמן, רשימת התרגילים וקישורי היוטיוב, פריסה | מבחני הקבלה המבניים כולם | **אישור הפריסה בידי הצוות** |

## 8. הכרעות פתוחות

| הערך | מי קורא | היכן יושב | איזה שלב עוצר |
| :-- | :-- | :-- | :-- |
| חשבון Supabase: מי פותח, ובאיזה אזור | הכול | מסמך הבנייה | שלב 1 |
| תוכן הרשימה המוכנה וקישורי היוטיוב | exercises | נתוני ההקמה | שלב 7 |
| משך שמירת מקום, תוקף הזמנה, אורך הערה, גודל קובץ | classes, trainees, feedback, exercises | SETTINGS | אינו עוצר: ערכים מאושרים באב הטיפוס |
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

## 10. יומן גרסאות

| גרסה | תאריך | מה השתנה | מי אישר |
| :-- | :-- | :-- | :-- |
| 1 | 28.09.2026 | המפה המקורית. הכרעות: GitHub Pages; חשבון Supabase קיים של הצוות | הצוות |
| 2 | 28.09.2026 | מפערי דוח שלב 1: נוסף קוד השגיאה UNEXPECTED_ERROR, ונוספה הפעולה invite_channel.send_invite. מה לא השתנה: הליבה, המודולים, שאר הפעולות והקודים, וסדר הבנייה | הצוות |
| 3 | 28.09.2026 | מפערי דוח שלב 2: exercises.list_exercises לשורת S07; trainees.list_trainees לשורת S08; פעולה חדשה settings.get_error_texts מ-S23; תפריטי "עוד" ו"אני" כחלק ממעטפת הניווט; ומבנה התשובה של כל פעולה. מה לא השתנה: הליבה, מבנה המעטפה, המודולים והקודים | הצוות |
