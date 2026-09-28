// S23 sign-in (identity service only, no module action). The demo role choice stays; when the identity service is
// configured, a coach can also sign in with email and password (stage 3 plan, decision 5), and S04 then works on the database.
import { useState } from "react";
import { call, setErrorTexts } from "../api/client";
import { Button, Field, Hero, Screen } from "../design/components";
import { identityConfigured, signInWithPassword } from "../identity/auth";
import { useNav } from "../nav";

export default function S23SignIn() {
  const nav = useNav();
  const enter = async (role: "coach" | "trainee", traineeID?: string) => {
    nav.signIn(role, traineeID);
    const r = await call("S23", "settings", "get_error_texts"); // once, after sign-in
    if (r.ok) setErrorTexts(r.data);
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const signInCoach = async () => {
    if (await signInWithPassword(email.trim(), password)) return enter("coach");
    nav.toast("המייל או הסיסמה לא נכונים");
  };
  return (
    <Screen eyebrow="כניסה" title="כניסה לאפליקציה" noBack>
      <Hero><div className="sub">אפליקציה אחת למאמן כושר אישי ולמתאמנים שלו</div><div className="big" style={{ marginTop: 6 }}>תוכניות, תשלומים ומעקב במקום אחד</div></Hero>
      {identityConfigured() && <>
        <Field label="מייל"><input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="סיסמה"><input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Button onClick={signInCoach}>כניסה כמאמן</Button>
      </>}
      <Button onClick={() => enter("coach")}>כניסה כמאמן (דוגמה)</Button>
      <Button secondary onClick={() => enter("trainee", "d0000000-0000-4000-8000-000000001001")}>כניסה כמתאמן (דוגמה)</Button>
      <Button secondary onClick={() => nav.go("S22")}>פתיחת הזמנה כמתאמן חדש</Button>
      <div className="muted small">בגרסת הפיתוח הכניסה היא בחירת תפקיד לדוגמה. הכניסה האמיתית, במייל וסיסמה, תתחבר בשלב הממשקים.</div>
    </Screen>
  );
}
