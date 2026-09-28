// S11 classes, coach (UC11, story 30): publish, see who is registered and waiting, mark attendance,
// cancel a class, and decide late-cancel requests. Sub-views: publish, one class.
import { useEffect, useState } from "react";
import { call, now } from "../api/client";
import { useCall } from "../api/useCall";
import { Badge, Button, Field, Item, Screen, WarnBox, fmtDate, fmtTime } from "../design/components";
import { useNav } from "../nav";

export default function S11CoachClasses({ classID, publish }: { classID?: string; publish?: boolean }) {
  const nav = useNav();
  const all = useCall("S11", "classes", "list_upcoming_classes");
  const one = useCall("S11", "classes", "list_registrations", { classID: classID ?? "" });
  // "Past" and the default date follow the screen's clock, not a fixed demo day (stage 4c plan, decision 10).
  const today = now("S11");
  const isPast = (startsAt: string) => new Date(startsAt) < today;
  const [form, setForm] = useState({ date: today.toLocaleDateString("en-CA"), time: "18:30", place: "פארק הירקון", capacity: "8" });
  const [present, setPresent] = useState<string[]>([]);
  useEffect(() => { if (one.data) setPresent(one.data.registered.filter((r: any) => r.attended).map((r: any) => r.TraineeID)); }, [one.data]);

  if (publish) {
    const go = async () => {
      const r = await call("S11", "classes", "publish_class", { startsAt: `${form.date}T${form.time}:00`, place: form.place, capacity: Number(form.capacity) });
      if (!r.ok) return nav.toast(r.error!.message);
      nav.back(); nav.toast("השיעור פורסם");
    };
    const set = (k: keyof typeof form) => (e: any) => setForm({ ...form, [k]: e.target.value });
    return (
      <Screen eyebrow="שיעור קבוצתי" title="פרסום שיעור">
        <div className="grid2">
          <Field label="תאריך"><input id="classDate" type="date" value={form.date} onChange={set("date")} /></Field>
          <Field label="שעה"><input id="classTime" type="time" value={form.time} onChange={set("time")} /></Field>
        </div>
        <Field label="מקום"><input id="classPlace" value={form.place} onChange={set("place")} /></Field>
        <Field label="מספר מקומות"><input id="classCapacity" type="number" value={form.capacity} onChange={set("capacity")} /></Field>
        <Button onClick={go}>פרסום</Button>
      </Screen>
    );
  }

  if (classID) {
    const k = one.data;
    if (!k) return <Screen eyebrow="שיעור" title="">{null}</Screen>;
    const past = isPast(k.startsAt);
    const save = async () => {
      const r = await call("S11", "classes", "mark_attendance", { classID, present });
      nav.toast(r.data?.awarded ? `הנוכחות נשמרה. ${r.data.awarded} מתאמנים קיבלו מטבעות` : "הנוכחות נשמרה");
    };
    const cancel = async () => { await call("S11", "classes", "cancel_class", { classID }); one.reload(); nav.toast("השיעור בוטל, והנרשמים קיבלו הודעה"); };
    return (
      <Screen eyebrow={`${fmtDate(k.startsAt)} · ${fmtTime(k.startsAt)}`} title={k.place}>
        {k.status === "cancelled" && <WarnBox>השיעור בוטל, והנרשמים קיבלו הודעה.</WarnBox>}
        <h2>{past ? "סימון נוכחות" : "רשומים"} ({k.registered.length}/{k.capacity})</h2>
        <div className="list">
          {k.registered.map((r: any) => {
            const on = present.includes(r.TraineeID);
            return <Item key={r.TraineeID}><span>{r.fullName}</span>{past && <button className={`check${on ? " on" : ""}`} onClick={() => setPresent(on ? present.filter((x) => x !== r.TraineeID) : [...present, r.TraineeID])}>{on ? "✓" : ""}</button>}</Item>;
          })}
        </div>
        {k.waitlist.length > 0 && <><h2>רשימת המתנה</h2>{k.waitlist.map((r: any, i: number) => <Item key={r.TraineeID}><span>{i + 1}. {r.fullName}</span></Item>)}</>}
        {past ? <Button onClick={save}>שמירת נוכחות (מי שסומן מקבל מטבעות)</Button>
          : k.status === "active" && <Button secondary onClick={cancel}>ביטול השיעור והודעה לנרשמים</Button>}
      </Screen>
    );
  }

  const decide = async (requestID: string, approve: boolean) => {
    await call("S11", "classes", "decide_late_cancel", { requestID, approve });
    all.reload(); nav.toast(approve ? "הבקשה אושרה" : "הבקשה נדחתה");
  };
  return (
    <Screen eyebrow="שיעורים קבוצתיים" title="שיעורים" noBack>
      {all.data?.lateRequests.length > 0 && <>
        <h2>בקשות ביטול חריגות</h2>
        {all.data.lateRequests.map((r: any) => (
          <div className="warnbox col" key={r.LateCancelRequestID}>
            <div>{r.fullName} מבקש לבטל את השיעור ב-{fmtDate(r.startsAt)}</div>
            <div className="row"><Button small onClick={() => decide(r.LateCancelRequestID, true)}>אישור</Button><Button small secondary onClick={() => decide(r.LateCancelRequestID, false)}>דחייה</Button></div>
          </div>
        ))}
      </>}
      <div className="list">
        {all.data?.classes.map((k: any) => (
          <Item key={k.ClassID} onClick={() => nav.go("S11", { classID: k.ClassID })}>
            <div><div>{fmtDate(k.startsAt)} · {fmtTime(k.startsAt)} · {k.place}</div>
              <div className="muted small">{k.status === "cancelled" ? "בוטל" : `${k.registered.length}/${k.capacity} רשומים${k.waitlist.length ? ` · ${k.waitlist.length} בהמתנה` : ""}`}</div></div>
            {isPast(k.startsAt) && <Badge>עבר</Badge>}
          </Item>
        ))}
      </div>
      <Button onClick={() => nav.go("S11", { publish: true })}>פרסום שיעור</Button>
    </Screen>
  );
}
