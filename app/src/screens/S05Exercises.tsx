// S05 exercises and demo videos (UC1, UC10, stories 1 and 10): the list, a new exercise, a video per exercise.
import { useState } from "react";
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Button, Empty, Field, Item, Screen } from "../design/components";
import { useNav } from "../nav";

export default function S05Exercises({ exerciseID, create }: { exerciseID?: string; create?: boolean }) {
  const nav = useNav();
  const list = useCall("S05", "exercises", "list_exercises");
  const one = useCall("S05", "exercises", "get_exercise", { exerciseID: exerciseID ?? "" });
  const [name, setName] = useState("");
  const [bodyweight, setBodyweight] = useState(false);
  const [url, setUrl] = useState("");

  if (create) {
    const add = async () => {
      const r = await call("S05", "exercises", "create_exercise", { name, isBodyweight: bodyweight });
      if (!r.ok) return nav.toast("חסר שם לתרגיל");
      nav.back(); nav.toast("התרגיל נוסף לרשימה");
    };
    return (
      <Screen eyebrow="תרגיל חדש" title="הוספת תרגיל">
        <Field label="שם התרגיל"><input id="exerciseName" value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: פרפר" /></Field>
        <label className="row"><input id="isBodyweight" type="checkbox" style={{ width: "auto" }} checked={bodyweight} onChange={(e) => setBodyweight(e.target.checked)} /><span>תרגיל משקל גוף</span></label>
        <Button onClick={add}>שמירה</Button>
      </Screen>
    );
  }

  if (exerciseID) {
    const e = one.data;
    if (!e) return <Screen eyebrow="תרגיל" title="">{null}</Screen>;
    const attach = async (payload: Record<string, unknown>, done: string) => {
      const r = await call("S05", "exercises", "attach_video", { exerciseID, ...payload });
      if (!r.ok) return nav.toast(r.error!.message);
      one.reload(); nav.toast(done);
    };
    return (
      <Screen eyebrow="תרגיל" title={e.exerciseName}>
        {e.videoType ? <div className="video">▶︎ {e.videoType === "youtube" ? "סרטון הדגמה מיוטיוב (קישור לדוגמה)" : "סרטון שהמאמן העלה (דוגמה)"}</div> : <Empty>לתרגיל עוד אין סרטון</Empty>}
        <div className="muted small">הסרטון שייך לתרגיל, ומופיע בכל התוכניות שבהן התרגיל נמצא.</div>
        <Field label="קישור לסרטון"><input id="videoUrl" value={url} onChange={(ev) => setUrl(ev.target.value)} placeholder="https://www.youtube.com/..." /></Field>
        <Button secondary onClick={() => attach({ kind: "link", url }, "הסרטון צורף, ומופיע בכל התוכניות")}>צירוף קישור</Button>
        <Button secondary onClick={() => attach({ kind: "upload", seconds: 45 }, "הסרטון עלה (דוגמה)")}>העלאת סרטון מהטלפון (עד דקה)</Button>
        <button className="link" onClick={() => attach({ kind: "upload", seconds: 120 }, "")}>מה קורה בסרטון של שתי דקות?</button>
      </Screen>
    );
  }

  return (
    <Screen eyebrow="רשימת התרגילים" title="תרגילים">
      <div className="list">
        {list.data?.map((e: any) => <Item key={e.ExerciseID} onClick={() => nav.go("S05", { exerciseID: e.ExerciseID })}>
          <span>{e.exerciseName}</span><span className="muted small">{e.videoType === "youtube" ? "קישור יוטיוב" : e.videoType === "upload" ? "סרטון שהועלה" : "אין סרטון"}</span></Item>)}
      </div>
      <Button onClick={() => nav.go("S05", { create: true })}>+ תרגיל חדש</Button>
    </Screen>
  );
}
