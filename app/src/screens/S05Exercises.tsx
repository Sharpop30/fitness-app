// S05 exercises and demo videos (UC1, UC10, stories 1 and 10): the list, a new exercise, a video per exercise.
// Stage 5 (plan, decision 9): on the Endpoint, a file from the phone. The screen measures it and shows it (UC10 step 3,
// section 8); the Endpoint checks it against SETTINGS and gives an upload address; the file goes there; then it is
// attached (module map v9). On demo data the two demo buttons stay.
import { useState } from "react";
import { call, isLive, uploadFile } from "../api/client";
import { useCall } from "../api/useCall";
import { Button, CheckLine, Empty, Field, FileButton, Item, Screen, VideoPlayer } from "../design/components";
import { useNav } from "../nav";

export default function S05Exercises({ exerciseID, create }: { exerciseID?: string; create?: boolean }) {
  const nav = useNav();
  const list = useCall("S05", "exercises", "list_exercises");
  const one = useCall("S05", "exercises", "get_exercise", { exerciseID: exerciseID ?? "" });
  const [name, setName] = useState("");
  const [bodyweight, setBodyweight] = useState(false);
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<{ blob: File; preview: string; seconds: number } | null>(null);

  if (create) {
    const add = async () => {
      const r = await call("S05", "exercises", "create_exercise", { name, isBodyweight: bodyweight });
      if (!r.ok) return nav.toast("חסר שם לתרגיל");
      nav.back(); nav.toast("התרגיל נוסף לרשימה");
    };
    return (
      <Screen eyebrow="תרגיל חדש" title="הוספת תרגיל">
        <Field label="שם התרגיל"><input id="exerciseName" value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: פרפר" /></Field>
        <CheckLine id="isBodyweight" label="תרגיל משקל גוף" checked={bodyweight} onChange={setBodyweight} />
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
    // The length, read by the browser; not a video (or unreadable) is 0, and the Endpoint answers VIDEO_INVALID.
    const choose = (blob: File | undefined) => {
      if (!blob) return;
      const preview = URL.createObjectURL(blob);
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.onloadedmetadata = () => setFile({ blob, preview, seconds: Number.isFinite(probe.duration) ? probe.duration : 0 });
      probe.onerror = () => setFile({ blob, preview, seconds: 0 });
      probe.src = preview;
    };
    const upload = async () => {
      if (!file) return;
      const ready = await call("S05", "exercises", "prepare_upload",
        { exerciseID, contentType: file.blob.type, seconds: Math.ceil(file.seconds), megabytes: file.blob.size / (1024 * 1024) });
      if (!ready.ok) return nav.toast(ready.error!.message);
      const sent = await uploadFile(ready.data.uploadUrl, file.blob);
      if (!sent.ok) return nav.toast(sent.error!.message);
      setFile(null);
      await attach({ kind: "upload", path: ready.data.path }, "הסרטון צורף, ומופיע בכל התוכניות");
    };
    const live = isLive("S05");
    return (
      <Screen eyebrow="תרגיל" title={e.exerciseName}>
        {!e.videoType ? <Empty>לתרגיל עוד אין סרטון</Empty>
          : live && e.videoUrl ? <VideoPlayer key={e.videoUrl} videoType={e.videoType} videoUrl={e.videoUrl} />
          : <div className="video">▶︎ {e.videoType === "youtube" ? "סרטון הדגמה מיוטיוב (קישור לדוגמה)" : "סרטון שהמאמן העלה (דוגמה)"}</div>}
        <div className="muted small">הסרטון שייך לתרגיל, ומופיע בכל התוכניות שבהן התרגיל נמצא.</div>
        <Field label="קישור לסרטון"><input id="videoUrl" value={url} onChange={(ev) => setUrl(ev.target.value)} placeholder="https://www.youtube.com/..." /></Field>
        <Button secondary onClick={() => attach({ kind: "link", url }, "הסרטון צורף, ומופיע בכל התוכניות")}>צירוף קישור</Button>
        {live ? <>
          <FileButton id="videoFile" accept="video/*" onFile={choose}>העלאת סרטון מהטלפון (עד דקה)</FileButton>
          {file && <>
            <VideoPlayer key={file.preview} videoType="upload" videoUrl={file.preview} />
            <Button onClick={upload}>שמירה</Button>
          </>}
        </> : <>
          <Button secondary onClick={() => attach({ kind: "upload", seconds: 45 }, "הסרטון עלה (דוגמה)")}>העלאת סרטון מהטלפון (עד דקה)</Button>
          <button className="link" onClick={() => attach({ kind: "upload", seconds: 120 }, "")}>מה קורה בסרטון של שתי דקות?</button>
        </>}
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
