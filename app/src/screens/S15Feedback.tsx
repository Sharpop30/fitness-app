// S15 instant feedback (UC6, story 21): shows the reply of results.log_workout, with no action of its own.
// Design stage: a hero with the sets and the coins, "+10" read left to right (finding 8). The goal and challenge coins
// are credited but not in the reply, so their lines name no number (finding 35 stays open for them).
import { Button, Card, Hero, HeroStat, Notice, Screen, Signed } from "../design/components";
import { useNav } from "../nav";

export default function S15Feedback({ feedback: f }: { feedback: any }) {
  const nav = useNav();
  return (
    <Screen eyebrow="משוב" title="כל הכבוד!" noBack>
      <Hero row>
        <div><div className="sub">הושלמו</div><div className="lead">{f.done}/{f.total} סטים</div></div>
        <HeroStat value={<Signed n={f.coins} />} label="מטבעות" />
      </Hero>
      {f.records.length > 0 ? <Notice><b>🏆 {f.text}</b><div className="small">{f.records.join(", ")}</div></Notice> : <Card>{f.text}</Card>}
      {f.goal && <Notice>🎯 השגת את היעד האישי! מטבעות היעד נוספו ליתרה.</Notice>}
      {f.challenge && <Notice>⭐ השלמת את האתגר השבועי! מטבעות האתגר נוספו ליתרה.</Notice>}
      <Button onClick={() => nav.setTab("S13")}>חזרה לבית</Button>
      <Button secondary onClick={() => nav.go("S16")}>האימונים שלי ותיקון תוצאה</Button>
    </Screen>
  );
}
