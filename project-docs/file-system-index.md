# file-system-index: אפליקציית ניהול מאמן כושר

מקור האמת של מבנה הקבצים בפרויקט. נקרא בפתיחת כל צ'ט, וגובר על כל עותק אחר. כל שינוי מבנה מעדכן קודם את המסמך הזה.

| שדה | ערך |
| :-- | :-- |
| גרסה | 1 |
| תאריך | 27.09.2026 |

## 1. הפרמטרים (תשובות צעד 0)

| הפרמטר | הערך |
| :-- | :-- |
| פלטפורמת האחסון | כפולה: מאגר GitHub ציבורי `Sharpop30/fitness-app`, ותיקייה מסונכרנת ב-Google Drive בחשבון sharpai4all@gmail.com. התיקייה המקומית היא שורש שניהם |
| כלי האוטומציה | לא עכשיו. מצב ההפעלה: ריצה בצ'ט. עדכון ה-PRD רץ בצ'ט המרכזי אחרי כל אישור |
| כלי ה-AI והמודל | Claude Code לבנייה. באפליקציה אין AI בגרסה הראשונה |
| הממשקים למערכות | Supabase: מסד, זהות משתמשים ואחסון קבצים. סליקה וחשבוניות: מדומות בלבד ומסומנות ככאלה, עד הכרעה אחרת |

## 2. התיקיות

| התיקייה | המיקום | התפקיד |
| :-- | :-- | :-- |
| שורש הפרויקט | GitHub: <https://github.com/Sharpop30/fitness-app>. Drive: התיקייה "פרויקט חדר כושר" <https://drive.google.com/drive/folders/1Mo8aXjFm7N2rd8-uGvrQjofWSezjWtIU> | הכול |
| project-docs | `project-docs/` | התוצרים המאושרים בשמם הקנוני |
| prd-update-inbox | `project-docs/prd-update-inbox/` | תור עדכון ה-PRD, מצב ממתין |
| processing | `project-docs/processing/` | מצב בעיבוד |
| done | `project-docs/done/` | מצב הושלם |
| failed | `project-docs/failed/` | מצב נכשל |
| mermaid | `project-docs/mermaid/` | קבצי התרשימים |
| drafts | `drafts/` | טיוטות שממתינות לאישור |
| presentations | `presentations/` | חומרי הצגה |
| archive | `archive/` | קבצים שהוחלפו, בשם archive-YYYY-MM-DD-[השם הקנוני] |
| automation-infra | `automation-infra/` | רישום הריצה. במאגר הוא יושב בשורש, ולא כאחות לתיקיית האב |
| reference/form | `reference/form/` | הקוד ואב הטיפוס של FORM, מקור השראה בלבד. אינו מקור לדרישות |

ספריית course-library נמצאת מחוץ לשורש הפרויקט, בתיקיית האב, והיא לקריאה בלבד.

## 3. היומנים

| היומן | המיקום | מי כותב |
| :-- | :-- | :-- |
| doc-approvals-log | `project-docs/doc-approvals-log.csv`. העמודות: תאריך, סוג התוצר, שם קודם, שם חדש, קישור | הצ'ט המרכזי, בכל אישור |
| prd-machine-run-log | `automation-infra/prd-machine-run-log.csv`. העמודות לפי טבלת רישום הריצה בפריט 5 | הצ'ט המרכזי, שורה בכל ריצת עדכון |

## 4. הניתוב

| סוג התוצר | תבנית השם | היעד |
| :-- | :-- | :-- |
| PRD | prd-fitness-app | project-docs |
| מסמכי ידע, החלטות, מיפוי ותוכנית | doc-[נושא] | project-docs |
| סיפורי משתמש | story-[נושא] | project-docs |
| מקרי שימוש | usecase-[מספר]-[נושא] | project-docs |
| תרשימים | diagram-[מספר]-[נושא].mmd | project-docs/mermaid |
| ממצאים ודוחות שלב | findings-[נושא] | project-docs |
| סיכום מצב | session-state.md | project-docs |
| טיוטה | draft-[נושא] | drafts |
| קוד האפליקציה | לפי מסמך הבנייה | שורש המאגר |

## 5. המסמכים הפעילים

| השם הקנוני | המיקום | תאריך הגרסה הפעילה |
| :-- | :-- | :-- |
| prd-fitness-app.docx | project-docs | 27.09.2026 (גרסה 1.7) |
| doc-stakeholder-map.docx | project-docs | 18.07.2026 |
| doc-requirements-prioritization.docx | project-docs | 18.07.2026 |
| story-all-requirements.docx | project-docs | 18.07.2026 |
| doc-need-vs-want.docx | project-docs | 18.07.2026 |
| doc-ideas.docx | project-docs | 18.07.2026 |
| doc-adoption-mapping-fitness-app.md | project-docs | 27.09.2026 |
| file-system-index.md | project-docs | 27.09.2026 |
| doc-work-plan-fitness-app.md | project-docs | 27.09.2026 |
| doc-project-definition.md | project-docs | 27.09.2026 |
| doc-process-mapping.html | project-docs | 27.09.2026 |
| diagram-01-current-process.mmd | project-docs/mermaid | 27.09.2026 |
| diagram-02-desired-process.mmd | project-docs/mermaid | 27.09.2026 |
| doc-okr-kpi.md | project-docs | 27.09.2026 |
| doc-mlp-scope.md | project-docs | 27.09.2026 |
| story-01-training-programs.md | project-docs | 27.09.2026 |
| story-02-payments-invoices.md | project-docs | 27.09.2026 |
| story-30-class-registration.md | project-docs | 27.09.2026 |

## 6. כללי העבודה

1. המיקום של קובץ הוא חוזה. כל שינוי מבנה מעדכן קודם את המסמך הזה.
2. תוצר חדש נשמר ל-drafts. מילת "מאושר" בצ'ט מעבירה אותו ליעדו, והצ'ט המרכזי מבצע את ההעברה, מעדכן את טבלת המסמכים הפעילים ורושם ביומן האישורים.
3. עותק של כל תוצר מאושר נכנס ל-prd-update-inbox, והצ'ט מריץ את עדכון ה-PRD.
4. קובץ שהוחלף עובר לארכיון עם יורש.
5. הוראת תיקון על תוצר קיים מיושמת בגרסה חדשה של אותו תוצר, ולא במסמך נוסף.
6. כל שינוי נשמר בתיקייה המקומית, ונדחף ל-GitHub. הסנכרון ל-Drive אוטומטי.
