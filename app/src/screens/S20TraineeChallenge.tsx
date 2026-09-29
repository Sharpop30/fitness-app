// S20 weekly challenge, trainee (UC8, story 5): progress counts itself from saved workouts.
// Design stage: a completed challenge says so, not "5/3" (finding 31); neutral wording for an exemption (37); "no
// challenge" only when the reply came (2); the end day with its weekday (32).
import { useCall } from "../api/useCall";
import { Empty, Hero, HeroStat, Load, Screen, fmtDay } from "../design/components";

export default function S20TraineeChallenge() {
  const ch = useCall("S20", "challenges", "get_current_challenge");
  // get_current_challenge answers null when there is no challenge this week: loaded, not missing.
  const state = { ...ch, data: ch.loading || ch.error ? null : { c: ch.data } };
  return (
    <Screen eyebrow={ch.data ? `עד ${fmtDay(ch.data.end)}` : "אתגר שבועי"} title="האתגר השבועי">
      <Load state={state}>{({ c }: { c: any }) => {
        if (!c) return <Empty title="אין אתגר השבוע" sub="אתגר חדש מתחיל ביום ראשון." />;
        const p = c.progress;
        const done = p && !p.exempt && p.value >= p.target;
        return <>
          <Hero row>
            <div>
              <div className="sub">{c.challengeName}</div>
              <div className="lead">{p?.exempt ? "פטור השבוע" : done ? "השלמת ✓" : "בדרך ליעד"}</div>
              <div className="sub">פרס: {c.coins} מטבעות{c.extraPrize ? ` + ${c.extraPrize}` : ""}</div>
            </div>
            {p && !p.exempt && <HeroStat value={`${p.value}/${p.target}`} label={c.challengeType === "exercise" ? 'ק"ג' : "אימונים"} />}
          </Hero>
          <div className="muted small">{p?.exempt ? "התרגיל של האתגר אינו בתוכנית שלך, ולכן האתגר השבוע לא חל עליך." : "ההשלמה נספרת לבד מהאימונים שנשמרים. אין צורך לדווח שוב."}</div>
        </>;
      }}</Load>
    </Screen>
  );
}
