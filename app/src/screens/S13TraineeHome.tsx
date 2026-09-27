// S13 trainee home (UC9, story 25): the daily reminder, the streak, notifications and a freed-up class spot.
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Button, Item, Notice, Screen, fmtDate, fmtTime } from "../design/components";
import { useNav } from "../nav";

export default function S13TraineeHome() {
  const nav = useNav();
  const home = useCall("S13", "home", "get_trainee_home");
  const notes = useCall("S13", "notifications", "list_notifications");
  const h = home.data;

  const answer = async (classID: string, accept: boolean) => {
    const r = await call("S13", "classes", "respond_to_spot_offer", { classID, accept });
    if (!r.ok) return nav.toast(r.error!.message);
    home.reload(); nav.toast(accept ? "נרשמת לשיעור" : "המקום הוצע לבא בתור");
  };
  const read = async (notificationID: string) => { await call("S13", "notifications", "mark_read", { notificationID }); notes.reload(); };

  return (
    <Screen eyebrow={h?.reminder ?? ""} title="הבית שלי" noBack>
      {h && <>
        <div className="hero row between">
          <div><div className="sub">רצף אימונים</div><div className="big">{h.streak} 🔥</div><div className="sub">לא מתאפס עד {h.streakGapDays} ימים בין אימונים</div></div>
          <div><div className="sub">מטבעות</div><div className="big">{h.coins}</div></div>
        </div>
        {h.offers.map((o: any) => (
          <div className="notice col" key={o.ClassID}>
            <b>התפנה מקום!</b>
            <div>בשיעור ב-{fmtDate(o.startsAt)} בשעה {fmtTime(o.startsAt)}. המקום שמור לך {o.hours} שעות.</div>
            <div className="row"><Button small onClick={() => answer(o.ClassID, true)}>אני מגיע</Button><Button small secondary onClick={() => answer(o.ClassID, false)}>לא הפעם</Button></div>
          </div>
        ))}
        {notes.data?.map((n: any) => (
          <Notice key={n.NotificationID}><div className="row between small"><span>🔔 {n.messageText}</span><button className="link" onClick={() => read(n.NotificationID)}>סימון כנקרא</button></div></Notice>
        ))}
        <div className="list">
          <Item onClick={() => h.nextWorkout ? nav.go("S14", { workoutID: h.nextWorkout.WorkoutID }) : undefined}>
            <div><div className="muted small">האימון הבא</div><div>{h.nextWorkout ? h.nextWorkout.workoutName : "התוכנית שלך בהכנה אצל המאמן"}</div></div><span>›</span></Item>
          <Item onClick={() => nav.setTab("S17")}>
            <div><div className="muted small">השיעור הבא שלך</div><div>{h.nextClass ? `${fmtDate(h.nextClass.startsAt)} · ${fmtTime(h.nextClass.startsAt)} · ${h.nextClass.place}` : "לא נרשמת לשיעור"}</div></div><span>›</span></Item>
          <Item onClick={() => nav.go("S20")}>
            <div><div className="muted small">האתגר השבועי</div><div>{!h.challenge ? "אין אתגר השבוע" : h.challenge.exempt ? "השבוע אתה פטור" : `${h.challenge.challengeName}: ${h.challenge.value}/${h.challenge.target}`}</div></div><span>›</span></Item>
        </div>
      </>}
    </Screen>
  );
}
