// S09 weekly challenge, coach (UC8, story 5): one challenge a week, automatic completion, prize handover.
import { useState } from "react";
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Button, Empty, Field, Hero, Item, Screen, Segmented, fmtDate } from "../design/components";
import { useNav } from "../nav";

export default function S09CoachChallenge({ create }: { create?: boolean }) {
  if (create) return <NewChallenge />;
  return <CurrentChallenge />;
}

function NewChallenge() {
  const nav = useNav();
  // The exercise of an "exercise" challenge is picked from the list (module map v5; stage 4b plan, decision 12).
  const exs = useCall("S09", "exercises", "list_exercises");
  const [name, setName] = useState("חמישה אימונים השבוע");
  const [type, setType] = useState<"count" | "exercise">("count");
  const [target, setTarget] = useState("5");
  const [prize, setPrize] = useState("");
  const [picked, setExerciseID] = useState("");
  const exerciseID = picked || exs.data?.[0]?.ExerciseID || "";

  const publish = async () => {
    const r = await call("S09", "challenges", "create_challenge", { challengeName: name, challengeType: type, targetValue: Number(target), extraPrize: prize, exerciseID: type === "exercise" ? exerciseID : null });
    if (!r.ok) return nav.toast(r.error!.message);
    nav.back(); nav.toast("האתגר פורסם");
  };
  return (
    <Screen eyebrow="אתגר אחד בשבוע" title="אתגר חדש">
      <Field label="שם"><input id="challengeName" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Segmented value={type} options={[["count", "מספר אימונים"], ["exercise", "יעד בתרגיל"]]} onChange={setType} />
      {type === "exercise" && (
        <Field label="תרגיל">
          <select id="challengeExercise" value={exerciseID} onChange={(e) => setExerciseID(e.target.value)}>
            {exs.data?.map((e: any) => <option key={e.ExerciseID} value={e.ExerciseID}>{e.exerciseName}</option>)}
          </select>
        </Field>
      )}
      <Field label="ערך היעד"><input id="challengeTarget" type="number" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
      <Field label="פרס נוסף (לא חובה)"><input id="challengePrize" value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="לדוגמה: חולצה" /></Field>
      <div className="muted small">כל המתאמנים משתתפים. באתגר על תרגיל, מי שהתרגיל אינו בתוכנית שלו פטור. השבוע מתחיל ביום ראשון.</div>
      <Button onClick={publish}>פרסום האתגר</Button>
    </Screen>
  );
}

function CurrentChallenge() {
  const nav = useNav();
  const ch = useCall("S09", "challenges", "get_current_challenge");
  const done = useCall("S09", "challenges", "list_completions");
  const c = ch.data;
  const deliver = async (traineeID: string) => {
    await call("S09", "challenges", "mark_prize_delivered", { traineeID });
    done.reload(); nav.toast("סומן: הפרס נמסר");
  };
  return (
    <Screen eyebrow={c ? `שבוע ${fmtDate(c.weekStart)} עד ${fmtDate(c.end)}` : "אתגר שבועי"} title="אתגר שבועי">
      {c ? <Hero><div className="sub">האתגר של השבוע</div><div className="big">{c.challengeName}</div><div className="sub">פרס: {c.coins} מטבעות{c.extraPrize ? ` + ${c.extraPrize}` : ""}</div></Hero> : <Empty>אין אתגר השבוע</Empty>}
      <h2>השלימו</h2>
      <div className="list">
        {done.data?.length ? done.data.map((x: any) => (
          <Item key={x.TraineeID}><span>{x.fullName}</span>{x.prizeDeliveredAt ? <span className="badge ok">הפרס נמסר</span> : <Button secondary small onClick={() => deliver(x.TraineeID)}>סימון מסירת פרס</Button>}</Item>
        )) : <Empty>עוד אף אחד</Empty>}
      </div>
      <Button secondary onClick={() => nav.go("S09", { create: true })}>אתגר חדש</Button>
    </Screen>
  );
}
