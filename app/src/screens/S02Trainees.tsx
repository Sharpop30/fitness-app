// S02 trainees and invite (UC4 steps 1-6, story 19): the list, and inviting by link or email.
import { useState } from "react";
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Badge, Button, Field, Item, Screen } from "../design/components";
import { useNav } from "../nav";

export default function S02Trainees({ invite }: { invite?: boolean }) {
  const nav = useNav();
  const { data } = useCall("S02", "trainees", "list_trainees");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  if (invite) {
    const send = async (channel: "email" | "link") => {
      const r = await call("S02", "trainees", "invite_trainee", { name, email, channel });
      if (!r.ok) return nav.toast(r.error!.message);
      nav.back();
      nav.toast(channel === "email" ? "ההזמנה נשלחה במייל" : "הקישור הועתק. אפשר לשתף אותו בוואטסאפ");
    };
    return (
      <Screen eyebrow="מתאמן חדש" title="הזמנת מתאמן">
        <Field label="שם המתאמן"><input id="inviteName" value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: דנה" /></Field>
        <Field label="מייל (לשליחת ההזמנה)"><input id="inviteEmail" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></Field>
        <Button onClick={() => send("email")}>שליחת הזמנה במייל</Button>
        <Button secondary onClick={() => send("link")}>העתקת קישור לשיתוף (למשל בוואטסאפ)</Button>
        <div className="muted small">ההזמנה בתוקף לזמן מוגבל, לפי ההגדרות.</div>
      </Screen>
    );
  }

  return (
    <Screen eyebrow="המתאמנים שלי" title="מתאמנים" noBack>
      <div className="list">
        {data?.map((t: any) => t.joined
          ? <Item key={t.TraineeID} onClick={() => nav.go("S03", { traineeID: t.TraineeID })}><span>{t.fullName}</span><span className="muted small">{t.hasProgram ? "יש תוכנית" : "אין תוכנית"}</span></Item>
          : <Item key={t.TraineeID ?? t.InviteID}><span>{t.fullName}</span><Badge tone="warn">הוזמן, טרם הצטרף</Badge></Item>)}
      </div>
      <Button onClick={() => nav.go("S02", { invite: true })}>הזמנת מתאמן</Button>
    </Screen>
  );
}
