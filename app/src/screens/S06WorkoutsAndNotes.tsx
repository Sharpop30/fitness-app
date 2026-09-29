// S06 completed workouts and coach notes (UC3, UC6, stories 12 and 21): what the trainee did, with a "corrected" mark.
// Design stage: each exercise by name, its sets as chips with the unit (finding 9); the trainee's name above the title
// (11); the day of the week (32); loading, an error with a retry, and "none yet" only on a reply that came (2, 6).
import { useState } from "react";
import { call } from "../api/client";
import { both, useCall } from "../api/useCall";
import { Badge, Button, Empty, ExerciseSets, byExercise, Field, LinkButton, Load, Name, Notice, Screen, fmtDay } from "../design/components";
import { useNav } from "../nav";

export default function S06WorkoutsAndNotes({ traineeID, name, noteFor }: { traineeID: string; name?: string; noteFor?: string }) {
  if (noteFor) return <NoteForm workoutLogID={noteFor} />;
  return <Workouts traineeID={traineeID} name={name} />;
}

function Workouts({ traineeID, name }: { traineeID: string; name?: string }) {
  const nav = useNav();
  const logs = useCall("S06", "results", "list_results", { traineeID });
  const notes = useCall("S06", "feedback", "get_workout_notes", { traineeID });
  return (
    <Screen eyebrow={name ? <Name>{name}</Name> : "המתאמן"} title="אימונים שבוצעו">
      <Load state={both(logs, notes)}>{([ls, ns]: [any[], any[]]) => {
        if (!ls.length) return <Empty title="עוד אין אימונים שבוצעו" sub="האימונים יופיעו כאן אחרי שהמתאמן ישמור אותם." />;
        const noteOf = (id: string) => ns.find((n: any) => n.WorkoutLogID === id)?.noteText;
        return ls.map((l: any) => (
          <div className="card col" key={l.WorkoutLogID}>
            <div className="row between"><b>{fmtDay(l.performedAt)} · {l.workoutName}</b>{l.sets.some((s: any) => s.isCorrected) && <Badge tone="warn">תוקן</Badge>}</div>
            {byExercise(l.sets).map((x) => <ExerciseSets key={x.id} name={x.name} bodyweight={x.bodyweight} sets={x.sets} />)}
            {noteOf(l.WorkoutLogID)
              ? <Notice><span className="small">ההערה שלך: {noteOf(l.WorkoutLogID)}</span></Notice>
              : <LinkButton onClick={() => nav.go("S06", { traineeID, noteFor: l.WorkoutLogID })}>+ הערה אישית</LinkButton>}
          </div>
        ));
      }}</Load>
    </Screen>
  );
}

// The note form. The longest note is read from SETTINGS, asked only here (module map v8; stage 4b report, gap 2).
function NoteForm({ workoutLogID }: { workoutLogID: string }) {
  const nav = useNav();
  const limit = useCall("S06", "settings", "get_settings", { key: "noteMaxLength" });
  const max = Number(limit.data?.noteMaxLength) || undefined;
  const [text, setText] = useState("");
  const save = async () => {
    const r = await call("S06", "feedback", "add_coach_note", { workoutLogID, noteText: text });
    if (!r.ok) return nav.toast(r.error!.message);
    nav.back(); nav.toast("ההערה נשמרה, והמתאמן יראה אותה");
  };
  return (
    <Screen eyebrow="הערה אישית" title="הערה לאימון">
      <Field label={max ? `ההערה (עד ${max} תווים)` : "ההערה"}>
        <textarea id="noteText" rows={4} maxLength={max} value={text} onChange={(e) => setText(e.target.value)} placeholder="לדוגמה: שיא יפה בסקוואט, בשבוע הבא ננסה 67.5" />
      </Field>
      <Button onClick={save}>שמירה</Button>
    </Screen>
  );
}
