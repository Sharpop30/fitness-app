// S01 coach home (UC4 step 8, story 19): what needs attention today, with quick links.
// Design stage (prototype version 2): the greeting by the hour and the day (findings 31, 32), a hero with the active
// trainees, and the four counts as tiles; loading and an error with a retry (findings 2, 6).
import { now } from "../api/client";
import { useCall } from "../api/useCall";
import { Badge, Hero, HeroStat, Load, Screen, Tile, TintRow, fmtDay, greeting } from "../design/components";
import { useNav } from "../nav";

export default function S01CoachHome() {
  const nav = useNav();
  const home = useCall("S01", "home", "get_coach_home");
  const today = now("S01");
  return (
    <Screen eyebrow={`${greeting()} · ${fmtDay(today)}`} title="הבית שלי" noBack>
      <Load state={home}>{(d: any) => <>
        <Hero row>
          <div><div className="sub">היום</div><div className="lead">{d.classesToday ? `${d.classesToday} ${d.classesToday === 1 ? "שיעור" : "שיעורים"} היום` : "אין שיעור היום"}</div></div>
          <HeroStat value={d.activeTrainees} label="מתאמנים פעילים" />
        </Hero>
        <h2>דורש תשומת לב</h2>
        <div className="grid2">
          <Tile label="תשלומים פתוחים" value={d.openPayments} caption={d.openPayments ? "לצפייה ברשימה" : "הכול שולם"} onClick={() => nav.go("S08")} />
          <Tile label="בקשות ביטול חריגות" value={d.lateRequests} caption={d.lateRequests ? "ממתינות להחלטה" : "אין בקשות"} onClick={() => nav.setTab("S11")} />
          <Tile label="תגמולים לאספקה" value={d.rewardsToDeliver} caption={d.rewardsToDeliver ? "ממתינים לך" : "אין ממתינים"} onClick={() => nav.go("S10")} />
          <Tile label="שיעורים היום" value={d.classesToday} caption={d.classesToday ? "לרשימת הנרשמים" : "אין היום"} onClick={() => nav.setTab("S11")} />
        </div>
        {d.challenge
          ? <TintRow onClick={() => nav.go("S09")}><span className="grow"><b>האתגר השבועי:</b> {d.challenge.challengeName}</span><Badge tone="ok">{d.challenge.completions} השלימו</Badge></TintRow>
          : <TintRow onClick={() => nav.go("S09")}><span className="grow"><b>האתגר השבועי:</b> אין אתגר השבוע</span><span className="muted small">לפרסום</span></TintRow>}
      </>}</Load>
    </Screen>
  );
}
