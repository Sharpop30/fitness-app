// S01 coach home (UC4 step 8, story 19): what needs attention today, with quick links.
// Design stage (prototype version 2): the greeting by the hour and the day (findings 31, 32), a hero with the active
// trainees, and the four counts as tiles; loading and an error with a retry (findings 2, 6).
// Stage 5b (prototype 4): today and the active trainees in a card with icons, each count with its icon and kind, a count
// of 0 quiet so what needs action stands out (the diagnosis), and a trophy on the weekly challenge.
import { now } from "../api/client";
import { useCall } from "../api/useCall";
import { Badge, Ic, Load, Screen, Tile, TintRow, fmtDay, greeting } from "../design/components";
import { useNav } from "../nav";

export default function S01CoachHome() {
  const nav = useNav();
  const home = useCall("S01", "home", "get_coach_home");
  const today = now("S01");
  return (
    <Screen eyebrow={`${greeting()} · ${fmtDay(today)}`} title="הבית שלי" noBack>
      <Load state={home}>{(d: any) => <>
        <div className="card grid2">
          <div className="row"><Ic name="calendar" tone="info" /><div><div className="muted small">היום</div><b>{d.classesToday ? `${d.classesToday} ${d.classesToday === 1 ? "שיעור" : "שיעורים"} היום` : "אין שיעור היום"}</b></div></div>
          <div className="row"><Ic name="users" /><div><div className="figure">{d.activeTrainees}</div><div className="muted small">מתאמנים פעילים</div></div></div>
        </div>
        <h2>דורש תשומת לב</h2>
        <div className="grid2">
          <Tile icon="card" tone="warn" label="תשלומים פתוחים" value={d.openPayments} caption={d.openPayments ? "לצפייה ברשימה" : "הכול שולם"} onClick={() => nav.go("S08")} />
          <Tile icon="calendarX" tone="bad" label="בקשות ביטול חריגות" value={d.lateRequests} caption={d.lateRequests ? "ממתינות להחלטה" : "אין בקשות"} onClick={() => nav.setTab("S11")} />
          <Tile icon="gift" label="תגמולים לאספקה" value={d.rewardsToDeliver} caption={d.rewardsToDeliver ? "ממתינים לך" : "אין ממתינים"} onClick={() => nav.go("S10")} />
          <Tile icon="calendar" tone="info" label="שיעורים היום" value={d.classesToday} caption={d.classesToday ? "לרשימת הנרשמים" : "אין היום"} onClick={() => nav.setTab("S11")} />
        </div>
        {d.challenge
          ? <TintRow onClick={() => nav.go("S09")}><Ic name="trophy" tone="warn" /><span className="grow"><b>האתגר השבועי:</b> {d.challenge.challengeName}</span><Badge tone="ok">{d.challenge.completions} השלימו</Badge></TintRow>
          : <TintRow onClick={() => nav.go("S09")}><Ic name="trophy" tone="warn" /><span className="grow"><b>האתגר השבועי:</b> אין אתגר השבוע</span><span className="muted small">לפרסום</span></TintRow>}
      </>}</Load>
    </Screen>
  );
}
