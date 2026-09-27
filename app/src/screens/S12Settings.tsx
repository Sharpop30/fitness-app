// S12 settings (the reference table): values the coach changes without code (doc-module-map M14).
import { useEffect, useState } from "react";
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Button, Card, Field, Screen } from "../design/components";
import { useNav } from "../nav";

const GROUPS: [string, [string, string][]][] = [
  ["מטבעות לכל פעולה", [["coinsWorkout", "אימון שנשמר"], ["coinsGoal", "יעד אישי"], ["coinsChallenge", "אתגר שבועי"], ["coinsAttendance", "הגעה לשיעור"]]],
  ["מחירים (₪)", [["priceMonthly", "מנוי חודשי"], ["pricePack10", "חבילת 10 אימונים"]]],
  ["כללים", [["cancelHours", "ביטול עד (שעות לפני שיעור)"], ["streakGapDays", "רצף: ימים מרביים בין אימונים"], ["spotOfferHours", "שמירת מקום שהתפנה (שעות)"], ["inviteValidDays", "תוקף הזמנה (ימים)"]]],
  ["נוסחי משוב", [["feedbackFull", "השלמה מלאה"], ["feedbackPartial", "השלמה חלקית"], ["feedbackRecord", "שיא אישי"]]],
];

export default function S12Settings() {
  const nav = useNav();
  const { data } = useCall("S12", "settings", "get_settings");
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => { if (data) setValues(data); }, [data]);

  const save = async () => {
    const r = await call("S12", "settings", "update_settings", { values });
    nav.toast(r.ok ? "ההגדרות נשמרו" : r.error!.message);
  };
  return (
    <Screen eyebrow="בלי קוד" title="הגדרות">
      {GROUPS.map(([title, fields]) => (
        <Card col key={title}>
          <b>{title}</b>
          <div className={title === "נוסחי משוב" ? "col" : "grid2"}>
            {fields.map(([k, l]) => (
              <Field key={k} label={l}><input id={`setting-${k}`} value={values[k] ?? ""} onChange={(e) => setValues({ ...values, [k]: e.target.value })} /></Field>
            ))}
          </div>
        </Card>
      ))}
      <Button onClick={save}>שמירה</Button>
    </Screen>
  );
}
