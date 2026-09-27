// S22 joining by invitation (UC4 steps 4-5, story 19). Sign-up is mocked here; the real one is Supabase Auth (stage 5).
import { useState } from "react";
import { call } from "../api/client";
import { Button, Field, Notice, Screen } from "../design/components";
import { useNav } from "../nav";

export default function S22JoinInvite() {
  const nav = useNav();
  const [name, setName] = useState("רון (דוגמה)");
  const [email, setEmail] = useState("ron@example.com");
  const join = async (expired = false) => {
    const r = await call("S22", "trainees", "accept_invite", { traineeID: "d0000000-0000-4000-8000-000000001004", expired });
    if (!r.ok) return nav.toast(r.error!.message);
    nav.signIn("trainee", r.data.TraineeID);
    nav.toast("הצטרפת! המאמן יבנה לך תוכנית");
  };
  return (
    <Screen eyebrow="הזמנה מהמאמן" title="הצטרפות">
      <Notice>המאמן שלך הזמין אותך להצטרף. ההזמנה הגיעה בקישור או במייל.</Notice>
      <Field label="שם"><input id="joinName" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="מייל"><input id="joinEmail" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="סיסמה"><input id="joinPassword" type="password" defaultValue="" placeholder="בגרסת הדוגמה אין צורך בסיסמה" /></Field>
      <Button onClick={() => join()}>הצטרפות</Button>
      <button className="link" onClick={() => join(true)}>מה רואים כשההזמנה פגה?</button>
    </Screen>
  );
}
