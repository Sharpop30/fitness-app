// S17 classes, trainee (UC11, story 30): register, waitlist, cancel up to the window, and a late-cancel request.
// Design stage: the late request checks its reply (finding 3), each class with the time column, the weekday and a status
// badge (32, 33), neutral wording (37), loading, an error with a retry and "none yet" (2, 6, 30).
// Stage 5b (prototype 4): the team's group illustration when there are no classes.
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Art, Badge, Button, Empty, Load, Screen, WarnBox, When, fmtDay, fmtTime } from "../design/components";
import { useNav } from "../nav";

export default function S17TraineeClasses({ lateFor }: { lateFor?: any }) {
  if (lateFor) return <LateCancel k={lateFor} />;
  return <Classes />;
}

function LateCancel({ k }: { k: any }) {
  const nav = useNav();
  const send = async () => {
    const r = await call("S17", "classes", "request_late_cancel", { classID: k.ClassID });
    if (!r.ok) return nav.toast(r.error!.message);
    nav.back(); nav.toast("הבקשה נשלחה למאמן");
  };
  return (
    <Screen eyebrow="ביטול מאוחר" title={`${fmtDay(k.startsAt)} · ${fmtTime(k.startsAt)}`}>
      <WarnBox>אפשר לבטל עד {k.cancelHours} שעות לפני השיעור, ולכן ההרשמה נשארת בינתיים.</WarnBox>
      <div>אפשר לשלוח למאמן בקשה חריגה. אם הבקשה תאושר, ההרשמה תבוטל ותגיע הודעה.</div>
      <Button onClick={send}>שליחת בקשה חריגה למאמן</Button>
      <Button secondary onClick={nav.back}>חזרה בלי לבקש</Button>
    </Screen>
  );
}

function Classes() {
  const nav = useNav();
  const all = useCall("S17", "classes", "list_upcoming_classes");
  const register = async (classID: string) => {
    const r = await call("S17", "classes", "register", { classID });
    if (!r.ok) return nav.toast(r.error!.message);
    all.reload();
    nav.toast(r.data.status === "registered" ? "נרשמת לשיעור" : `השיעור מלא. נכנסת לרשימת ההמתנה, מקום ${r.data.position}`);
  };
  const cancel = async (k: any) => {
    const r = await call("S17", "classes", "cancel_registration", { classID: k.ClassID });
    if (r.error?.code === "CANCEL_TOO_LATE") return nav.go("S17", { lateFor: { ...k, cancelHours: all.data.cancelHours } });
    if (!r.ok) return nav.toast(r.error!.message);
    all.reload(); nav.toast("ההרשמה בוטלה");
  };

  return (
    <Screen eyebrow="שיעורים קבוצתיים" title="שיעורים" noBack>
      <Load state={all}>{(d: any) => <>
        {d.classes.length
          ? <div className="list">
            {d.classes.map((k: any) => {
              const free = k.capacity - k.registered.length;
              const cancelled = k.status === "cancelled";
              const badge = cancelled ? <Badge tone="warn">בוטל</Badge>
                : k.myStatus === "registered" ? <Badge tone="ok">רשום</Badge>
                : k.myStatus === "waitlist" ? <Badge tone="warn">בהמתנה, מקום {k.myWaitPosition}</Badge>
                : k.myStatus === "offered" ? <Badge tone="ok">התפנה לך מקום</Badge> : null;
              return (
                <div className="card col" key={k.ClassID}>
                  <div className="row">
                    <When at={k.startsAt} />
                    <div className="grow"><div className="t">{k.place}</div><div className="muted small">{cancelled ? "" : free > 0 ? `${free} מקומות פנויים` : "השיעור מלא"}</div></div>
                    {badge}
                  </div>
                  {cancelled ? <div className="muted small">השיעור בוטל בידי המאמן.</div>
                    : k.myStatus === "registered" ? <Button secondary small onClick={() => cancel(k)}>ביטול הרשמה</Button>
                    : k.myStatus === "offered" ? <div className="muted small">אפשר לאשר את המקום במסך הבית.</div>
                    : k.myStatus === "waitlist" ? null
                    : free > 0 ? <Button small onClick={() => register(k.ClassID)}>הרשמה</Button>
                    : <Button secondary small onClick={() => register(k.ClassID)}>הצטרפות להמתנה</Button>}
                </div>
              );
            })}
          </div>
          : <Empty image={<Art name="empty-classes" />} title="אין שיעורים קרובים" sub="כשהמאמן יפרסם שיעור, הוא יופיע כאן." />}
        <div className="muted small">אפשר לבטל עד {d.cancelHours} שעות לפני השיעור. אחרי זה אפשר לשלוח למאמן בקשה חריגה.</div>
      </>}</Load>
    </Screen>
  );
}
