// S27 the coach card (usecase-12 step 8, story 15; prototype version 3): the coach's trainees, income and upcoming
// classes. Names and sums only, with no results, notes or goals (rule 5). Loading and an error with a retry.
import { useCall } from "../api/useCall";
import { Avatar, Empty, Load, Name, Row, Screen, Tile, fmtMoney } from "../design/components";

export default function S27CoachCard({ coachID, name }: { coachID: string; name?: string }) {
  const card = useCall("S27", "business", "get_coach_card", { coachID });
  const title = (card.data as any)?.coach?.fullName ?? name ?? "";
  return (
    <Screen eyebrow="כרטיס מאמן" title={<Name>{title}</Name>}>
      <Load state={card}>{(d: any) => <>
        <div className="grid3">
          <Tile icon="users" label="מתאמנים" value={d.trainees === null ? "–" : d.trainees.length} />
          <Tile icon="card" tone="ok" label="הכנסות" value={d.income === null ? "–" : fmtMoney(d.income)} />
          <Tile icon="calendar" tone="info" label="שיעורים קרובים" value={d.upcomingClasses ?? "–"} />
        </div>
        <h2>המתאמנים</h2>
        {d.trainees?.length
          ? <div className="list">
            {d.trainees.map((t: any) => (
              <Row key={t.TraineeID} lead={<Avatar name={t.fullName} />} title={<Name>{t.fullName}</Name>}
                sub={`${t.hasProgram ? "יש תוכנית" : "אין תוכנית"} · רצף ${t.streak ?? "–"}`} />
            ))}
          </div>
          : <Empty title="עוד אין מתאמנים" />}
      </>}</Load>
    </Screen>
  );
}
