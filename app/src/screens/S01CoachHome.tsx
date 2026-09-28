// S01 coach home (UC4 step 8, story 19): what needs attention today, with quick links.
import { now } from "../api/client";
import { useCall } from "../api/useCall";
import { Badge, Hero, Item, Screen, fmtDate } from "../design/components";
import { useNav } from "../nav";

export default function S01CoachHome() {
  const nav = useNav();
  const { data } = useCall("S01", "home", "get_coach_home");
  return (
    <Screen eyebrow="בוקר טוב" title="הבית שלי" noBack>
      {data && (
        <>
          <Hero><div className="sub">מתאמנים פעילים</div><div className="big">{data.activeTrainees}</div><div className="sub">{fmtDate(now("S01"))}</div></Hero>
          <h2>דורש תשומת לב</h2>
          <div className="list">
            <Item onClick={() => nav.go("S08")}><span>תשלומים פתוחים</span><Badge tone={data.openPayments ? "warn" : undefined}>{data.openPayments}</Badge></Item>
            <Item onClick={() => nav.setTab("S11")}><span>שיעורים היום</span><Badge>{data.classesToday}</Badge></Item>
            <Item onClick={() => nav.setTab("S11")}><span>בקשות ביטול חריגות</span><Badge tone={data.lateRequests ? "warn" : undefined}>{data.lateRequests}</Badge></Item>
            <Item onClick={() => nav.go("S10")}><span>תגמולים לאספקה</span><Badge tone={data.rewardsToDeliver ? "warn" : undefined}>{data.rewardsToDeliver}</Badge></Item>
            {data.challenge && <Item onClick={() => nav.go("S09")}><span>האתגר השבועי: {data.challenge.challengeName}</span><Badge tone="ok">{data.challenge.completions} השלימו</Badge></Item>}
          </div>
        </>
      )}
    </Screen>
  );
}
