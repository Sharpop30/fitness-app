// S06 completed workouts and coach notes (UC3, UC6, stories 12 and 21): what the trainee did, with a "corrected" mark.
import { useState } from "react";
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Badge, Button, Empty, Notice, Screen, fmtDate, setsText } from "../design/components";
import { useNav } from "../nav";

export default function S06WorkoutsAndNotes({ traineeID, noteFor }: { traineeID: string; noteFor?: string }) {
  const nav = useNav();
  const logs = useCall("S06", "results", "list_results", { traineeID });
  const notes = useCall("S06", "feedback", "get_workout_notes", { traineeID });

  if (noteFor) return <NoteForm workoutLogID={noteFor} />;

  const noteOf = (id: string) => notes.data?.find((n: any) => n.WorkoutLogID === id)?.noteText;
  return (
    <Screen eyebrow="המתאמן" title="אימונים שבוצעו">
      {!logs.data?.length && <Empty>עוד אין אימונים שבוצעו</Empty>}
      {logs.data?.map((l: any) => {
        const exIDs = [...new Set(l.sets.map((s: any) => s.ExerciseID))] as string[];
        return (
          <div className="card col" key={l.WorkoutLogID}>
            <div className="row between"><b>{fmtDate(l.performedAt)} · {l.workoutName}</b>{l.sets.some((s: any) => s.isCorrected) && <Badge tone="warn">תוקן</Badge>}</div>
            {exIDs.map((id) => <div className="small" key={id}><span className="mono">{setsText(l.sets, id)}</span></div>)}
            {noteOf(l.WorkoutLogID)
              ? <Notice><span className="small">ההערה שלך: {noteOf(l.WorkoutLogID)}</span></Notice>
              : <button className="link" onClick={() => nav.go("S06", { traineeID, noteFor: l.WorkoutLogID })}>+ הערה אישית</button>}
          </div>
        );
      })}
    </Screen>
  );
}

// The note form. The longest note is read from SETTINGS, asked only here (module map v8; stage 4b report, gap 2).
function NoteForm({ workoutLogID }: { workoutLogID: string }) {
  const nav = useNav();
  const limit = useCall("S06", "settings", "get_settings", { key: "noteMaxLength" });
  const [text, setText] = useState("");
  const save = async () => {
    const r = await call("S06", "feedback", "add_coach_note", { workoutLogID, noteText: text });
    if (!r.ok) return nav.toast(r.error!.message);
    nav.back(); nav.toast("ההערה נשמרה, והמתאמן יראה אותה");
  };
  return (
    <Screen eyebrow="הערה אישית" title="הערה לאימון">
      <textarea id="noteText" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="לדוגמה: שיא יפה בסקוואט, בשבוע הבא ננסה 67.5" />
      {limit.data?.noteMaxLength && <div className="muted small">עד {limit.data.noteMaxLength} תווים.</div>}
      <Button onClick={save}>שמירה</Button>
    </Screen>
  );
}
