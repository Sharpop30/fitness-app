// S13 trainee home (UC9, story 25): the daily reminder, the streak, notifications and a freed-up class spot.
// Design stage: the greeting by the hour (finding 31), a hero with the streak and coins, the next workout and class as
// FORM rows with section heads, a completed challenge as "done" (31), marking read checks the reply (3), neutral
// wording (37), loading and an error with a retry (2, 6). The notifications do not hold the screen back.
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Badge, Button, Empty, Hero, HeroStat, Item, LinkButton, Load, Notice, Row, Screen, SectionHead, TintRow, When, fmtDay, fmtNum, fmtTime, greeting } from "../design/components";
import { useNav } from "../nav";

export default function S13TraineeHome() {
  const nav = useNav();
  const home = useCall("S13", "home", "get_trainee_home");
  const notes = useCall("S13", "notifications", "list_notifications");

  const answer = async (classID: string, accept: boolean) => {
    const r = await call("S13", "classes", "respond_to_spot_offer", { classID, accept });
    if (!r.ok) return nav.toast(r.error!.message);
    home.reload(); nav.toast(accept ? "נרשמת לשיעור" : "המקום הוצע לבא בתור");
  };
  const read = async (notificationID: string) => {
    const r = await call("S13", "notifications", "mark_read", { notificationID });
    if (!r.ok) return nav.toast(r.error!.message);
    notes.reload();
  };

  return (
    // Map v13 (design-stage gap 7): "ערב טוב, נועה" as the prototype, the name without its "(...)" mark; no name yet, "הבית שלי".
    <Screen eyebrow={home.data?.reminder ?? greeting()} title={home.data?.traineeName ? `${greeting()}, ${home.data.traineeName.replace(/\s*\(.*\)/, "")}` : "הבית שלי"} noBack>
      <Load state={home}>{(h: any) => {
        const c = h.challenge;
        const cText = !c ? "אין אתגר השבוע" : c.exempt ? "פטור השבוע" : c.value >= c.target ? "השלמת ✓" : `${c.value}/${c.target}`;
        return <>
          <Hero row>
            <div><div className="lead">רצף של {h.streak} אימונים</div><div className="sub">לא מתאפס עד {h.streakGapDays} ימים בין אימונים</div></div>
            <HeroStat value={fmtNum(h.coins)} label="מטבעות" />
          </Hero>
          {h.offers.map((o: any) => (
            <div className="notice col" key={o.ClassID}>
              <b>התפנה מקום!</b>
              <div>בשיעור ב{fmtDay(o.startsAt)} בשעה {fmtTime(o.startsAt)}. המקום שמור לך {o.hours} שעות.</div>
              <div className="row"><Button small onClick={() => answer(o.ClassID, true)}>כן, להירשם</Button><Button small secondary onClick={() => answer(o.ClassID, false)}>לא הפעם</Button></div>
            </div>
          ))}
          {notes.data?.map((n: any) => (
            <Notice key={n.NotificationID}><div className="row between small"><span>🔔 {n.messageText}</span><LinkButton onClick={() => read(n.NotificationID)}>סימון כנקרא</LinkButton></div></Notice>
          ))}
          <SectionHead title="האימון הבא" action={h.nextWorkout ? <LinkButton onClick={() => nav.setTab("S14")}>לכל האימונים</LinkButton> : undefined} />
          {h.nextWorkout
            ? <Row title={h.nextWorkout.workoutName} sub={h.nextWorkout.exercises?.length ? h.nextWorkout.exercises.join(" · ") : "ממולא לפי היעד, משנים רק מה ששונה"} onClick={() => nav.go("S14", { workoutID: h.nextWorkout.WorkoutID })} />
            : <Empty title="התוכנית שלך בהכנה אצל המאמן" sub="היא תופיע כאן כשתהיה מוכנה." />}
          <SectionHead title="השיעור הבא" action={<LinkButton onClick={() => nav.setTab("S17")}>לכל השיעורים</LinkButton>} />
          {h.nextClass
            ? <Item><When at={h.nextClass.startsAt} /><div className="grow"><div className="t">{h.nextClass.place}</div></div><Badge tone="ok">רשום</Badge></Item>
            : <Empty title="לא נרשמת לשיעור" />}
          <TintRow onClick={() => nav.go("S20")}>
            <span className="grow"><b>האתגר השבועי:</b> {c ? c.challengeName : "אין אתגר השבוע"}</span>
            {c && !c.exempt ? <Badge tone="ok">{cText}</Badge> : c ? <span className="muted small">{cText}</span> : null}
          </TintRow>
        </>;
      }}</Load>
    </Screen>
  );
}
