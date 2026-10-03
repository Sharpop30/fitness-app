// S05 exercises and demo videos (UC1, UC10, stories 1 and 10): the list, a new exercise, a video per exercise.
// Stage 5 (plan, decision 9): on the Endpoint, a file from the phone. The screen measures it and shows it (UC10 step 3,
// section 8); the Endpoint checks it against SETTINGS and gives an upload address; the file goes there; then it is
// attached (module map v9). On demo data the two demo buttons stay.
// Design stage: loading and an error with a retry (findings 2, 6); the link field reads left to right (8); "uploading"
// while the file goes (16). The upload button names no length: the limit is in SETTINGS, which S05 does not read (19).
import { useState } from "react";
import { call, isLive, uploadFile } from "../api/client";
import { useCall } from "../api/useCall";
import { Button, CheckLine, Empty, Field, FileButton, ICONS, LinkButton, Load, Row, Screen, VideoPlayer } from "../design/components";
import { useNav } from "../nav";

export default function S05Exercises({ exerciseID, create }: { exerciseID?: string; create?: boolean }) {
  if (create) return <NewExercise />;
  if (exerciseID) return <OneExercise exerciseID={exerciseID} />;
  return <Exercises />;
}

function Exercises() {
  const nav = useNav();
  const list = useCall("S05", "exercises", "list_exercises");
  return (
    <Screen eyebrow="רשימת התרגילים" title="תרגילים">
      <Load state={list}>{(data: any[]) => data.length
        ? <div className="list">
          {data.map((e: any) => <Row key={e.ExerciseID} title={e.exerciseName} onClick={() => nav.go("S05", { exerciseID: e.ExerciseID })}
            sub={(e.isPrepared ? "מהרשימה המוכנה · " : "") + (e.videoType === "youtube" ? "קישור יוטיוב" : e.videoType === "upload" ? "סרטון שהועלה" : "אין סרטון")} />)}
        </div>
        : <Empty title="עוד אין תרגילים" />}
      </Load>
      <Button onClick={() => nav.go("S05", { create: true })}>+ תרגיל חדש</Button>
    </Screen>
  );
}

function NewExercise() {
  const nav = useNav();
  const [name, setName] = useState("");
  const [bodyweight, setBodyweight] = useState(false);
  const add = async () => {
    const r = await call("S05", "exercises", "create_exercise", { name, isBodyweight: bodyweight });
    if (!r.ok) return nav.toast(name.trim() ? r.error!.message : "חסר שם לתרגיל");
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

// As the prototype: 60 seconds is "עד דקה"; any other length in seconds. The size follows (map v13).
const limitText = (seconds: number, megabytes: number) =>
  `${seconds === 60 ? "עד דקה" : `עד ${seconds} שניות`} ועד ${megabytes} מגה-בייט`;

function OneExercise({ exerciseID }: { exerciseID: string }) {
  const nav = useNav();
  const one = useCall("S05", "exercises", "get_exercise", { exerciseID });
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<{ blob: File; preview: string; seconds: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  // The limits beside the upload button, from SETTINGS (map v13; design-stage gap 2, finding 19): never a fixed "minute".
  const limits = useCall<Record<string, string>>("S05", "settings", "get_settings", { keys: ["videoMaxSeconds", "videoMaxMegabytes"] });
  const limit = limits.data ? ` (${limitText(Number(limits.data.videoMaxSeconds), Number(limits.data.videoMaxMegabytes))})` : "";

  const attach = async (payload: Record<string, unknown>, done: string) => {
    const r = await call("S05", "exercises", "attach_video", { exerciseID, ...payload });
    if (!r.ok) return nav.toast(r.error!.message);
    one.reload(); if (done) nav.toast(done);
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
    setUploading(true);
    try {
      const ready = await call("S05", "exercises", "prepare_upload",
        { exerciseID, contentType: file.blob.type, seconds: Math.ceil(file.seconds), megabytes: file.blob.size / (1024 * 1024) });
      if (!ready.ok) return nav.toast(ready.error!.message);
      const sent = await uploadFile(ready.data.uploadUrl, file.blob);
      if (!sent.ok) return nav.toast(sent.error!.message);
      setFile(null);
      await attach({ kind: "upload", path: ready.data.path }, "הסרטון צורף, ומופיע בכל התוכניות");
    } finally {
      setUploading(false);
    }
  };
  const live = isLive("S05");
  // Map v13, rule 12 (usecase-10 v3, alternative f; prototype 3.2): a ready-made exercise shows its video and why there
  // is nothing to add; its video is set at setup and shared by every coach of the business.
  if (one.data?.isPrepared) {
    const e = one.data;
    return (
      <Screen eyebrow="מהרשימה המוכנה" title={e.exerciseName}>
        {live && e.videoUrl ? <VideoPlayer key={e.videoUrl} videoType={e.videoType} videoUrl={e.videoUrl} />
          : e.videoType ? <div className="video">{ICONS.play} סרטון הדגמה מיוטיוב (קישור לדוגמה)</div> : <Empty title="לתרגיל עוד אין סרטון" />}
        <div className="muted small">התרגיל מהרשימה המוכנה, והסרטון שלו משותף לכל המאמנים בעסק. לסרטון משלך אפשר ליצור תרגיל חדש.</div>
      </Screen>
    );
  }
  return (
    <Screen eyebrow="תרגיל" title={one.data?.exerciseName ?? ""}>
      <Load state={one}>{(e: any) => <>
        {!e.videoType ? <Empty title="לתרגיל עוד אין סרטון" sub="אפשר לצרף קישור או להעלות מהטלפון." />
          : live && e.videoUrl ? <VideoPlayer key={e.videoUrl} videoType={e.videoType} videoUrl={e.videoUrl} />
          : <div className="video">{ICONS.play} {e.videoType === "youtube" ? "סרטון הדגמה מיוטיוב (קישור לדוגמה)" : "סרטון שהמאמן העלה (דוגמה)"}</div>}
        <div className="muted small">הסרטון שייך לתרגיל, ומופיע בכל התוכניות שבהן התרגיל נמצא.</div>
        <Field label="קישור לסרטון"><input id="videoUrl" type="url" value={url} onChange={(ev) => setUrl(ev.target.value)} placeholder="https://www.youtube.com/..." /></Field>
        <Button secondary onClick={() => attach({ kind: "link", url }, "הסרטון צורף, ומופיע בכל התוכניות")}>צירוף קישור</Button>
        {live ? <>
          <FileButton id="videoFile" accept="video/*" onFile={choose} busy={uploading}>{`העלאת סרטון מהטלפון${limit}`}</FileButton>
          {file && <>
            <VideoPlayer key={file.preview} videoType="upload" videoUrl={file.preview} />
            <Button onClick={upload} busyText="מעלה...">שמירה</Button>
          </>}
        </> : <>
          <Button secondary onClick={() => attach({ kind: "upload", seconds: 45 }, "הסרטון עלה (דוגמה)")} busyText="מעלה...">{`העלאת סרטון מהטלפון${limit}`}</Button>
          <LinkButton onClick={() => attach({ kind: "upload", seconds: 120 }, "")}>מה קורה בסרטון ארוך יותר?</LinkButton>
        </>}
      </>}</Load>
    </Screen>
  );
}
