// S16 my workouts and correcting a result (UC3 sub-flow, story 12): history, coach notes, and fixing a set.
// Design stage: each exercise by name with its sets as chips (finding 9); the correction grouped by exercise, with
// column heads and no weight field in a bodyweight exercise (10); the day of the week (32); loading, an error with a
// retry and "none yet" (2, 6, 30).
import { useEffect, useState } from "react";
import { call } from "../api/client";
import { both, useCall } from "../api/useCall";
import { Badge, Button, Empty, ErrorState, ExerciseSets, LinkButton, Load, Loading, Notice, Screen, byExercise, fmtDay } from "../design/components";
import { useNav } from "../nav";

export default function S16MyWorkouts({ fix }: { fix?: string }) {
  if (fix) return <Correct workoutLogID={fix} />;
  return <History />;
}

function History() {
  const nav = useNav();
  const logs = useCall("S16", "results", "list_results");
  const notes = useCall("S16", "feedback", "get_workout_notes");
  return (
    <Screen eyebrow="היסטוריה" title="האימונים שלי">
      <Load state={both(logs, notes)}>{([ls, ns]: [any[], any[]]) => {
        if (!ls.length) return <Empty title="עוד אין אימונים" sub="אחרי השמירה הראשונה, האימונים יופיעו כאן." />;
        const noteOf = (id: string) => ns.find((n: any) => n.WorkoutLogID === id)?.noteText;
        return ls.map((l: any) => (
          <div className="card col" key={l.WorkoutLogID}>
            <div className="row between"><b>{fmtDay(l.performedAt)} · {l.workoutName}</b><LinkButton onClick={() => nav.go("S16", { fix: l.WorkoutLogID })}>תיקון</LinkButton></div>
            {byExercise(l.sets).map((x) => <ExerciseSets key={x.id} name={x.name} bodyweight={x.bodyweight} sets={x.sets}
              extra={x.sets.some((s: any) => s.isCorrected) ? <> <Badge tone="warn">תוקן</Badge></> : undefined} />)}
            {noteOf(l.WorkoutLogID) && <Notice><span className="small">💬 הערת המאמן: {noteOf(l.WorkoutLogID)}</span></Notice>}
          </div>
        ));
      }}</Load>
    </Screen>
  );
}

function Correct({ workoutLogID }: { workoutLogID: string }) {
  const nav = useNav();
  const logs = useCall("S16", "results", "list_results");
  const log = logs.data?.find((l: any) => l.WorkoutLogID === workoutLogID);
  const [sets, setSets] = useState<any[] | null>(null);
  useEffect(() => { if (log) setSets(structuredClone(log.sets)); }, [workoutLogID, logs.data]);

  if (logs.error) return <Screen eyebrow="תיקון תוצאה" title="תיקון"><ErrorState error={logs.error} onRetry={logs.reload} /></Screen>;
  if (!sets || !log) return <Screen eyebrow="תיקון תוצאה" title="תיקון"><Loading /></Screen>;

  // The sets keep their order: the correction is matched set by set.
  const upd = (i: number, k: string, v: string) => { const n = [...sets]; n[i] = { ...n[i], [k]: +v }; setSets(n); };
  const save = async () => {
    const r = await call("S16", "results", "correct_result", { workoutLogID, sets });
    if (!r.ok) return nav.toast(r.error!.message);
    nav.back(); nav.toast("התיקון נשמר. המטבעות לא השתנו, והמאמן יראה שהערך תוקן");
  };
  const indexed = sets.map((s, i) => ({ ...s, i }));
  // Bodyweight or not from the saved workout, so typing a 0 while correcting does not hide the weight field.
  const bodyweight = Object.fromEntries(byExercise(log.sets).map((x) => [x.id, x.bodyweight]));
  return (
    <Screen eyebrow="תיקון תוצאה" title={`תיקון · ${fmtDay(log.performedAt)}`}>
      {byExercise(indexed).map((x) => (
        <div className="card col" key={x.id}>
          <b>{x.name}</b>
          <div className="setrow muted small" aria-hidden="true"><span>סט</span><span>חזרות</span><span>{bodyweight[x.id] ? "" : "משקל"}</span><span /></div>
          {x.sets.map((s: any) => (
            <div className="setrow" key={s.i}>
              <span className="mono">{s.setNumber}</span>
              <input aria-label={`${x.name}, סט ${s.setNumber}, חזרות`} type="number" inputMode="numeric" value={s.reps} onChange={(e) => upd(s.i, "reps", e.target.value)} />
              {bodyweight[x.id] ? <span /> : <input aria-label={`${x.name}, סט ${s.setNumber}, משקל`} type="number" inputMode="decimal" value={s.weight} onChange={(e) => upd(s.i, "weight", e.target.value)} />}
              <span />
            </div>
          ))}
        </div>
      ))}
      <div className="muted small">התיקון לא משנה את המטבעות, והמאמן יראה שהערך תוקן.</div>
      <Button onClick={save}>שמירת התיקון</Button>
    </Screen>
  );
}
