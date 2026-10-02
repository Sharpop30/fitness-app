// S23 sign-in. With the identity service configured: one sign-in by email and password for the coach and the trainee;
// the Endpoint says who signed in (trainees.get_me), and the error texts load once (module map v9; stage 5 plan,
// decisions 1, 6, 9). A sign-in kept from the last visit opens straight away. On demo data, the role choice stays.
// Stage 4e (map v11; prototype version 3): someone with two roles, an owner who is also a coach, chooses one here, and
// moves between them later from "more" (rule 10).
import { useEffect, useRef, useState } from "react";
import { call, setErrorTexts } from "../api/client";
import { Button, Chevron, Field, Item, LinkButton, Picture, Screen } from "../design/components";
import { identityConfigured, isRecoveryReturn, PASSWORD_RULE, passwordOK, requestPasswordReset, restoreSession, setPassword as setIdentityPassword, signInWithPassword, signOutIdentity, takeSessionFromAddress } from "../identity/auth";
import { useNav, type SignedRole } from "../nav";

const DEMO_NOA = "d0000000-0000-4000-8000-000000001001";

// Stage 7 plan, task 14 (design review, finding 24; prototype 3.2): "forgot" asks for the email, and the link in the
// email returns to "a new password", both as states of S23, through the identity service only (I01; map v13).
export default function S23SignIn({ forgot }: { forgot?: boolean }) {
  const live = identityConfigured();
  if (forgot) return <ForgotPassword />;
  return <SignIn live={live} />;
}

function ForgotPassword() {
  const nav = useNav();
  const [email, setEmail] = useState("");
  const send = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return nav.toast("פרט הקשר לא תקין. כדאי לבדוק ולנסות שוב");
    if ((await requestPasswordReset(email.trim())) !== "ok") return nav.toast("משהו השתבש. אפשר לנסות שוב");
    nav.back(); nav.toast("אם המייל רשום, נשלח אליו קישור");
  };
  return (
    <Screen eyebrow="כניסה" title="שחזור סיסמה">
      <Field label="מייל"><input id="forgotEmail" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></Field>
      <Button onClick={send}>שליחת קישור לסיסמה חדשה</Button>
      <div className="muted small">אם המייל רשום באפליקציה, יגיע אליו קישור. הקישור תקף לזמן קצר.</div>
    </Screen>
  );
}

function SignIn({ live }: { live: boolean }) {
  const nav = useNav();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [choice, setChoice] = useState<SignedRole[] | null>(null); // two roles: which one now

  const loadTexts = async () => {
    const r = await call("S23", "settings", "get_error_texts"); // once, after sign-in
    if (r.ok) setErrorTexts(r.data);
  };
  const enter = async (role: SignedRole, traineeID?: string, roles?: SignedRole[]) => {
    nav.signIn(role, traineeID, roles);
    await loadTexts();
  };
  // Who signed in, from the Endpoint. Someone signed up but not joined is not a coach or a trainee: signed out again.
  // On opening the site this is silent: a kept sign-in that no longer works just leaves the form.
  const enterLive = async (silent = false) => {
    const me = await call<{ roles: SignedRole[]; role: SignedRole; traineeID: string | null }>("S23", "trainees", "get_me");
    if (!me.ok) { signOutIdentity(); return silent ? undefined : nav.toast(me.error!.message); }
    const roles = me.data!.roles?.length ? me.data!.roles : [me.data!.role];
    if (roles.length > 1) return setChoice(roles);
    await enter(roles[0], me.data!.traineeID ?? undefined, roles);
  };

  // Once per screen: in development React runs an effect twice (StrictMode), and two restores at once raced, so one that
  // failed signed the other out (found closing stage 4e, in the cloud).
  const restored = useRef(false);
  // Back from the reset link: signed in for this, the new password comes first (task 14).
  const [recovering, setRecovering] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (live && isRecoveryReturn() && takeSessionFromAddress()) return setRecovering(true);
    if (live) void restoreSession().then((o) => { if (o === "ok") void enterLive(true); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveNewPassword = async () => {
    if (!passwordOK(newPassword)) return nav.toast(`הסיסמה צריכה להיות ${PASSWORD_RULE}`);
    const outcome = await setIdentityPassword(newPassword);
    if (outcome === "weak") return nav.toast(`הסיסמה צריכה להיות ${PASSWORD_RULE}`);
    if (outcome !== "ok") return nav.toast("משהו השתבש. אפשר לנסות שוב");
    setRecovering(false); nav.toast("הסיסמה נשמרה");
    await enterLive();
  };

  const signIn = async () => {
    const outcome = await signInWithPassword(email.trim(), password);
    if (outcome === "ok") return enterLive();
    nav.toast(outcome === "wrong" ? "המייל או הסיסמה לא נכונים" : "משהו השתבש. אפשר לנסות שוב");
  };

  if (recovering) {
    return (
      <Screen eyebrow="כניסה" title="סיסמה חדשה" noBack>
        <Field label="סיסמה חדשה"><input id="newPassword" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></Field>
        <div className="muted small">{PASSWORD_RULE}</div>
        <Button onClick={saveNewPassword}>שמירה וכניסה</Button>
      </Screen>
    );
  }

  if (choice) {
    return (
      <Screen eyebrow="יש לך שני תפקידים" title="איך להמשיך?" noBack>
        {choice.includes("owner") && <Item onClick={() => enter("owner", undefined, choice)}>
          <div className="grow"><div className="t">בעל העסק</div><div className="s">סקירה, מאמנים, מדדים והגדרות העסק</div></div><Chevron />
        </Item>}
        {choice.includes("coach") && <Item onClick={() => enter("coach", undefined, choice)}>
          <div className="grow"><div className="t">מאמן</div><div className="s">המתאמנים, התוכניות והשיעורים שלך</div></div><Chevron />
        </Item>}
        <div className="muted small">אפשר לעבור בין התפקידים בכל רגע, מ"עוד".</div>
      </Screen>
    );
  }

  return (
    <Screen eyebrow="ביצועים, מעקב ותשלומים" title="כניסה לאפליקציה" noBack>
      <Picture size="tall" src={`${import.meta.env.BASE_URL}images/signin.jpg`} />
      <div className="lead-text">אפליקציה אחת למאמן כושר אישי ולמתאמנים שלו: תוכניות, תשלומים ומעקב במקום אחד.</div>
      {live ? <>
        <Field label="מייל"><input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="סיסמה"><input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Button onClick={signIn}>כניסה</Button>
        <LinkButton onClick={() => nav.go("S23", { forgot: true })}>שכחתי סיסמה</LinkButton>
      </> : <>
        <div className="muted small">בגרסת הדוגמה הכניסה היא בחירת תפקיד, בלי מייל וסיסמה.</div>
        <Button onClick={() => enter("coach")}>כניסה כמאמן (דוגמה)</Button>
        <Button secondary onClick={() => enter("trainee", DEMO_NOA)}>כניסה כמתאמן (דוגמה)</Button>
        <Button secondary onClick={() => setChoice(["owner", "coach"])}>כניסה כבעל העסק, שהוא גם המאמן (דוגמה)</Button>
        <Button secondary onClick={() => nav.go("S22")}>פתיחת הזמנה כמתאמן חדש</Button>
      </>}
    </Screen>
  );
}
