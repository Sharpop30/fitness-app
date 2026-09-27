// S20 weekly challenge, trainee (UC8, story 5): progress counts itself from saved workouts.
import { useCall } from "../api/useCall";
import { Empty, Hero, Screen, fmtDate } from "../design/components";

export default function S20TraineeChallenge() {
  const { data: c } = useCall("S20", "challenges", "get_current_challenge");
  if (!c) return <Screen eyebrow="אתגר שבועי" title="האתגר השבועי"><Empty>אין אתגר השבוע</Empty></Screen>;
  return (
    <Screen eyebrow={`עד ${fmtDate(c.end)}`} title="האתגר השבועי">
      <Hero>
        <div className="sub">{c.challengeName}</div>
        <div className="big">{c.progress?.exempt ? "השבוע אתה פטור" : `${c.progress?.value}/${c.progress?.target}`}</div>
        <div className="sub">פרס: {c.coins} מטבעות{c.extraPrize ? ` + ${c.extraPrize}` : ""}</div>
      </Hero>
      <div className="muted small">ההשלמה נספרת לבד מהאימונים שאתה שומר. אין צורך לדווח שוב.</div>
    </Screen>
  );
}
