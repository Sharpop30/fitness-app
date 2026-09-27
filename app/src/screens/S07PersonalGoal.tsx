// S07 personal goal (UC7 step 1, story 6): the coach sets a weight goal in one exercise.
// Gap for map v3: the exercise picker needs exercises.list_exercises, which is not in S07's action row.
import { useState } from "react";
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Button, Field, Screen } from "../design/components";
import { useNav } from "../nav";

export default function S07PersonalGoal({ traineeID, goal }: { traineeID: string; goal?: any }) {
  const nav = useNav();
  const exs = useCall("S07", "exercises", "list_exercises");
  const [exerciseID, setExerciseID] = useState<string>(goal?.status === "active" ? goal.ExerciseID : "e1");
  const [value, setValue] = useState<string>(goal?.status === "active" ? String(goal.targetWeight) : "");

  const save = async () => {
    const r = await call("S07", "coins", "set_personal_goal", { traineeID, exerciseID, targetWeight: Number(value) });
    if (!r.ok) return nav.toast("חסר משקל יעד");
    nav.back(); nav.toast("היעד נשמר");
  };
  return (
    <Screen eyebrow="המתאמן" title="יעד אישי">
      <Field label="תרגיל">
        <select id="goalExercise" value={exerciseID} onChange={(e) => setExerciseID(e.target.value)}>
          {exs.data?.filter((e: any) => !e.isBodyweight).map((e: any) => <option key={e.ExerciseID} value={e.ExerciseID}>{e.exerciseName}</option>)}
        </select>
      </Field>
      <Field label='משקל יעד (ק"ג)'><input id="goalWeight" type="number" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
      <div className="muted small">כשהמתאמן עובר את היעד הוא מקבל מטבעות, והיעד נסגר עד שתגדיר חדש.</div>
      <Button onClick={save}>שמירת היעד</Button>
    </Screen>
  );
}
