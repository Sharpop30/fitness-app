// S22 joining by invitation (UC4 steps 4-5, story 19). With the identity service configured (stage 5 plan, task 7):
// the invite token comes from the link (SITE_URL?join=token). Opened from the invite email, the newcomer is already
// signed in and sets a password; opened from a shared link, they sign up. Then trainees.accept_invite. The error texts
// load before joining, so a failed join reads as it should (module map v10). On demo data, the demo join stays.
// Stage 4e (map v11; usecase-12 steps 6, 7): a coach invite link (SITE_URL?coach=token) joins the same way, as a coach of
// the business, through business.accept_coach_invite. The same structure; the line for a coach is stage 4e plan, decision 9.
import { useEffect, useState } from "react";
import { call, setErrorTexts } from "../api/client";
import { Button, Field, LinkButton, Notice, Picture, Screen } from "../design/components";
import { accessToken, identityConfigured, setPassword, signInWithPassword, signUp, takeSessionFromAddress } from "../identity/auth";
import { useNav } from "../nav";

export default function S22JoinInvite({ inviteToken, coachToken }: { inviteToken?: string; coachToken?: string }) {
  const nav = useNav();
  const live = identityConfigured();
  const asCoach = coachToken !== undefined;
  const [fromEmail, setFromEmail] = useState(false);
  const [name, setName] = useState(live ? "" : asCoach ? "שירה (דוגמה)" : "רון (דוגמה)");
  const [email, setEmail] = useState(live ? "" : "ron@example.com");
  const [password, setPass] = useState("");

  useEffect(() => { if (live && takeSessionFromAddress()) setFromEmail(true); }, [live]);

  const joined = (data: { TraineeID?: string }) => {
    if (asCoach) { nav.signIn("coach", undefined, ["coach"]); return nav.toast("הצטרפת לעסק כמאמן"); }
    nav.signIn("trainee", data.TraineeID);
    nav.toast("הצטרפת! המאמן יבנה לך תוכנית");
  };
  const accept = (payload: Record<string, unknown>) => asCoach
    ? call("S22", "business", "accept_coach_invite", { token: coachToken, ...payload })
    : call("S22", "trainees", "accept_invite", { token: inviteToken ?? "", ...payload });

  const demoJoin = async (expired = false) => {
    const r = asCoach ? await accept({ expired }) : await call("S22", "trainees", "accept_invite", { traineeID: "d0000000-0000-4000-8000-000000001004", expired });
    if (!r.ok) return nav.toast(r.error!.message);
    joined(r.data);
  };

  const liveJoin = async () => {
    // Signed in already (from the email, or a try that failed after signing up): only the password. Otherwise sign up;
    // an address already signed up earlier signs in with its password instead.
    const outcome = fromEmail || accessToken() ? await setPassword(password)
      : await signUp(email.trim(), password).then((o) => (o === "wrong" ? signInWithPassword(email.trim(), password) : o));
    if (outcome !== "ok") return nav.toast(outcome === "wrong" ? "המייל או הסיסמה לא נכונים" : "משהו השתבש. אפשר לנסות שוב");
    const texts = await call("S22", "settings", "get_error_texts");
    if (texts.ok) setErrorTexts(texts.data);
    const r = await accept({ fullName: name });
    if (!r.ok) return nav.toast(r.error!.message);
    history.replaceState(null, "", window.location.pathname); // the invite is used; a reload opens the sign-in
    joined(r.data);
  };

  return (
    <Screen eyebrow={asCoach ? "הזמנה מבעל העסק" : "הזמנה מהמאמן"} title="הצטרפות">
      <Picture size="short" src={`${import.meta.env.BASE_URL}images/join.jpg`} />
      <Notice>{asCoach ? "בעל העסק הזמין אותך להצטרף כמאמן. ההזמנה הגיעה בקישור או במייל." : "המאמן שלך הזמין אותך להצטרף. ההזמנה הגיעה בקישור או במייל."}</Notice>
      <Field label="שם"><input id="joinName" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      {!fromEmail && <Field label="מייל"><input id="joinEmail" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>}
      {live
        ? <Field label="סיסמה"><input id="joinPassword" type="password" autoComplete="new-password" value={password} onChange={(e) => setPass(e.target.value)} /></Field>
        : <Field label="סיסמה"><input id="joinPassword" type="password" defaultValue="" placeholder="בגרסת הדוגמה אין צורך בסיסמה" /></Field>}
      <Button onClick={() => (live ? liveJoin() : demoJoin())}>הצטרפות</Button>
      {!live && <LinkButton onClick={() => demoJoin(true)}>מה רואים כשההזמנה פגה?</LinkButton>}
    </Screen>
  );
}
