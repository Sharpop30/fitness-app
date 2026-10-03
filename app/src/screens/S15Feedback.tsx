// S15 instant feedback (UC6, story 21): shows the reply of results.log_workout, with no action of its own.
// Design stage: a hero with the sets and the coins, "+10" read left to right (finding 8). Map v13: the reply carries the
// goal and challenge coins (design-stage gap 3), shown as in the prototype; none credited, the line names no number.
// Stage 5b (prototype 4): the moment of celebration, the team's illustration, the sets as a ring, and icons for the record,
// the goal and the challenge instead of the emoji.
import { Art, Button, Card, Coins, Notice, Ring, Screen, Signed } from "../design/components";
import { useNav } from "../nav";

export default function S15Feedback({ feedback: f }: { feedback: any }) {
  const nav = useNav();
  return (
    <Screen eyebrow="משוב" title="כל הכבוד!" noBack>
      <div className="celebrate"><Art name="feedback-done" /></div>
      <div className="stat">
        <div className="row"><Ring value={f.done} target={f.total} size={64} stroke={7} /><div><div className="sub">הושלמו</div><div className="lead">{f.done}/{f.total} סטים</div></div></div>
        <Coins value={<Signed n={f.coins} />} label="מטבעות" />
      </div>
      {f.records.length > 0 ? <Notice icon="trophy" tone="warn"><b>{f.text}</b><div className="small">{f.records.join(", ")}</div></Notice> : <Card>{f.text}</Card>}
      {f.goal && <Notice icon="target" tone="ok"><span>השגת את היעד האישי! {f.goalCoins > 0 ? <><Signed n={f.goalCoins} /> מטבעות</> : "מטבעות היעד נוספו ליתרה."}</span></Notice>}
      {f.challenge && <Notice icon="star" tone="acc"><span>השלמת את האתגר השבועי! {f.challengeCoins > 0 ? <><Signed n={f.challengeCoins} /> מטבעות</> : "מטבעות האתגר נוספו ליתרה."}</span></Notice>}
      <Button onClick={() => nav.setTab("S13")}>חזרה לבית</Button>
      <Button secondary onClick={() => nav.go("S16")}>האימונים שלי ותיקון תוצאה</Button>
    </Screen>
  );
}
