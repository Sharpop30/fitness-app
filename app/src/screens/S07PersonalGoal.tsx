// S07 personal goal (UC7 step 1, story 6): the coach sets a weight goal in one exercise.
// Design stage, finding 4: the form opens on the active goal. The card sends the active goal only, and without a status
// field (trainees.get_trainee_card, module map v8), so its presence is what counts. The goal is named before it is
// replaced; the trainee's name above the title (11); the exercise list loads with a retry (2, 6).
import { useState } from "react";
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Button, Field, Load, Name, Notice, Screen } from "../design/components";
import { useNav } from "../nav";

type Goal = { ExerciseID: string; exerciseName: string; targetWeight: number } | null | undefined;

export default function S07PersonalGoal({ traineeID, name, goal }: { traineeID: string; name?: string; goal?: Goal }) {
  const nav = useNav();
  const exs = useCall("S07", "exercises", "list_exercises");
  // The active goal's exercise, or else the first weighted one in the list (stage 4b plan, decision 12).
  const [picked, setExerciseID] = useState<string>(goal ? goal.ExerciseID : "");
  const exerciseID = picked || exs.data?.find((e: any) => !e.isBodyweight)?.ExerciseID || "";
  const [value, setValue] = useState<string>(goal ? String(goal.targetWeight) : "");

  const save = async () => {
    const r = await call("S07", "coins", "set_personal_goal", { traineeID, exerciseID, targetWeight: Number(value) });
    if (!r.ok) return nav.toast(Number(value) > 0 ? r.error!.message : "חסר משקל יעד");
    nav.back(); nav.toast("היעד נשמר");
  };
  return (
    <Screen eyebrow={name ? <Name>{name}</Name> : "המתאמן"} title="יעד אישי">
      {goal && <Notice><span className="small">היעד הנוכחי: {goal.exerciseName} {goal.targetWeight} ק"ג. שמירה כאן מחליפה אותו.</span></Notice>}
      <Load state={exs}>{(list: any[]) => (
        <Field label="תרגיל">
          <select id="goalExercise" value={exerciseID} onChange={(e) => setExerciseID(e.target.value)}>
            {list.filter((e: any) => !e.isBodyweight).map((e: any) => <option key={e.ExerciseID} value={e.ExerciseID}>{e.exerciseName}</option>)}
          </select>
        </Field>
      )}</Load>
      <Field label='משקל יעד (ק"ג)'><input id="goalWeight" type="number" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
      <div className="muted small">כשהמתאמן עובר את היעד מתקבלים מטבעות, והיעד נסגר עד שיוגדר יעד חדש.</div>
      <Button onClick={save}>שמירת היעד</Button>
    </Screen>
  );
}
