// S18 coins and rewards, trainee (UC7, story 6): balance, history, and redeeming with an in-page confirmation.
import { useState } from "react";
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Button, Hero, Item, Screen, fmtDate } from "../design/components";
import { useNav } from "../nav";

const LABEL: Record<string, string> = { workout: "אימון", goal: "יעד אישי", challenge: "אתגר שבועי", attendance: "הגעה לשיעור", redeem: "מימוש" };

export default function S18Coins() {
  const nav = useNav();
  const { data, reload } = useCall("S18", "coins", "get_balance");
  const [confirm, setConfirm] = useState<string | null>(null);

  const redeem = async (rewardID: string) => {
    const r = await call("S18", "coins", "redeem_reward", { rewardID });
    setConfirm(null);
    if (!r.ok) return nav.toast(r.error!.message);
    reload(); nav.toast("מימשת! המאמן יספק את התגמול");
  };
  if (!data) return <Screen eyebrow="מטבעות" title="מטבעות ותגמולים">{null}</Screen>;
  return (
    <Screen eyebrow="מטבעות" title="מטבעות ותגמולים">
      <Hero><div className="sub">היתרה שלך</div><div className="big">{data.balance}</div></Hero>
      <h2>תגמולים</h2>
      <div className="list">
        {data.rewards.map((r: any) => (
          <Item key={r.RewardID}>
            <div><div>{r.rewardName}</div><div className="muted small mono">{r.priceCoins} מטבעות</div></div>
            {confirm === r.RewardID
              ? <div className="row"><Button small onClick={() => redeem(r.RewardID)}>אישור (יישארו {data.balance - r.priceCoins})</Button><Button small secondary onClick={() => setConfirm(null)}>ביטול</Button></div>
              : data.balance >= r.priceCoins ? <Button small onClick={() => setConfirm(r.RewardID)}>מימוש</Button>
              : <span className="muted small">חסרים {r.priceCoins - data.balance}</span>}
          </Item>
        ))}
      </div>
      <h2>היסטוריה</h2>
      <div className="list">
        {data.history.map((c: any, i: number) => <div className="row between small" key={i}><span>{LABEL[c.eventType]} · {fmtDate(c.createdAt)}</span><span className="mono">{c.amount > 0 ? "+" : ""}{c.amount}</span></div>)}
      </div>
    </Screen>
  );
}
