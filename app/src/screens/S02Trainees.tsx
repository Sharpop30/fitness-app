// S02 trainees and invite (UC4 steps 1-6, story 19): the list, and inviting by link or email.
// Design stage: the invite link is shown on the screen, with the phone's share and a copy that says "copied" only when
// it was (finding 5; the link is the invite channel until an email provider is chosen). Loading and error (2, 6).
import { useState } from "react";
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Avatar, Badge, Button, Empty, Field, LinkBox, Load, Name, Notice, Row, Screen } from "../design/components";
import { useNav } from "../nav";

export default function S02Trainees({ invite }: { invite?: boolean }) {
  if (invite) return <Invite />;
  return <Trainees />;
}

function Trainees() {
  const nav = useNav();
  const list = useCall("S02", "trainees", "list_trainees");
  return (
    <Screen eyebrow="המתאמנים שלי" title="מתאמנים" noBack>
      <Load state={list}>{(data: any[]) => data.length
        ? <div className="list">
          {data.map((t: any) => t.joined
            ? <Row key={t.TraineeID} lead={<Avatar name={t.fullName} />} title={<Name>{t.fullName}</Name>} sub={t.hasProgram ? "יש תוכנית" : "אין תוכנית"} onClick={() => nav.go("S03", { traineeID: t.TraineeID, name: t.fullName })} />
            : <Row key={t.TraineeID ?? t.InviteID} lead={<Avatar name={t.fullName} />} title={<Name>{t.fullName}</Name>} sub="ההזמנה נשלחה" end={<Badge tone="warn">הוזמן, טרם הצטרף</Badge>} />)}
        </div>
        : <Empty title="עוד אין מתאמנים" sub="מתאמן מצטרף מקישור הזמנה ששולחים לו." />}
      </Load>
      <Button onClick={() => nav.go("S02", { invite: true })}>הזמנת מתאמן</Button>
    </Screen>
  );
}

function Invite() {
  const nav = useNav();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<{ name: string; link: string } | null>(null);

  const send = async (channel: "email" | "link") => {
    const r = await call("S02", "trainees", "invite_trainee", { name, email, channel });
    if (!r.ok) return nav.toast(r.error!.message);
    if (channel === "email") { nav.back(); return nav.toast("ההזמנה נשלחה במייל"); }
    setSent({ name, link: r.data.link }); // I03, the link channel: shown here, to share or copy
  };
  if (sent) {
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(sent.link);
        nav.toast("הקישור הועתק");
      } catch {
        nav.toast("ההעתקה לא הצליחה. אפשר לסמן את הקישור ולהעתיק ידנית");
      }
    };
    const canShare = typeof navigator.share === "function";
    const share = () => navigator.share({ title: "הזמנה לאפליקציית האימונים", url: sent.link }).catch(() => undefined);
    return (
      <Screen eyebrow="הזמנת מתאמן" title={<Name>{sent.name}</Name>}>
        <Notice>הקישור מוכן. אפשר לשלוח אותו בוואטסאפ או בכל דרך אחרת.</Notice>
        <LinkBox>{sent.link}</LinkBox>
        {canShare
          ? <div className="grid2"><Button onClick={share}>שיתוף</Button><Button secondary onClick={copy}>העתקה</Button></div>
          : <Button onClick={copy}>העתקת הקישור</Button>}
        <div className="muted small">ההזמנה בתוקף לזמן מוגבל, לפי ההגדרות.</div>
        <Button secondary onClick={nav.back}>חזרה לרשימה</Button>
      </Screen>
    );
  }
  return (
    <Screen eyebrow="מתאמן חדש" title="הזמנת מתאמן">
      <Field label="שם המתאמן"><input id="inviteName" value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: דנה" autoComplete="off" /></Field>
      <Field label="מייל (לשליחת ההזמנה)"><input id="inviteEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></Field>
      <Button onClick={() => send("email")}>שליחת הזמנה במייל</Button>
      <Button secondary onClick={() => send("link")}>יצירת קישור לשיתוף (למשל בוואטסאפ)</Button>
      <div className="muted small">ההזמנה בתוקף לזמן מוגבל, לפי ההגדרות.</div>
    </Screen>
  );
}
