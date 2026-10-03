// S04 program builder (UC1, story 1): build a program, set sets/reps/weight, and swap an exercise in place.
// Sub-views: swap (pick the replacement), target (set the goal of one item).
// Design stage: the trainee's name above the title (finding 11), a question before a new program (20), the name of an
// exercise no longer in the list, from the program itself (21), the top of the page on each sub-view (28), loading and
// an error with a retry (2, 6).
import { useEffect, useState } from "react";
import { call } from "../api/client";
import { both, useCall } from "../api/useCall";
import { Art, Badge, Button, Confirm, Empty, ErrorState, Field, LinkButton, Loading, Name, Row, Screen, fmtDateYear } from "../design/components";
import { useNav } from "../nav";

type ItemT = { WorkoutItemID: string; ExerciseID: string; exerciseName?: string; targetSets: number; targetReps: number; targetWeight: number };
type WorkoutT = { WorkoutID: string; workoutName: string; items: ItemT[] };
const newId = () => Math.random().toString(36).slice(2, 9);

export default function S04ProgramBuilder({ traineeID, name }: { traineeID: string; name?: string }) {
  const nav = useNav();
  const prog = useCall("S04", "programs", "get_active_program", { traineeID });
  const exs = useCall("S04", "exercises", "list_exercises");
  const [workouts, setWorkouts] = useState<WorkoutT[] | null>(null);
  const [view, setViewState] = useState<{ kind: "list" } | { kind: "swap" | "target"; w: number; i: number }>({ kind: "list" });
  const [asking, setAsking] = useState(false);
  const setView = (v: typeof view) => { setViewState(v); window.scrollTo(0, 0); };
  const eyebrow = name ? <Name>{name}</Name> : "תוכנית אימון";

  useEffect(() => { if (prog.data) setWorkouts(structuredClone(prog.data.workouts)); }, [prog.data]);
  const exOf = (id: string) => exs.data?.find((e: any) => e.ExerciseID === id);
  const exName = (it: ItemT) => exOf(it.ExerciseID)?.exerciseName ?? it.exerciseName ?? "תרגיל שהוצא משימוש";
  const hasVideo = (id: string) => !!exOf(id)?.videoType;

  const startNew = async () => {
    const r = await call("S04", "programs", "start_new_program", { traineeID });
    setAsking(false);
    if (!r.ok) return nav.toast(r.error!.message);
    prog.reload();
    nav.toast("נפתחה תוכנית חדשה. הקודמת נשמרה כלא פעילה");
  };

  if (prog.error?.code === "NO_ACTIVE_PROGRAM") {
    return (
      <Screen eyebrow={eyebrow} title="בניית תוכנית">
        <Empty image={<Art name="empty-plan" />} title="למתאמן עוד אין תוכנית" sub="התוכנית מתחילה באימון אחד, ואפשר להוסיף עוד." />
        <Button onClick={startNew}>בניית תוכנית חדשה</Button>
      </Screen>
    );
  }
  const state = both(prog, exs);
  if (state.error) return <Screen eyebrow={eyebrow} title="תוכנית אימון"><ErrorState error={state.error} onRetry={state.reload} /></Screen>;
  if (!workouts || !exs.data) return <Screen eyebrow={eyebrow} title="תוכנית אימון"><Loading /></Screen>;

  if (view.kind === "swap") {
    const it = workouts[view.w].items[view.i];
    const pick = async (exerciseID: string) => {
      const fresh = it.WorkoutItemID.startsWith("new"); // not saved yet: nothing to swap on the server
      const r = fresh ? null : await call("S04", "programs", "swap_exercise", { traineeID, workoutItemID: it.WorkoutItemID, exerciseID });
      if (r && !r.ok) return nav.toast(r.error!.message);
      const next = structuredClone(workouts); next[view.w].items[view.i].ExerciseID = exerciseID; setWorkouts(next);
      setView({ kind: "target", w: view.w, i: view.i });
      nav.toast("התרגיל הוחלף באותו מקום");
    };
    return (
      <Screen eyebrow="החלפת תרגיל" title={exName(it)} noBack>
        <div className="muted">התרגיל החדש ייכנס לאותו מקום בסדר. התוצאות של התרגיל הקודם נשארות בהיסטוריה.</div>
        <div className="list">
          {/* Once per workout (code review, 7c): not the exercise itself, nor one another item of this workout holds. */}
          {exs.data.filter((e: any) => !workouts[view.w].items.some((x) => x.ExerciseID === e.ExerciseID)).map((e: any) =>
            <Row key={e.ExerciseID} title={e.exerciseName} sub={e.videoType ? "יש סרטון" : "אין סרטון"} onClick={() => pick(e.ExerciseID)} />)}
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
      <Screen eyebrow="יעד לתרגיל" title={exName(it)} noBack>
        <div className="grid3">
          <Field label="סטים"><input id="targetSets" type="number" inputMode="numeric" value={it.targetSets} onChange={(e) => set("targetSets", +e.target.value)} /></Field>
          <Field label="חזרות"><input id="targetReps" type="number" inputMode="numeric" value={it.targetReps} onChange={(e) => set("targetReps", +e.target.value)} /></Field>
          <Field label='משקל (ק"ג)'><input id="targetWeight" type="number" inputMode="decimal" value={it.targetWeight} onChange={(e) => set("targetWeight", +e.target.value)} /></Field>
        </div>
        <div className="muted small">בתרגיל משקל גוף, משאירים משקל 0.</div>
        <Button onClick={() => {
          if (!(it.targetSets > 0 && it.targetReps > 0 && it.targetWeight >= 0)) return nav.toast("חסר מידע בתרגיל. צריך סטים, חזרות ומשקל");
          setView({ kind: "list" }); nav.toast("היעד עודכן. כדי שהמתאמן יראה אותו, לוחצים שמירה");
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
    // Starts at the first exercise not yet in this workout, as an exercise appears once per workout (code review, 7c).
    const free = exs.data.find((e: any) => !workouts[w].items.some((x) => x.ExerciseID === e.ExerciseID));
    if (!free) return;
    const next = structuredClone(workouts);
    next[w].items.push({ WorkoutItemID: "new" + newId(), ExerciseID: free.ExerciseID, targetSets: 3, targetReps: 10, targetWeight: 0 });
    setWorkouts(next); setView({ kind: "swap", w, i: next[w].items.length - 1 });
  };
  const addWorkout = () => setWorkouts([...workouts, { WorkoutID: "w" + newId(), workoutName: "אימון " + "ABCDEFG"[workouts.length], items: [] }]);

  return (
    <Screen eyebrow={eyebrow} title="תוכנית אימון">
      {workouts.map((w, wi) => (
        <div className="card col" key={w.WorkoutID}>
          <div className="row between"><b>{w.workoutName}</b><LinkButton onClick={() => addItem(wi)}>+ תרגיל</LinkButton></div>
          {w.items.length === 0 && <div className="muted small divider">עוד אין תרגילים באימון הזה.</div>}
          {w.items.map((it, ii) => (
            <div className="row between divider" key={it.WorkoutItemID}>
              <div>
                <div>{exName(it)} {hasVideo(it.ExerciseID) && <Badge>סרטון</Badge>}</div>
                <div className="muted small mono">{it.targetSets} סטים · {it.targetReps} חזרות · {it.targetWeight ? `${it.targetWeight} ק"ג` : "משקל גוף"}</div>
              </div>
              <Button secondary small onClick={() => setView({ kind: "swap", w: wi, i: ii })}>החלפה</Button>
            </div>
          ))}
        </div>
      ))}
      <Button secondary onClick={addWorkout}>+ אימון נוסף</Button>
      <Button onClick={save}>שמירה</Button>
      {asking
        ? <Confirm text="התוכנית הנוכחית תישמר כלא פעילה. להמשיך?" yes="כן, תוכנית חדשה" onYes={startNew} onNo={() => setAsking(false)} />
        : <Button secondary onClick={() => setAsking(true)}>בניית תוכנית חדשה במקום הזו</Button>}
      {prog.data?.inactive?.length > 0 && <div className="muted small">תוכניות קודמות (לא פעילות): {prog.data.inactive.map((x: any) => `${x.programName} מ-${fmtDateYear(x.createdAt)}`).join(", ")}</div>}
    </Screen>
  );
}
