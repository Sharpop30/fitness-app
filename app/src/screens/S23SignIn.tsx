// S23 sign-in (identity service only, no module action). In stage 2 the sign-in is a demo role choice;
// the real sign-in with email and password comes with the Identity Connector (stage 5).
import { call, setErrorTexts } from "../api/client";
import { Button, Hero, Screen } from "../design/components";
import { useNav } from "../nav";

export default function S23SignIn() {
  const nav = useNav();
  const enter = async (role: "coach" | "trainee", traineeID?: string) => {
    nav.signIn(role, traineeID);
    const r = await call("S23", "settings", "get_error_texts"); // once, after sign-in
    if (r.ok) setErrorTexts(r.data);
  };
  return (
    <Screen eyebrow="כניסה" title="כניסה לאפליקציה" noBack>
      <Hero><div className="sub">אפליקציה אחת למאמן כושר אישי ולמתאמנים שלו</div><div className="big" style={{ marginTop: 6 }}>תוכניות, תשלומים ומעקב במקום אחד</div></Hero>
      <Button onClick={() => enter("coach")}>כניסה כמאמן (דוגמה)</Button>
      <Button secondary onClick={() => enter("trainee", "d0000000-0000-4000-8000-000000001001")}>כניסה כמתאמן (דוגמה)</Button>
      <Button secondary onClick={() => nav.go("S22")}>פתיחת הזמנה כמתאמן חדש</Button>
      <div className="muted small">בגרסת הפיתוח הכניסה היא בחירת תפקיד לדוגמה. הכניסה האמיתית, במייל וסיסמה, תתחבר בשלב הממשקים.</div>
    </Screen>
  );
}
