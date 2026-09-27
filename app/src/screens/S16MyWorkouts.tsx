// S16 my workouts and correcting a result (UC3 sub-flow, story 12): history, coach notes, and fixing a set.
import { useEffect, useState } from "react";
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Badge, Button, Empty, Notice, Screen, fmtDate, setsText } from "../design/components";
import { useNav } from "../nav";

export default function S16MyWorkouts({ fix }: { fix?: string }) {
  const nav = useNav();
  const logs = useCall("S16", "results", "list_results");
  const notes = useCall("S16", "feedback", "get_workout_notes");
  const log = logs.data?.find((l: any) => l.WorkoutLogID === fix);
  const [sets, setSets] = useState<any[] | null>(null);
  useEffect(() => { if (log) setSets(structuredClone(log.sets)); }, [fix, logs.data]);

  if (fix) {
    if (!sets) return <Screen eyebrow="תיקון תוצאה" title="">{null}</Screen>;
    const upd = (i: number, k: string, v: string) => { const n = [...sets]; n[i] = { ...n[i], [k]: +v }; setSets(n); };
    const save = async () => {
      const r = await call("S16", "results", "correct_result", { workoutLogID: fix, sets });
      if (!r.ok) return nav.toast(r.error!.message);
      nav.back(); nav.toast("התיקון נשמר. המטבעות לא השתנו, והמאמן יראה שהערך תוקן");
    };
    return (
      <Screen eyebrow="תיקון תוצאה" title="תיקון">
        <div className="card col">
          {sets.map((s, i) => (
            <div className="setrow" key={i}>
              <span className="mono">{s.setNumber}</span>
              <input aria-label="חזרות" type="number" value={s.reps} onChange={(e) => upd(i, "reps", e.target.value)} />
              <input aria-label="משקל" type="number" value={s.weight} onChange={(e) => upd(i, "weight", e.target.value)} />
              <span />
            </div>
          ))}
        </div>
        <div className="muted small">התיקון לא משנה את המטבעות, והמאמן יראה שהערך תוקן.</div>
        <Button onClick={save}>שמירת התיקון</Button>
      </Screen>
    );
  }

  const noteOf = (id: string) => notes.data?.find((n: any) => n.WorkoutLogID === id)?.noteText;
  return (
    <Screen eyebrow="היסטוריה" title="האימונים שלי">
      {!logs.data?.length && <Empty>עוד אין אימונים</Empty>}
      {logs.data?.map((l: any) => {
        const exIDs = [...new Set(l.sets.map((s: any) => s.ExerciseID))] as string[];
        return (
          <div className="card col" key={l.WorkoutLogID}>
            <div className="row between"><b>{fmtDate(l.performedAt)} · {l.workoutName}</b><button className="link" onClick={() => nav.go("S16", { fix: l.WorkoutLogID })}>תיקון</button></div>
            {exIDs.map((id) => <div className="small mono" key={id}>{setsText(l.sets, id)}</div>)}
            {l.sets.some((s: any) => s.isCorrected) && <Badge tone="warn">תוקן</Badge>}
            {noteOf(l.WorkoutLogID) && <Notice><span className="small">💬 הערת המאמן: {noteOf(l.WorkoutLogID)}</span></Notice>}
          </div>
        );
      })}
    </Screen>
  );
}
