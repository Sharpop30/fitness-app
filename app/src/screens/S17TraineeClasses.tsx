// S17 classes, trainee (UC11, story 30): register, waitlist, cancel up to the window, and a late-cancel request.
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Button, Screen, WarnBox, fmtDate, fmtTime } from "../design/components";
import { useNav } from "../nav";

export default function S17TraineeClasses({ lateFor }: { lateFor?: any }) {
  const nav = useNav();
  const all = useCall("S17", "classes", "list_upcoming_classes");

  if (lateFor) {
    const send = async () => {
      await call("S17", "classes", "request_late_cancel", { classID: lateFor.ClassID });
      nav.back(); nav.toast("הבקשה נשלחה למאמן");
    };
    return (
      <Screen eyebrow="ביטול מאוחר" title={`${fmtDate(lateFor.startsAt)} · ${fmtTime(lateFor.startsAt)}`}>
        <WarnBox>אפשר לבטל עד {lateFor.cancelHours} שעות לפני השיעור, ולכן ההרשמה נשארת בינתיים.</WarnBox>
        <div>אפשר לשלוח למאמן בקשה חריגה. אם הוא יאשר, ההרשמה תבוטל ותקבל הודעה.</div>
        <Button onClick={send}>שליחת בקשה חריגה למאמן</Button>
        <Button secondary onClick={nav.back}>חזרה בלי לבקש</Button>
      </Screen>
    );
  }

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
      <div className="list">
        {all.data?.classes.map((k: any) => {
          const free = k.capacity - k.registered.length;
          return (
            <div className="card col" key={k.ClassID}>
              <div className="row between"><b>{fmtDate(k.startsAt)} · {fmtTime(k.startsAt)}</b><span className="muted small">{k.place}</span></div>
              {k.status === "cancelled" ? <WarnBox><span className="small">השיעור בוטל בידי המאמן</span></WarnBox>
                : k.myStatus === "registered" ? <div className="row between"><span className="badge ok">רשום</span><Button secondary small onClick={() => cancel(k)}>ביטול הרשמה</Button></div>
                : k.myStatus === "waitlist" ? <span className="badge warn">ברשימת המתנה, מקום {k.myWaitPosition}</span>
                : k.myStatus === "offered" ? <span className="badge ok">התפנה לך מקום. אשר במסך הבית</span>
                : free > 0 ? <div className="row between"><span className="muted small">{free} מקומות פנויים</span><Button small onClick={() => register(k.ClassID)}>הרשמה</Button></div>
                : <div className="row between"><span className="muted small">השיעור מלא</span><Button secondary small onClick={() => register(k.ClassID)}>הצטרפות להמתנה</Button></div>}
            </div>
          );
        })}
      </div>
      {all.data && <div className="muted small">אפשר לבטל עד {all.data.cancelHours} שעות לפני השיעור. אחרי זה אפשר לשלוח למאמן בקשה חריגה.</div>}
    </Screen>
  );
}
