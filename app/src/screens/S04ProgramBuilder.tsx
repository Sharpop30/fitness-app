// S04 program builder (UC1, story 1): build a program, set sets/reps/weight, and swap an exercise in place.
// Sub-views: swap (pick the replacement), target (set the goal of one item).
import { useEffect, useState } from "react";
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Badge, Button, Empty, Field, Item, Screen, fmtDate } from "../design/components";
import { useNav } from "../nav";

type ItemT = { WorkoutItemID: string; ExerciseID: string; targetSets: number; targetReps: number; targetWeight: number };
type WorkoutT = { WorkoutID: string; workoutName: string; items: ItemT[] };
const newId = () => Math.random().toString(36).slice(2, 9);

export default function S04ProgramBuilder({ traineeID }: { traineeID: string }) {
  const nav = useNav();
  const prog = useCall("S04", "programs", "get_active_program", { traineeID });
  const exs = useCall("S04", "exercises", "list_exercises");
  const [workouts, setWorkouts] = useState<WorkoutT[] | null>(null);
  const [view, setView] = useState<{ kind: "list" } | { kind: "swap" | "target"; w: number; i: number }>({ kind: "list" });

  useEffect(() => { if (prog.data) setWorkouts(structuredClone(prog.data.workouts)); }, [prog.data]);
  const exName = (id: string) => exs.data?.find((e: any) => e.ExerciseID === id)?.exerciseName ?? "";
  const hasVideo = (id: string) => !!exs.data?.find((e: any) => e.ExerciseID === id)?.videoType;

  const startNew = async () => {
    const r = await call("S04", "programs", "start_new_program", { traineeID });
    if (!r.ok) return nav.toast(r.error!.message);
    prog.reload();
    nav.toast("נפתחה תוכנית חדשה. הקודמת נשמרה כלא פעילה");
  };

  if (prog.error?.code === "NO_ACTIVE_PROGRAM") {
    return (
      <Screen eyebrow="תוכנית אימון" title="בניית תוכנית">
        <Empty>למתאמן עוד אין תוכנית.</Empty>
        <Button onClick={startNew}>בניית תוכנית חדשה</Button>
      </Screen>
    );
  }
  if (!workouts || !exs.data) return <Screen eyebrow="תוכנית אימון" title="">{null}</Screen>;

  if (view.kind === "swap") {
    const it = workouts[view.w].items[view.i];
    const pick = async (exerciseID: string) => {
      const r = await call("S04", "programs", "swap_exercise", { traineeID, workoutItemID: it.WorkoutItemID, exerciseID });
      if (r.ok || it.WorkoutItemID.startsWith("new")) {
        const next = structuredClone(workouts); next[view.w].items[view.i].ExerciseID = exerciseID; setWorkouts(next);
        setView({ kind: "target", w: view.w, i: view.i });
        nav.toast("התרגיל הוחלף באותו מקום");
      } else nav.toast(r.error!.message);
    };
    return (
      <Screen eyebrow="החלפת תרגיל" title={exName(it.ExerciseID)} noBack>
        <div className="muted">התרגיל החדש ייכנס לאותו מקום בסדר. התוצאות של התרגיל הקודם נשארות בהיסטוריה.</div>
        <div className="list">
          {exs.data.filter((e: any) => e.ExerciseID !== it.ExerciseID).map((e: any) =>
            <Item key={e.ExerciseID} onClick={() => pick(e.ExerciseID)}><span>{e.exerciseName}</span><span className="muted small">{e.videoType ? "יש סרטון" : ""}</span></Item>)}
        </div>
        <Button secondary onClick={() => nav.go("S05", { create: true })}>+ תרגיל חדש משלי</Button>
        <Button secondary onClick={() => setView({ kind: "list" })}>חזרה לתוכנית</Button>
      </Screen>
    );
  }

  if (view.kind === "target") {
    const it = workouts[view.w].items[view.i];
    const set = (k: keyof ItemT, v: number) => { const next = structuredClone(workouts); (next[view.w].items[view.i] as any)[k] = v; setWorkouts(next); };
    return (
      <Screen eyebrow="יעד לתרגיל" title={exName(it.ExerciseID)} noBack>
        <div className="grid3">
          <Field label="סטים"><input id="targetSets" type="number" value={it.targetSets} onChange={(e) => set("targetSets", +e.target.value)} /></Field>
          <Field label="חזרות"><input id="targetReps" type="number" value={it.targetReps} onChange={(e) => set("targetReps", +e.target.value)} /></Field>
          <Field label='משקל (ק"ג)'><input id="targetWeight" type="number" value={it.targetWeight} onChange={(e) => set("targetWeight", +e.target.value)} /></Field>
        </div>
        <div className="muted small">בתרגיל משקל גוף, השאירו משקל 0.</div>
        <Button onClick={() => {
          if (!(it.targetSets > 0 && it.targetReps > 0 && it.targetWeight >= 0)) return nav.toast("חסר מידע בתרגיל. השלם סטים, חזרות ומשקל");
          setView({ kind: "list" }); nav.toast("היעד עודכן. לחץ שמירה כדי שהמתאמן יראה");
        }}>שמירת היעד</Button>
      </Screen>
    );
  }

  const save = async () => {
    const r = await call("S04", "programs", "save_program", { traineeID, workouts });
    if (!r.ok) return nav.toast(r.error!.message);
    prog.reload(); // new workouts and exercises get their saved IDs, so a second save does not add them again
    nav.toast("התוכנית נשמרה, והמתאמן כבר רואה אותה");
  };
  const addItem = (w: number) => {
    const next = structuredClone(workouts);
    next[w].items.push({ WorkoutItemID: "new" + newId(), ExerciseID: exs.data[0].ExerciseID, targetSets: 3, targetReps: 10, targetWeight: 0 });
    setWorkouts(next); setView({ kind: "swap", w, i: next[w].items.length - 1 });
  };
  const addWorkout = () => setWorkouts([...workouts, { WorkoutID: "w" + newId(), workoutName: "אימון " + "ABCDEFG"[workouts.length], items: [] }]);

  return (
    <Screen eyebrow="תוכנית אימון" title="תוכנית אימון">
      {workouts.map((w, wi) => (
        <div className="card col" key={w.WorkoutID}>
          <div className="row between"><b>{w.workoutName}</b><button className="link" onClick={() => addItem(wi)}>+ תרגיל</button></div>
          {w.items.map((it, ii) => (
            <div className="row between" key={it.WorkoutItemID} style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
              <div>
                <div>{exName(it.ExerciseID)} {hasVideo(it.ExerciseID) && <Badge>סרטון</Badge>}</div>
                <div className="muted small mono">{it.targetSets} סטים · {it.targetReps} חזרות · {it.targetWeight ? `${it.targetWeight} ק"ג` : "משקל גוף"}</div>
              </div>
              <Button secondary small onClick={() => setView({ kind: "swap", w: wi, i: ii })}>החלפה</Button>
            </div>
          ))}
        </div>
      ))}
      <Button secondary onClick={addWorkout}>+ אימון נוסף</Button>
      <Button onClick={save}>שמירה</Button>
      <Button secondary onClick={startNew}>בניית תוכנית חדשה במקום הזו</Button>
      {prog.data?.inactive?.length > 0 && <div className="muted small">תוכניות קודמות (לא פעילות): {prog.data.inactive.map((x: any) => `${x.programName} מ-${fmtDate(x.createdAt)}`).join(", ")}</div>}
    </Screen>
  );
}
