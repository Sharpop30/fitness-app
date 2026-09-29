// S23 sign-in. With the identity service configured: one sign-in by email and password for the coach and the trainee;
// the Endpoint says who signed in (trainees.get_me), and the error texts load once (module map v9; stage 5 plan,
// decisions 1, 6, 9). A sign-in kept from the last visit opens straight away. On demo data, the role choice stays.
import { useEffect, useState } from "react";
import { call, setErrorTexts } from "../api/client";
import { Button, Field, Hero, Screen } from "../design/components";
import { identityConfigured, restoreSession, signInWithPassword, signOutIdentity } from "../identity/auth";
import { useNav } from "../nav";

export default function S23SignIn() {
  const nav = useNav();
  const live = identityConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loadTexts = async () => {
    const r = await call("S23", "settings", "get_error_texts"); // once, after sign-in
    if (r.ok) setErrorTexts(r.data);
  };
  const enter = async (role: "coach" | "trainee", traineeID?: string) => {
    nav.signIn(role, traineeID);
    await loadTexts();
  };
  // Who signed in, from the Endpoint. Someone signed up but not joined is not a coach or a trainee: signed out again.
  const enterLive = async () => {
    const me = await call<{ role: "coach" | "trainee"; traineeID: string | null }>("S23", "trainees", "get_me");
    if (!me.ok) { signOutIdentity(); return nav.toast(me.error!.message); }
    await enter(me.data!.role, me.data!.traineeID ?? undefined);
  };

  useEffect(() => {
    if (live) void restoreSession().then((o) => { if (o === "ok") void enterLive(); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = async () => {
    const outcome = await signInWithPassword(email.trim(), password);
    if (outcome === "ok") return enterLive();
    nav.toast(outcome === "wrong" ? "המייל או הסיסמה לא נכונים" : "משהו השתבש. נסה שוב");
  };

  return (
    <Screen eyebrow="כניסה" title="כניסה לאפליקציה" noBack>
      <Hero><div className="sub">אפליקציה אחת למאמן כושר אישי ולמתאמנים שלו</div><div className="big" style={{ marginTop: 6 }}>תוכניות, תשלומים ומעקב במקום אחד</div></Hero>
      {live ? <>
        <Field label="מייל"><input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="סיסמה"><input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Button onClick={signIn}>כניסה</Button>
      </> : <>
        <Button onClick={() => enter("coach")}>כניסה כמאמן (דוגמה)</Button>
        <Button secondary onClick={() => enter("trainee", "d0000000-0000-4000-8000-000000001001")}>כניסה כמתאמן (דוגמה)</Button>
        <Button secondary onClick={() => nav.go("S22")}>פתיחת הזמנה כמתאמן חדש</Button>
        <div className="muted small">בגרסת הפיתוח הכניסה היא בחירת תפקיד לדוגמה. הכניסה האמיתית, במייל וסיסמה, תתחבר בשלב הממשקים.</div>
      </>}
    </Screen>
  );
}
