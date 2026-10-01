// S25 the coaches of the business and inviting a coach (usecase-12 steps 3-5 and e, story 15; prototype version 3).
// The invite is as on S02 (stage 4e plan, decision 10): by email, or a link shown here to share or copy, since invites
// go by link until an email provider is chosen. Loading and an error with a retry.
import { useState } from "react";
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Avatar, Badge, Button, Field, LinkBox, Load, Name, Notice, Row, Screen } from "../design/components";
import { useNav } from "../nav";

export default function S25Coaches({ invite }: { invite?: boolean }) {
  if (invite) return <Invite />;
  return <Coaches />;
}

function Coaches() {
  const nav = useNav();
  const list = useCall("S25", "business", "list_coaches");
  return (
    <Screen eyebrow="המאמנים בעסק" title="מאמנים" noBack>
      <Load state={list}>{(data: any[]) => <>
        <div className="list">
          {data.map((k: any) => k.joined
            ? <Row key={k.CoachID} lead={<Avatar name={k.fullName} />} title={<Name>{k.fullName}</Name>}
                sub={k.trainees === null ? "" : `${k.trainees} מתאמנים`} onClick={() => nav.go("S27", { coachID: k.CoachID, name: k.fullName })} />
            : <Row key={k.CoachInviteID} lead={<Avatar name={k.fullName} />} title={<Name>{k.fullName}</Name>} sub="ההזמנה נשלחה"
                end={<Badge tone="warn">הוזמן, טרם הצטרף</Badge>} />)}
        </div>
        {data.length < 2 && <div className="muted small">מאמן מצטרף מקישור הזמנה ששולחים לו.</div>}
      </>}</Load>
      <Button onClick={() => nav.go("S25", { invite: true })}>הזמנת מאמן</Button>
    </Screen>
  );
}

function Invite() {
  const nav = useNav();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<{ name: string; link: string } | null>(null);

  const send = async (channel: "email" | "link") => {
    const r = await call("S25", "business", "invite_coach", { name, email, channel });
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
      <Screen eyebrow="הזמנת מאמן" title={<Name>{sent.name}</Name>}>
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
    <Screen eyebrow="מאמן חדש" title="הזמנת מאמן">
      <Field label="שם המאמן"><input id="coachInviteName" value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: אורי" autoComplete="off" /></Field>
      <Field label="מייל (לשליחת ההזמנה)"><input id="coachInviteEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></Field>
      <Button onClick={() => send("email")}>שליחת הזמנה במייל</Button>
      <Button secondary onClick={() => send("link")}>יצירת קישור לשיתוף (למשל בוואטסאפ)</Button>
      <div className="muted small">ההזמנה בתוקף לזמן מוגבל, לפי ההגדרות.</div>
    </Screen>
  );
}
