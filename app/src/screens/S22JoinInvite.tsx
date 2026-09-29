// S22 joining by invitation (UC4 steps 4-5, story 19). With the identity service configured (stage 5 plan, task 7):
// the invite token comes from the link (SITE_URL?join=token). Opened from the invite email, the newcomer is already
// signed in and sets a password; opened from a shared link, they sign up. Then trainees.accept_invite. The error texts
// load before joining, so a failed join reads as it should (module map v10). On demo data, the demo join stays.
import { useEffect, useState } from "react";
import { call, setErrorTexts } from "../api/client";
import { Button, Field, Notice, Screen } from "../design/components";
import { accessToken, identityConfigured, setPassword, signInWithPassword, signUp, takeSessionFromAddress } from "../identity/auth";
import { useNav } from "../nav";

export default function S22JoinInvite({ inviteToken }: { inviteToken?: string }) {
  const nav = useNav();
  const live = identityConfigured();
  const [fromEmail, setFromEmail] = useState(false);
  const [name, setName] = useState(live ? "" : "רון (דוגמה)");
  const [email, setEmail] = useState(live ? "" : "ron@example.com");
  const [password, setPass] = useState("");

  useEffect(() => { if (live && takeSessionFromAddress()) setFromEmail(true); }, [live]);

  const demoJoin = async (expired = false) => {
    const r = await call("S22", "trainees", "accept_invite", { traineeID: "d0000000-0000-4000-8000-000000001004", expired });
    if (!r.ok) return nav.toast(r.error!.message);
    nav.signIn("trainee", r.data.TraineeID);
    nav.toast("הצטרפת! המאמן יבנה לך תוכנית");
  };

  const liveJoin = async () => {
    // Signed in already (from the email, or a try that failed after signing up): only the password. Otherwise sign up;
    // an address already signed up earlier signs in with its password instead.
    const outcome = fromEmail || accessToken() ? await setPassword(password)
      : await signUp(email.trim(), password).then((o) => (o === "wrong" ? signInWithPassword(email.trim(), password) : o));
    if (outcome !== "ok") return nav.toast(outcome === "wrong" ? "המייל או הסיסמה לא נכונים" : "משהו השתבש. נסה שוב");
    const texts = await call("S22", "settings", "get_error_texts");
    if (texts.ok) setErrorTexts(texts.data);
    const r = await call("S22", "trainees", "accept_invite", { token: inviteToken ?? "", fullName: name });
    if (!r.ok) return nav.toast(r.error!.message);
    history.replaceState(null, "", window.location.pathname); // the invite is used; a reload opens the sign-in
    nav.signIn("trainee", r.data.TraineeID);
    nav.toast("הצטרפת! המאמן יבנה לך תוכנית");
  };

  return (
    <Screen eyebrow="הזמנה מהמאמן" title="הצטרפות">
      <Notice>המאמן שלך הזמין אותך להצטרף. ההזמנה הגיעה בקישור או במייל.</Notice>
      <Field label="שם"><input id="joinName" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      {!fromEmail && <Field label="מייל"><input id="joinEmail" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>}
      {live
        ? <Field label="סיסמה"><input id="joinPassword" type="password" autoComplete="new-password" value={password} onChange={(e) => setPass(e.target.value)} /></Field>
        : <Field label="סיסמה"><input id="joinPassword" type="password" defaultValue="" placeholder="בגרסת הדוגמה אין צורך בסיסמה" /></Field>}
      <Button onClick={() => (live ? liveJoin() : demoJoin())}>הצטרפות</Button>
      {!live && <button className="link" onClick={() => demoJoin(true)}>מה רואים כשההזמנה פגה?</button>}
    </Screen>
  );
}
