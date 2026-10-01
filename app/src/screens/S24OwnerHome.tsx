// S24 the business overview (usecase-12 step 2, story 15; prototype version 3): the month's income, open payments, the
// coaches, this week's class occupancy and rewards to deliver, for the whole business. A field whose source failed is
// left empty, and the rest still shows (UC12 g). Loading and an error with a retry.
import { now } from "../api/client";
import { useCall } from "../api/useCall";
import { Hero, HeroStat, Load, Screen, Tile, fmtDay, fmtMoney, greeting } from "../design/components";
import { useNav } from "../nav";

const shown = (v: number | null | undefined) => v ?? "–";

export default function S24OwnerHome() {
  const nav = useNav();
  const home = useCall("S24", "home", "get_owner_home");
  return (
    <Screen eyebrow={`${greeting()} · ${fmtDay(now("S24"))}`} title="העסק שלי" noBack>
      <Load state={home}>{(d: any) => {
        const week = d.classesWeek as { registered: number; capacity: number } | null;
        return <>
          <Hero row>
            <div>
              <div className="sub">הכנסות החודש (הדגמה)</div>
              <div className="num">{d.incomeMonth === null ? "–" : fmtMoney(d.incomeMonth)}</div>
              <div className="sub">{shown(d.paidMonth)} תשלומים ששולמו</div>
            </div>
            <HeroStat value={shown(d.activeTrainees)} label="מתאמנים פעילים" />
          </Hero>
          <div className="grid2">
            <Tile label="תשלומים פתוחים" value={shown(d.openPayments)} caption={d.openPayments ? `${fmtMoney(d.openAmount)} לגבייה` : "הכול שולם"} />
            <Tile label="מאמנים" value={shown(d.coaches)} caption={d.pendingCoaches ? "יש הזמנה פתוחה" : "לרשימה"} onClick={() => nav.setTab("S25")} />
            <Tile label="תפוסת שיעורים השבוע" value={week?.capacity ? `${Math.round((week.registered / week.capacity) * 100)}%` : "אין"}
              caption={week ? `${week.registered}/${week.capacity} מקומות` : ""} />
            <Tile label="תגמולים לאספקה" value={shown(d.rewardsToDeliver)} caption="בידי המאמנים" />
          </div>
        </>;
      }}</Load>
    </Screen>
  );
}
