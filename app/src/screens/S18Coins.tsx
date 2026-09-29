// S18 coins and rewards, trainee (UC7, story 6): balance, history, and redeeming with an in-page confirmation.
// Design stage: the confirmation takes a full row under the reward, with what is left (finding 13), numbers with a
// thousands separator and signs read left to right (8, 32), loading, an error with a retry and "none yet" (2, 6, 30).
import { useState } from "react";
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Button, Card, Confirm, Empty, Hero, HeroStat, Load, Screen, Signed, fmtDate, fmtNum } from "../design/components";
import { useNav } from "../nav";

const LABEL: Record<string, string> = { workout: "אימון", goal: "יעד אישי", challenge: "אתגר שבועי", attendance: "הגעה לשיעור", redeem: "מימוש" };

export default function S18Coins() {
  const nav = useNav();
  const coins = useCall("S18", "coins", "get_balance");
  const [confirm, setConfirm] = useState<string | null>(null);

  const redeem = async (rewardID: string) => {
    const r = await call("S18", "coins", "redeem_reward", { rewardID });
    setConfirm(null);
    if (!r.ok) return nav.toast(r.error!.message);
    coins.reload(); nav.toast("מימשת! המאמן יספק את התגמול");
  };
  return (
    <Screen eyebrow="מטבעות" title="מטבעות ותגמולים">
      <Load state={coins}>{(d: any) => <>
        <Hero row>
          <div><div className="lead">היתרה שלך</div><div className="sub">מטבעות על אימונים, יעדים, אתגרים והגעה לשיעורים</div></div>
          <HeroStat value={fmtNum(d.balance)} label="מטבעות" />
        </Hero>
        <h2>תגמולים</h2>
        {d.rewards.length
          ? <div className="list">
            {d.rewards.map((r: any) => (
              <div className="card col" key={r.RewardID}>
                <div className="row between">
                  <div><div className="t">{r.rewardName}</div><div className="muted small mono">{fmtNum(r.priceCoins)} מטבעות</div></div>
                  {confirm === r.RewardID ? null
                    : d.balance >= r.priceCoins ? <Button small onClick={() => setConfirm(r.RewardID)}>מימוש</Button>
                    : <span className="muted small">חסרים {fmtNum(r.priceCoins - d.balance)}</span>}
                </div>
                {confirm === r.RewardID && <Confirm text={`לממש את "${r.rewardName}"? אחרי המימוש יישארו ${fmtNum(d.balance - r.priceCoins)} מטבעות.`}
                  yes="אישור המימוש" onYes={() => redeem(r.RewardID)} onNo={() => setConfirm(null)} />}
              </div>
            ))}
          </div>
          : <Empty title="עוד אין תגמולים בקטלוג" />}
        <h2>היסטוריה</h2>
        <Card col>
          {d.history.length
            ? d.history.map((c: any, i: number) => <div className="row between small" key={i}><span>{LABEL[c.eventType] ?? c.eventType} · {fmtDate(c.createdAt)}</span><Signed n={c.amount} /></div>)
            : <div className="muted small">עוד אין תנועות. המטבעות הראשונים מגיעים עם האימון הראשון.</div>}
        </Card>
      </>}</Load>
    </Screen>
  );
}
