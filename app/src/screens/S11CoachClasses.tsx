// S11 classes, coach (UC11, story 30): publish, see who is registered and waiting, mark attendance,
// cancel a class, and decide late-cancel requests. Sub-views: publish, one class.
// Design stage: every action checks its reply (finding 3), rows with the time column and the weekday (32), attendance
// by a named, pressed status per trainee (18), tiles, loading and an error with a retry (2, 6), neutral wording (37).
import { useEffect, useState } from "react";
import { call, now } from "../api/client";
import { useCall } from "../api/useCall";
import { Avatar, Badge, Button, Chevron, Empty, Field, Item, Load, Name, Screen, StatusToggle, Tile, WarnBox, When, fmtDay, fmtTime } from "../design/components";
import { useNav } from "../nav";

export default function S11CoachClasses({ classID, publish }: { classID?: string; publish?: boolean }) {
  // "Past" and the default date follow the screen's clock, not a fixed demo day (stage 4c plan, decision 10).
  const today = now("S11");
  const isPast = (startsAt: string) => new Date(startsAt) < today;
  if (publish) return <Publish today={today} />;
  if (classID) return <OneClass classID={classID} isPast={isPast} />;
  return <Classes isPast={isPast} />;
}

function Publish({ today }: { today: Date }) {
  const nav = useNav();
  const [form, setForm] = useState({ date: today.toLocaleDateString("en-CA"), time: "18:30", place: "פארק הירקון", capacity: "8" });
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
      <Field label="מספר מקומות"><input id="classCapacity" type="number" inputMode="numeric" value={form.capacity} onChange={set("capacity")} /></Field>
      <Button onClick={go}>פרסום</Button>
    </Screen>
  );
}

function Classes({ isPast }: { isPast: (startsAt: string) => boolean }) {
  const nav = useNav();
  const all = useCall("S11", "classes", "list_upcoming_classes");
  const decide = async (requestID: string, approve: boolean) => {
    const r = await call("S11", "classes", "decide_late_cancel", { requestID, approve });
    if (!r.ok) return nav.toast(r.error!.message);
    all.reload(); nav.toast(approve ? "הבקשה אושרה" : "הבקשה נדחתה");
  };
  return (
    <Screen eyebrow="שיעורים קבוצתיים" title="שיעורים" noBack>
      <Load state={all}>{(d: any) => <>
        {d.lateRequests.length > 0 && <>
          <h2>בקשות ביטול חריגות</h2>
          {d.lateRequests.map((r: any) => (
            <div className="warnbox col" key={r.LateCancelRequestID}>
              <div><Name>{r.fullName}</Name> מבקש/ת לבטל את השיעור ב{fmtDay(r.startsAt)} בשעה {fmtTime(r.startsAt)}</div>
              <div className="row"><Button small onClick={() => decide(r.LateCancelRequestID, true)}>אישור</Button><Button small secondary onClick={() => decide(r.LateCancelRequestID, false)}>דחייה</Button></div>
            </div>
          ))}
        </>}
        {d.classes.length
          ? <div className="list">
            {d.classes.map((k: any) => (
              <Item key={k.ClassID} onClick={() => nav.go("S11", { classID: k.ClassID })}>
                <When at={k.startsAt} />
                <div className="grow"><div className="t">{k.place}</div>
                  <div className="s">{k.status === "cancelled" ? "בוטל" : `${k.registered.length}/${k.capacity} רשומים${k.waitlist.length ? ` · ${k.waitlist.length} בהמתנה` : ""}`}</div></div>
                {isPast(k.startsAt) ? <Badge>עבר</Badge> : k.status === "cancelled" ? <Badge tone="warn">בוטל</Badge> : <Chevron />}
              </Item>
            ))}
          </div>
          : <Empty title="אין שיעורים קרובים" sub="שיעור שמתפרסם מופיע כאן ואצל המתאמנים." />}
      </>}</Load>
      <Button onClick={() => nav.go("S11", { publish: true })}>פרסום שיעור</Button>
    </Screen>
  );
}

// One class, asked only when there is a class ID (stage 4c report, gap 1; as in S14, stage 4b plan, decision 12).
function OneClass({ classID, isPast }: { classID: string; isPast: (startsAt: string) => boolean }) {
  const nav = useNav();
  const one = useCall("S11", "classes", "list_registrations", { classID });
  const [present, setPresent] = useState<string[]>([]);
  useEffect(() => { if (one.data) setPresent(one.data.registered.filter((r: any) => r.attended).map((r: any) => r.TraineeID)); }, [one.data]);
  const k = one.data;
  const save = async () => {
    const r = await call("S11", "classes", "mark_attendance", { classID, present });
    if (!r.ok) return nav.toast(r.error!.message);
    nav.toast(r.data?.awarded ? `הנוכחות נשמרה. ${r.data.awarded} מתאמנים קיבלו מטבעות` : "הנוכחות נשמרה");
  };
  const cancel = async () => {
    const r = await call("S11", "classes", "cancel_class", { classID });
    if (!r.ok) return nav.toast(r.error!.message);
    one.reload(); nav.toast("השיעור בוטל, והנרשמים קיבלו הודעה");
  };
  return (
    <Screen eyebrow={k ? `${fmtDay(k.startsAt)} · ${fmtTime(k.startsAt)}` : "שיעור"} title={k?.place ?? ""}>
      <Load state={one}>{(c: any) => {
        const past = isPast(c.startsAt);
        return <>
          {c.status === "cancelled" && <WarnBox>השיעור בוטל, והנרשמים קיבלו הודעה.</WarnBox>}
          <div className="grid2">
            <Tile label={past ? "הגיעו" : "רשומים"} value={past ? `${present.length}/${c.registered.length}` : `${c.registered.length}/${c.capacity}`} />
            <Tile label="בהמתנה" value={c.waitlist.length} />
          </div>
          {past && <div className="muted small">מקישים על הסטטוס של מי שהגיע/ה, ואז שומרים.</div>}
          {c.registered.length
            ? <div className="list">{c.registered.map((r: any) => {
              const on = present.includes(r.TraineeID);
              return (
                <div className="row" key={r.TraineeID}>
                  <Avatar name={r.fullName} /><span className="grow t"><Name>{r.fullName}</Name></span>
                  {past && <StatusToggle on={on} name={r.fullName} onClick={() => setPresent(on ? present.filter((x) => x !== r.TraineeID) : [...present, r.TraineeID])} />}
                </div>
              );
            })}</div>
            : <Empty title="עוד אין נרשמים" />}
          {c.waitlist.length > 0 && <>
            <h2>רשימת המתנה</h2>
            {c.waitlist.map((r: any, i: number) => <div className="row" key={r.TraineeID}><span className="av">{i + 1}</span><Name>{r.fullName}</Name></div>)}
          </>}
          {past ? <Button onClick={save}>שמירת נוכחות (מי שסומן מקבל מטבעות)</Button>
            : c.status === "active" && <Button secondary onClick={cancel}>ביטול השיעור והודעה לנרשמים</Button>}
        </>;
      }}</Load>
    </Screen>
  );
}
