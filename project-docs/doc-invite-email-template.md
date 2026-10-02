# נוסחי המייל בעברית: הזמנה ושחזור סיסמה

| שדה | ערך |
| :-- | :-- |
| מעמד | מאושר, גרסה 2, 03.10.2026: נוסח הזמנה ניטרלי, שמתאים גם למאמן שבעל העסק מזמין, ותבנית שחזור הסיסמה. גרסה 1 אושרה 29.09.2026 |
| לפי | findings-stage-5, פערים 2 ו-9; findings-stage-7b, פער 5; usecase-04 צעד 3; usecase-12; הנוסחים של S22 ו-S23 באב הטיפוס |
| היכן | לוח הבקרה של Supabase, פרויקט fitness-app: Authentication, ואז Emails, ואז Templates. העריכה אפשרית מאז הגדרת ה-SMTP של Brevo (שלב 7ג, פעולה ב) |

## תבנית 1: הזמנה (Invite user)

אותו מייל יוצא כשמאמן מזמין מתאמן (UC4) וכשבעל העסק מזמין מאמן (UC12), ולכן הנוסח אינו אומר מי הזמין.

### הנושא (Subject)

```
הוזמנת להצטרף לאפליקציית האימונים
```

### גוף המייל (Message body, HTML)

`{{ .Data.fullName }}` הוא השם שנכתב בהזמנה (השרת שולח אותו). `{{ .ConfirmationURL }}` הוא הקישור של Supabase, שמכניס את המוזמן ומחזיר אותו למסך ההצטרפות. אין לשנות את שני אלה.

```html
<div dir="rtl" lang="he" style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.6; color: #161916; text-align: right; max-width: 480px;">
  <h2 style="margin: 0 0 12px;">שלום {{ .Data.fullName }},</h2>
  <p style="margin: 0 0 12px;">הוזמנת להצטרף לאפליקציית האימונים של העסק. שם נמצאים במקום אחד תוכניות האימונים, התוצאות, השיעורים והתשלומים.</p>
  <p style="margin: 0 0 20px;">כדי להצטרף, לחץ על הכפתור ובחר סיסמה:</p>
  <p style="margin: 0 0 24px;">
    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #c3f03f; color: #161916; text-decoration: none; font-weight: bold; padding: 12px 28px; border-radius: 999px;">הצטרפות</a>
  </p>
  <p style="margin: 0 0 8px; font-size: 14px; color: #555;">ההזמנה בתוקף לזמן מוגבל. אם היא כבר לא בתוקף, אפשר לבקש הזמנה חדשה ממי ששלח אותה.</p>
  <p style="margin: 0; font-size: 14px; color: #555;">לא ציפית להזמנה? אפשר להתעלם מהמייל הזה.</p>
</div>
```

## תבנית 2: שחזור סיסמה (Reset password)

### הנושא (Subject)

```
קישור לסיסמה חדשה
```

### גוף המייל (Message body, HTML)

`{{ .ConfirmationURL }}` מחזיר את המשתמש ל-S23, למסך "סיסמה חדשה". אין לשנות אותו.

```html
<div dir="rtl" lang="he" style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.6; color: #161916; text-align: right; max-width: 480px;">
  <h2 style="margin: 0 0 12px;">שלום,</h2>
  <p style="margin: 0 0 20px;">התקבלה בקשה לסיסמה חדשה לאפליקציית האימונים. כדי לבחור סיסמה חדשה, לחץ על הכפתור:</p>
  <p style="margin: 0 0 24px;">
    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #c3f03f; color: #161916; text-decoration: none; font-weight: bold; padding: 12px 28px; border-radius: 999px;">סיסמה חדשה</a>
  </p>
  <p style="margin: 0 0 8px; font-size: 14px; color: #555;">הקישור בתוקף לשעה, ולשימוש אחד.</p>
  <p style="margin: 0; font-size: 14px; color: #555;">לא ביקשת סיסמה חדשה? אפשר להתעלם מהמייל הזה, והסיסמה הנוכחית נשארת.</p>
</div>
```

## החלטות בנוסח

| # | ההחלטה | למה |
| :-: | :-- | :-- |
| 1 | הזמנה בנוסח ניטרלי, בלי "המאמן שלך" (גרסה 2) | אותו מייל יוצא גם למאמן שבעל העסק מזמין (business.invite_coach). החלופה, נוסח לכל תפקיד, מחייבת שינוי ב-I03, והצוות בחר בנוסח הניטרלי |
| 2 | "הצטרפות" על כפתור ההזמנה, "סיסמה חדשה" על כפתור השחזור | אותו נוסח כמו ב-S22 וב-S23 |
| 3 | "ההזמנה בתוקף לזמן מוגבל" | בלי מספר ימים, כי התוקף נקרא מ-SETTINGS (חוק 8) |
| 4 | "הקישור בתוקף לשעה" בשחזור | Email OTP expiration בענן הוא 3600 שניות (נבדק 03.10.2026). שינוי שם מחייב עדכון כאן |
| 5 | "שלום," בלי שם בשחזור | בבקשת שחזור יש רק כתובת מייל |
| 6 | צבע הכפתור הוא צבע הכפתור הראשי באפליקציה (--lime, #c3f03f) | תבנית המייל אינה חלק מהאתר, ולכן הצבע כתוב בה ישירות |
| 7 | פנייה בלשון זכר ("לחץ") | כמו בשאר הנוסחים באפליקציה |
| 8 | שם השולח "מאמן כושר", מ-fitnessapp4all@gmail.com דרך Brevo | שם הקיצור של האפליקציה (אושר ב-7ב). בלי דומיין, ולכן מייל עלול להגיע לספאם (מפה סעיף 8, ספק המייל) |
