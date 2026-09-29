// S14 workout and result entry (UC3, story 12): results prefilled from the target, change only what differed,
// one tap to save; the demo video next to each exercise (UC10). The reply opens S15, the feedback.
// Design stage: the workout list names its exercises (finding 35); each field and ✓ is named per exercise and set (18);
// saving shows "saving" and cannot be pressed twice, so a workout is not logged twice (16); number keypads; loading and
// an error with a retry (2, 6); neutral wording (37).
import { useEffect, useState } from "react";
import { call, isLive } from "../api/client";
import { useCall } from "../api/useCall";
import { Button, Check, Empty, ErrorState, LinkButton, Load, Loading, Row, Screen, VideoPlayer } from "../design/components";
import { useNav } from "../nav";

type SetT = { ExerciseID: string; setNumber: number; reps: number; weight: number; isDone: boolean; isCorrected: boolean };

export default function S14Workout({ workoutID, videoOf }: { workoutID?: string; videoOf?: string }) {
  if (videoOf) return <DemoVideo exerciseID={videoOf} />;
  if (!workoutID) return <Workouts />;
  return <Workout workoutID={workoutID} />;
}

function Workouts() {
  const nav = useNav();
  const prog = useCall("S14", "programs", "get_active_program");
  return (
    <Screen eyebrow="התוכנית שלי" title="אימון" noBack>
      {prog.error?.code === "NO_ACTIVE_PROGRAM"
        ? <Empty title="התוכנית שלך עוד בהכנה אצל המאמן" sub="היא תופיע כאן כשתהיה מוכנה." />
        : <Load state={prog}>{(p: any) => (
          <div className="list">
            {p.workouts.map((x: any) => (
              <Row key={x.WorkoutID} title={x.workoutName} sub={x.items.map((i: any) => i.exerciseName).join(" · ")} onClick={() => nav.go("S14", { workoutID: x.WorkoutID })} />
            ))}
          </div>
        )}</Load>}
    </Screen>
  );
}

function Workout({ workoutID }: { workoutID: string }) {
  const nav = useNav();
  const prog = useCall("S14", "programs", "get_active_program");
  const [sets, setSets] = useState<SetT[] | null>(null);
  const w = prog.data?.workouts.find((x: any) => x.WorkoutID === workoutID);

  useEffect(() => {
    if (w) setSets(w.items.flatMap((it: any) => Array.from({ length: it.targetSets }, (_, i) =>
      ({ ExerciseID: it.ExerciseID, setNumber: i + 1, reps: it.targetReps, weight: it.targetWeight, isDone: true, isCorrected: false }))));
  }, [workoutID, prog.data]);

  if (prog.error) return <Screen eyebrow="אימון" title="אימון"><ErrorState error={prog.error} onRetry={prog.reload} /></Screen>;
  if (prog.data && !w) return <Screen eyebrow="אימון" title="אימון"><Empty title="האימון הזה כבר לא בתוכנית" sub="התוכנית עודכנה. האימונים הנוכחיים בלשונית אימון." /></Screen>;
  if (!w || !sets) return <Screen eyebrow="אימון" title="אימון"><Loading /></Screen>;

  const upd = (i: number, k: "reps" | "weight", v: string) => { const n = [...sets]; n[i] = { ...n[i], [k]: v === "" ? NaN : +v }; setSets(n); };
  const toggle = (i: number) => { const n = [...sets]; n[i] = { ...n[i], isDone: !n[i].isDone }; setSets(n); };
  const save = async () => {
    const r = await call("S14", "results", "log_workout", { workoutID, sets });
    if (!r.ok) return nav.toast(r.error!.message);
    nav.replace("S15", { feedback: r.data.feedback });
  };

  return (
    <Screen eyebrow="ממולא לפי היעד · משנים רק מה ששונה" title={w.workoutName}>
      {w.items.map((it: any) => {
        const bw = it.targetWeight === 0;
        return (
          <div className="card col" key={it.WorkoutItemID}>
            <div className="row between"><b>{it.exerciseName}</b>{it.hasVideo && <LinkButton onClick={() => nav.go("S14", { videoOf: it.ExerciseID })}>▶︎ סרטון הדגמה</LinkButton>}</div>
            <div className="muted small">יעד: <span className="mono">{it.targetSets} סטים × {it.targetReps}{bw ? "" : ` · ${it.targetWeight} ק"ג`}</span></div>
            <div className="setrow muted small" aria-hidden="true"><span>סט</span><span>חזרות</span><span>{bw ? "" : "משקל"}</span><span>בוצע</span></div>
            {sets.map((s, i) => s.ExerciseID !== it.ExerciseID ? null : (
              <div className="setrow" key={i}>
                <span className="mono">{s.setNumber}</span>
                <input aria-label={`${it.exerciseName}, סט ${s.setNumber}, חזרות`} type="number" inputMode="numeric" value={Number.isNaN(s.reps) ? "" : s.reps} onChange={(e) => upd(i, "reps", e.target.value)} />
                {bw ? <span /> : <input aria-label={`${it.exerciseName}, סט ${s.setNumber}, משקל`} type="number" inputMode="decimal" step="2.5" value={Number.isNaN(s.weight) ? "" : s.weight} onChange={(e) => upd(i, "weight", e.target.value)} />}
                <Check on={s.isDone} label={`${it.exerciseName}, סט ${s.setNumber} בוצע`} onClick={() => toggle(i)} />
              </div>
            ))}
          </div>
        );
      })}
      <Button onClick={save} busyText="שומר...">שמירת האימון</Button>
    </Screen>
  );
}

// The demo video of one exercise. The exercise is asked for only when there is one to show (stage 4b plan, decision 12).
// On the Endpoint the video plays (stage 5 plan, decision 9); on demo data the placeholder stays.
function DemoVideo({ exerciseID }: { exerciseID: string }) {
  const one = useCall("S14", "exercises", "get_exercise", { exerciseID });
  return (
    <Screen eyebrow="סרטון הדגמה" title={one.data?.exerciseName ?? ""}>
      <Load state={one}>{(e: any) => isLive("S14") && e.videoUrl
        ? <VideoPlayer videoType={e.videoType} videoUrl={e.videoUrl} />
        : <div className="video">▶︎ {e.videoType === "youtube" ? "סרטון הדגמה מיוטיוב (קישור לדוגמה)" : "סרטון שהמאמן העלה (דוגמה)"}</div>}
      </Load>
    </Screen>
  );
}
