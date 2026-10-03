// S22 joining by invitation (UC4 steps 4-5, story 19). With the identity service configured (stage 5 plan, task 7):
// the invite token comes from the link (SITE_URL?join=token). Opened from the invite email, the newcomer is already
// signed in and sets a password; opened from a shared link, they sign up. Then trainees.accept_invite. The error texts
// load before joining, so a failed join reads as it should (module map v10). On demo data, the demo join stays.
// Stage 4e (map v11; usecase-12 steps 6, 7): a coach invite link (SITE_URL?coach=token) joins the same way, as a coach of
// the business, through business.accept_coach_invite. The same structure; the line for a coach is stage 4e plan, decision 9.
// Map v13 (usecase-04 v4 step 4, usecase-12 v3 step 6; prototype 3.2): the invite is checked when the screen opens, before
// signing up, so a link that expired shows its message instead of the form and leaves no identity user; the name is filled.
import { useEffect, useState } from "react";
import { call, setErrorTexts } from "../api/client";
import { Art, Button, ErrorState, Field, LinkButton, Loading, Notice, Screen } from "../design/components";
import { accessToken, identityConfigured, PASSWORD_RULE, passwordOK, setPassword, signInWithPassword, signUp, takeSessionFromAddress } from "../identity/auth";
import { useNav } from "../nav";

export default function S22JoinInvite({ inviteToken, coachToken }: { inviteToken?: string; coachToken?: string }) {
  const nav = useNav();
  const live = identityConfigured();
  const asCoach = coachToken !== undefined;
  const [fromEmail, setFromEmail] = useState(false);
  const [name, setName] = useState(live ? "" : asCoach ? "שירה (דוגמה)" : "רון (דוגמה)");
  const [email, setEmail] = useState(live ? "" : "ron@example.com");
  const [password, setPass] = useState("");
  // The invite as checked on opening: "checking", "open", or the error (expired, or no answer with a retry).
  const [check, setCheck] = useState<{ state: "checking" | "open" } | { state: "error"; error: { code: string; message: string } }>(
    { state: live ? "checking" : "open" });

  useEffect(() => { if (live && takeSessionFromAddress()) setFromEmail(true); }, [live]);

  const checkInvite = async (payload: Record<string, unknown> = {}) => {
    setCheck({ state: "checking" });
    const texts = await call("S22", "settings", "get_error_texts");
    if (texts.ok) setErrorTexts(texts.data);
    const r = asCoach
      ? await call("S22", "business", "check_coach_invite", { token: coachToken, ...payload })
      : await call("S22", "trainees", "check_invite", { token: inviteToken ?? "", ...payload });
    if (!r.ok) return setCheck({ state: "error", error: r.error! });
    if (live && r.data.fullName) setName(r.data.fullName);
    setCheck({ state: "open" });
  };
  useEffect(() => { if (live) checkInvite(); }, [live]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // The password policy, said before anything is sent (stage 7 plan, task 12): no identity user for a password refused.
    if (!passwordOK(password)) return nav.toast(`הסיסמה צריכה להיות ${PASSWORD_RULE}`);
    // Signed in already (from the email, or a try that failed after signing up): only the password. Otherwise sign up;
    // an address already signed up earlier signs in with its password instead.
    const outcome = fromEmail || accessToken() ? await setPassword(password)
      : await signUp(email.trim(), password).then((o) => (o === "wrong" ? signInWithPassword(email.trim(), password) : o));
    if (outcome !== "ok") return nav.toast(outcome === "wrong" ? "המייל או הסיסמה לא נכונים" : outcome === "weak" ? `הסיסמה צריכה להיות ${PASSWORD_RULE}` : "משהו השתבש. אפשר לנסות שוב");
    const texts = await call("S22", "settings", "get_error_texts");
    if (texts.ok) setErrorTexts(texts.data);
    const r = await accept({ fullName: name });
    if (!r.ok) return nav.toast(r.error!.message);
    history.replaceState(null, "", window.location.pathname); // the invite is used; a reload opens the sign-in
    joined(r.data);
  };

  if (check.state === "checking") return <Screen eyebrow="הזמנה" title="הצטרפות"><Loading /></Screen>;
  if (check.state === "error") {
    return check.error.code === "INVITE_EXPIRED"
      ? <Screen eyebrow="הזמנה" title="הצטרפות">
          <Art name="join-coach" />
          <Notice>{check.error.message}</Notice>
          <div className="muted small">הקישור תקף לזמן מוגבל, ופעם אחת. מי ששלח אותו יכול לשלוח קישור חדש.</div>
        </Screen>
      : <Screen eyebrow="הזמנה" title="הצטרפות"><ErrorState error={check.error} onRetry={() => checkInvite()} /></Screen>;
  }

  return (
    <Screen eyebrow={asCoach ? "הזמנה מבעל העסק" : "הזמנה מהמאמן"} title="הצטרפות">
      <Art name="join-coach" />
      <Notice>{asCoach ? "בעל העסק הזמין אותך להצטרף כמאמן. ההזמנה הגיעה בקישור או במייל." : "המאמן שלך הזמין אותך להצטרף. ההזמנה הגיעה בקישור או במייל."}</Notice>
      <Field label="שם"><input id="joinName" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      {!fromEmail && <Field label="מייל"><input id="joinEmail" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>}
      {live
        ? <><Field label="סיסמה"><input id="joinPassword" type="password" autoComplete="new-password" value={password} onChange={(e) => setPass(e.target.value)} /></Field>
          <div className="muted small">{PASSWORD_RULE}</div></>
        : <Field label="סיסמה"><input id="joinPassword" type="password" defaultValue="" placeholder="בגרסת הדוגמה אין צורך בסיסמה" /></Field>}
      <Button onClick={() => (live ? liveJoin() : demoJoin())}>הצטרפות</Button>
      {!live && <LinkButton onClick={() => checkInvite({ expired: true })}>מה רואים כשההזמנה פגה?</LinkButton>}
    </Screen>
  );
}
