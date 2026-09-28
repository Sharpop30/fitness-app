// S03 trainee card (UC4 step 7, story 19): everything about one trainee, without leaving the screen.
import { useCall } from "../api/useCall";
import { Card, Item, Screen } from "../design/components";
import { useNav } from "../nav";

export default function S03TraineeCard({ traineeID }: { traineeID: string }) {
  const nav = useNav();
  const { data } = useCall("S03", "trainees", "get_trainee_card", { traineeID });
  if (!data) return <Screen eyebrow="כרטיס מתאמן" title="">{null}</Screen>;
  // The card carries the active goal only, or none (module map v8; stage 4d plan, decision 9).
  const g = data.goal ? `${data.goal.exerciseName} ${data.goal.targetWeight} ק"ג` : "אין יעד פעיל";
  return (
    <Screen eyebrow="כרטיס מתאמן" title={data.trainee.fullName}>
      <div className="grid3">
        <Card><div className="muted small">מטבעות</div><div className="mono">{data.coins}</div></Card>
        <Card><div className="muted small">רצף</div><div className="mono">{data.streak}</div></Card>
        <Card><div className="muted small">תשלום פתוח</div><div className="mono">{data.openPayments}</div></Card>
      </div>
      <div className="list">
        <Item onClick={() => nav.go("S04", { traineeID })}><span>תוכנית אימון</span><span className="muted small">{data.workouts ? `${data.workouts} אימונים` : "טרם נבנתה"}</span></Item>
        <Item onClick={() => nav.go("S21", { traineeID })}><span>התקדמות וגרף</span><span className="muted small">›</span></Item>
        <Item onClick={() => nav.go("S06", { traineeID })}><span>אימונים שבוצעו והערות</span><span className="muted small">›</span></Item>
        <Item onClick={() => nav.go("S08", { traineeID })}><span>תשלומים וחשבוניות</span><span className="muted small">{data.payments}</span></Item>
        <Item onClick={() => nav.go("S07", { traineeID, goal: data.goal })}><span>יעד אישי</span><span className="muted small">{g}</span></Item>
      </div>
    </Screen>
  );
}
