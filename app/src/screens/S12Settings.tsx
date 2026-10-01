// S12 settings (the reference table): values the coach changes without code (doc-module-map M14).
// Stage 5 (plan, decision 12; report 4d, gap 4): the limits and the daily reminder, which were read at run time but not shown.
// Design stage, finding 14: numbers open the number keypad and are checked here, naming the field that is wrong; the
// texts are long fields. Loading and an error with a retry (2, 6).
// Stage 4e (map v11, rule 9; usecase-12 step 10 and f; prototype version 3): the settings of the business. The owner
// changes them; the coach sees them only. Fields open when the owner's view is on and the Endpoint says canEdit.
import { useEffect, useState } from "react";
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Button, Card, Field, Load, Notice, Screen } from "../design/components";
import { useNav } from "../nav";

const GROUPS: [string, [string, string][]][] = [
  ["מטבעות לכל פעולה", [["coinsWorkout", "אימון שנשמר"], ["coinsGoal", "יעד אישי"], ["coinsChallenge", "אתגר שבועי"], ["coinsAttendance", "הגעה לשיעור"]]],
  ["מחירים (₪)", [["priceMonthly", "מנוי חודשי"], ["pricePack10", "חבילת 10 אימונים"]]],
  ["כללים", [["cancelHours", "ביטול עד (שעות לפני שיעור)"], ["streakGapDays", "רצף: ימים מרביים בין אימונים"], ["spotOfferHours", "שמירת מקום שהתפנה (שעות)"], ["inviteValidDays", "תוקף הזמנה (ימים)"]]],
  ["מגבלות", [["videoMaxSeconds", "אורך סרטון (שניות)"], ["videoMaxMegabytes", "גודל סרטון (מגה-בייט)"], ["noteMaxLength", "אורך הערה (תווים)"]]],
  ["נוסחי משוב", [["feedbackFull", "השלמה מלאה"], ["feedbackPartial", "השלמה חלקית"], ["feedbackRecord", "שיא אישי"]]],
  ["תזכורת יומית", [["reminderText", "נוסח התזכורת בבית המתאמן"]]],
];
const TEXTS = new Set(["נוסחי משוב", "תזכורת יומית"]);
const NUMBERS = GROUPS.filter(([t]) => !TEXTS.has(t)).flatMap(([, f]) => f);

export default function S12Settings() {
  const nav = useNav();
  const settings = useCall("S12", "settings", "get_settings");
  const [values, setValues] = useState<Record<string, string>>({});
  const [canEdit, setCanEdit] = useState(false);
  useEffect(() => {
    if (!settings.data) return;
    const { canEdit: may, ...rest } = settings.data as Record<string, string> & { canEdit?: boolean };
    setValues(rest);
    setCanEdit(nav.role === "owner" && may !== false); // the demo data has no canEdit: the owner's view decides
  }, [settings.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const bad = NUMBERS.find(([k]) => { const v = String(values[k] ?? "").trim(); return v === "" || !Number.isFinite(Number(v)) || Number(v) < 0; });
    if (bad) return nav.toast(`הערך ב"${bad[1]}" אינו מספר תקין`);
    const r = await call("S12", "settings", "update_settings", { values });
    nav.toast(r.ok ? "ההגדרות נשמרו" : r.error!.message);
  };
  const set = (k: string) => (e: { target: { value: string } }) => setValues({ ...values, [k]: e.target.value });
  return (
    <Screen eyebrow="בלי קוד" title="הגדרות העסק">
      <Load state={settings}>{() => <>
        {canEdit
          ? <div className="muted small">הערכים חלים על כל המאמנים בעסק.</div>
          : <Notice>ההגדרות נקבעות בידי בעל העסק. כאן אפשר לראות אותן.</Notice>}
        {GROUPS.map(([title, fields]) => (
          <Card col key={title}>
            <b>{title}</b>
            <div className={TEXTS.has(title) ? "col" : "grid2"}>
              {fields.map(([k, l]) => (
                <Field key={k} label={l}>
                  {TEXTS.has(title)
                    ? <textarea id={`setting-${k}`} rows={2} value={values[k] ?? ""} onChange={set(k)} disabled={!canEdit} />
                    : <input id={`setting-${k}`} type="text" inputMode="numeric" value={values[k] ?? ""} onChange={set(k)} disabled={!canEdit} />}
                </Field>
              ))}
            </div>
          </Card>
        ))}
        {canEdit && <Button onClick={save}>שמירה</Button>}
      </>}</Load>
    </Screen>
  );
}
