// S09 weekly challenge, coach (UC8, story 5): one challenge a week, automatic completion, prize handover.
// Design stage: marking a prize checks the reply (finding 3), loading and an error with a retry (2, 6), avatars and
// names isolated (8).
import { useState } from "react";
import { call } from "../api/client";
import { both, useCall } from "../api/useCall";
import { Avatar, Badge, Button, Empty, Field, Hero, Item, Load, Name, Screen, Segmented, fmtDate } from "../design/components";
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
        <Load state={exs}>{(list: any[]) => (
          <Field label="תרגיל">
            <select id="challengeExercise" value={exerciseID} onChange={(e) => setExerciseID(e.target.value)}>
              {list.map((e: any) => <option key={e.ExerciseID} value={e.ExerciseID}>{e.exerciseName}</option>)}
            </select>
          </Field>
        )}</Load>
      )}
      <Field label="ערך היעד"><input id="challengeTarget" type="number" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
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
    const r = await call("S09", "challenges", "mark_prize_delivered", { traineeID });
    if (!r.ok) return nav.toast(r.error!.message);
    done.reload(); nav.toast("סומן: הפרס נמסר");
  };
  // get_current_challenge answers null when there is no challenge this week: loaded, not missing.
  const state = { ...both({ ...ch, data: ch.loading || ch.error ? null : { c: ch.data } }, done) };
  return (
    <Screen eyebrow={c ? `שבוע ${fmtDate(c.weekStart)} עד ${fmtDate(c.end)}` : "אתגר שבועי"} title="אתגר שבועי">
      <Load state={state}>{([{ c: cur }, list]: [{ c: any }, any[]]) => <>
        {cur
          ? <Hero><div className="sub">האתגר של השבוע</div><div className="lead">{cur.challengeName}</div><div className="sub">פרס: {cur.coins} מטבעות{cur.extraPrize ? ` + ${cur.extraPrize}` : ""}</div></Hero>
          : <Empty title="אין אתגר השבוע" sub="אתגר חדש מתחיל ביום ראשון, וכל המתאמנים משתתפים." />}
        <h2>השלימו</h2>
        {list.length
          ? <div className="list">{list.map((x: any) => (
            <Item key={x.TraineeID}><Avatar name={x.fullName} /><span className="grow t"><Name>{x.fullName}</Name></span>
              {x.prizeDeliveredAt ? <Badge tone="ok">הפרס נמסר</Badge> : <Button secondary small onClick={() => deliver(x.TraineeID)}>סימון מסירת פרס</Button>}</Item>
          ))}</div>
          : <Empty title="עוד אף אחד לא השלים" />}
      </>}</Load>
      <Button secondary onClick={() => nav.go("S09", { create: true })}>אתגר חדש</Button>
    </Screen>
  );
}
