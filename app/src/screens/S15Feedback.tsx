// S15 instant feedback (UC6, story 21): shows the reply of results.log_workout, with no action of its own.
import { Button, Card, Hero, Notice, Screen } from "../design/components";
import { useNav } from "../nav";

export default function S15Feedback({ feedback: f }: { feedback: any }) {
  const nav = useNav();
  return (
    <Screen eyebrow="משוב" title="כל הכבוד!" noBack>
      <Hero><div className="sub">הושלמו</div><div className="big">{f.done}/{f.total} סטים</div></Hero>
      {f.records.length > 0 && <Notice><b>🏆 {f.text}</b><div className="small">{f.records.join(", ")}</div></Notice>}
      {f.records.length === 0 && <Card>{f.text}</Card>}
      <Card><div className="row between"><span>מטבעות שנצברו</span><span className="mono">+{f.coins}</span></div></Card>
      {f.goal && <Notice>🎯 השגת את היעד האישי!</Notice>}
      {f.challenge && <Notice>⭐ השלמת את האתגר השבועי!</Notice>}
      <Button onClick={() => nav.setTab("S13")}>חזרה לבית</Button>
      <Button secondary onClick={() => nav.go("S16")}>האימונים שלי ותיקון תוצאה</Button>
    </Screen>
  );
}
