# נוסח מייל ההזמנה בעברית

| שדה | ערך |
| :-- | :-- |
| מעמד | מאושר, 29.09.2026. להדבקה בלוח הבקרה בידי הצוות |
| לפי | findings-stage-5, פער 9; usecase-04 צעד 3; הנוסחים של S22 באב הטיפוס |
| היכן | לוח הבקרה של Supabase, פרויקט fitness-app: Authentication, ואז Email Templates, ואז Invite user |

## הנושא (Subject)

```
המאמן שלך הזמין אותך להצטרף
```

## גוף המייל (Message body, HTML)

`{{ .Data.fullName }}` הוא השם שהמאמן כתב בהזמנה (השרת שולח אותו). `{{ .ConfirmationURL }}` הוא הקישור של Supabase, שמכניס את המתאמן ומחזיר אותו למסך ההצטרפות. אין לשנות את שני אלה.

```html
<div dir="rtl" lang="he" style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.6; color: #161916; text-align: right; max-width: 480px;">
  <h2 style="margin: 0 0 12px;">שלום {{ .Data.fullName }},</h2>
  <p style="margin: 0 0 12px;">המאמן שלך הזמין אותך להצטרף לאפליקציה שלו. שם יחכו לך תוכנית האימונים, התוצאות, השיעורים והתשלומים, במקום אחד.</p>
  <p style="margin: 0 0 20px;">כדי להצטרף, לחץ על הכפתור ובחר סיסמה:</p>
  <p style="margin: 0 0 24px;">
    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #c3f03f; color: #161916; text-decoration: none; font-weight: bold; padding: 12px 28px; border-radius: 999px;">הצטרפות</a>
  </p>
  <p style="margin: 0 0 8px; font-size: 14px; color: #555;">ההזמנה בתוקף לזמן מוגבל. אם היא כבר לא בתוקף, בקש מהמאמן הזמנה חדשה.</p>
  <p style="margin: 0; font-size: 14px; color: #555;">לא ציפית להזמנה? אפשר להתעלם מהמייל הזה.</p>
</div>
```

## החלטות בנוסח

| # | ההחלטה | למה |
| :-: | :-- | :-- |
| 1 | "המאמן שלך", בלי שם המאמן | השרת שולח לשירות ההזמנות רק את שם המתאמן. שם המאמן מחייב שינוי קטן בקוד (I03), ואפשר להוסיף אותו אם תרצו |
| 2 | "הצטרפות" על הכפתור | אותו נוסח כמו הכפתור ב-S22 |
| 3 | "ההזמנה בתוקף לזמן מוגבל... בקש מהמאמן הזמנה חדשה" | כמו ב-S02 ובהסבר של INVITE_EXPIRED. בלי מספר ימים, כי התוקף נקרא מ-SETTINGS (חוק 8) |
| 4 | הצבע של הכפתור הוא צבע הכפתור הראשי באפליקציה (--lime, #c3f03f) | תבנית המייל אינה חלק מהאתר, ולכן הצבע כתוב בה ישירות |
| 5 | פנייה בלשון זכר ("לחץ", "בקש") | כמו בשאר הנוסחים באפליקציה |
