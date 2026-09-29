// S03 trainee card (UC4 step 7, story 19): everything about one trainee, without leaving the screen.
// Design stage: the name in the title from the start, tiles, and the goal's state (findings 6, 35). The name goes on to
// the screens opened from here, for their titles (finding 11).
import { useCall } from "../api/useCall";
import { Badge, Load, Name, Row, Screen, Tile, fmtNum } from "../design/components";
import { useNav } from "../nav";

export default function S03TraineeCard({ traineeID, name }: { traineeID: string; name?: string }) {
  const nav = useNav();
  const card = useCall("S03", "trainees", "get_trainee_card", { traineeID });
  const fullName: string = card.data?.trainee.fullName ?? name ?? "";
  return (
    <Screen eyebrow="כרטיס מתאמן" title={<Name>{fullName}</Name>}>
      <Load state={card}>{(d: any) => {
        // The card carries the active goal only, or none (module map v8; stage 4d plan, decision 9).
        const goal = d.goal ? `${d.goal.exerciseName} ${d.goal.targetWeight} ק"ג · פעיל` : "אין יעד פעיל";
        const to = (screen: string, extra: Record<string, unknown> = {}) => () => nav.go(screen, { traineeID, name: fullName, ...extra });
        return <>
          <div className="grid3">
            <Tile label="מטבעות" value={fmtNum(d.coins)} />
            <Tile label="רצף" value={d.streak} />
            <Tile label="לתשלום" value={d.openPayments} />
          </div>
          <div className="list">
            <Row title="תוכנית אימון" sub={d.workouts ? `${d.workouts} אימונים` : "טרם נבנתה"} onClick={to("S04")} />
            <Row title="התקדמות וגרף" onClick={to("S21")} />
            <Row title="אימונים שבוצעו והערות" onClick={to("S06")} />
            <Row title="תשלומים וחשבוניות" sub={`${d.payments} בקשות`} end={d.openPayments ? <Badge tone="warn">לתשלום</Badge> : undefined} onClick={to("S08")} />
            <Row title="יעד אישי" sub={goal} onClick={to("S07", { goal: d.goal })} />
          </div>
        </>;
      }}</Load>
    </Screen>
  );
}
