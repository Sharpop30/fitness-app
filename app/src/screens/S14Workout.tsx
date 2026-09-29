// S14 workout and result entry (UC3, story 12): results prefilled from the target, change only what differed,
// one tap to save; the demo video next to each exercise (UC10). The reply opens S15, the feedback.
import { useEffect, useState } from "react";
import { call, isLive } from "../api/client";
import { useCall } from "../api/useCall";
import { Button, Empty, Item, Screen, VideoPlayer } from "../design/components";
import { useNav } from "../nav";

type SetT = { ExerciseID: string; setNumber: number; reps: number; weight: number; isDone: boolean; isCorrected: boolean };

export default function S14Workout({ workoutID, videoOf }: { workoutID?: string; videoOf?: string }) {
  const nav = useNav();
  const prog = useCall("S14", "programs", "get_active_program");
  const [sets, setSets] = useState<SetT[] | null>(null);
  const w = prog.data?.workouts.find((x: any) => x.WorkoutID === workoutID);

  useEffect(() => {
    if (w) setSets(w.items.flatMap((it: any) => Array.from({ length: it.targetSets }, (_, i) =>
      ({ ExerciseID: it.ExerciseID, setNumber: i + 1, reps: it.targetReps, weight: it.targetWeight, isDone: true, isCorrected: false }))));
  }, [workoutID, prog.data]);

  if (videoOf) return <DemoVideo exerciseID={videoOf} />;

  if (!workoutID) {
    return (
      <Screen eyebrow="התוכנית שלי" title="אימון" noBack>
        {prog.error ? <Empty>{prog.error.message}</Empty> : prog.data?.workouts.map((x: any) => (
          <Item key={x.WorkoutID} onClick={() => nav.go("S14", { workoutID: x.WorkoutID })}>
            <div><div>{x.workoutName}</div><div className="muted small">{x.items.length} תרגילים</div></div><span>›</span></Item>
        ))}
      </Screen>
    );
  }
  if (!w || !sets) return <Screen eyebrow="אימון" title="">{null}</Screen>;

  const upd = (i: number, k: "reps" | "weight", v: string) => { const n = [...sets]; n[i] = { ...n[i], [k]: v === "" ? NaN : +v }; setSets(n); };
  const toggle = (i: number) => { const n = [...sets]; n[i] = { ...n[i], isDone: !n[i].isDone }; setSets(n); };
  const save = async () => {
    const r = await call("S14", "results", "log_workout", { workoutID, sets });
    if (!r.ok) return nav.toast(r.error!.message);
    nav.replace("S15", { feedback: r.data.feedback });
  };

  return (
    <Screen eyebrow="ממולא לפי היעד · שנה רק מה ששונה" title={w.workoutName}>
      {w.items.map((it: any) => {
        const bw = it.targetWeight === 0;
        return (
          <div className="card col" key={it.WorkoutItemID}>
            <div className="row between"><b>{it.exerciseName}</b>{it.hasVideo && <button className="link" onClick={() => nav.go("S14", { videoOf: it.ExerciseID })}>▶︎ סרטון הדגמה</button>}</div>
            <div className="muted small mono">יעד: {it.targetSets}×{it.targetReps}{bw ? "" : ` · ${it.targetWeight} ק"ג`}</div>
            <div className="setrow muted small"><span>סט</span><span>חזרות</span><span>{bw ? "" : "משקל"}</span><span>בוצע</span></div>
            {sets.map((s, i) => s.ExerciseID !== it.ExerciseID ? null : (
              <div className="setrow" key={i}>
                <span className="mono">{s.setNumber}</span>
                <input aria-label="חזרות" type="number" value={Number.isNaN(s.reps) ? "" : s.reps} onChange={(e) => upd(i, "reps", e.target.value)} />
                {bw ? <span /> : <input aria-label="משקל" type="number" step="2.5" value={Number.isNaN(s.weight) ? "" : s.weight} onChange={(e) => upd(i, "weight", e.target.value)} />}
                <button className={`check${s.isDone ? " on" : ""}`} onClick={() => toggle(i)}>{s.isDone ? "✓" : ""}</button>
              </div>
            ))}
          </div>
        );
      })}
      <Button onClick={save}>שמירת האימון</Button>
    </Screen>
  );
}

// The demo video of one exercise. The exercise is asked for only when there is one to show (stage 4b plan, decision 12).
// On the Endpoint the video plays (stage 5 plan, decision 9); on demo data the placeholder stays.
function DemoVideo({ exerciseID }: { exerciseID: string }) {
  const { data: e } = useCall("S14", "exercises", "get_exercise", { exerciseID });
  return <Screen eyebrow="סרטון הדגמה" title={e?.exerciseName ?? ""}>{e && (isLive("S14") && e.videoUrl
    ? <VideoPlayer videoType={e.videoType} videoUrl={e.videoUrl} />
    : <div className="video">▶︎ {e.videoType === "youtube" ? "סרטון הדגמה מיוטיוב (קישור לדוגמה)" : "סרטון שהמאמן העלה (דוגמה)"}</div>)}</Screen>;
}
