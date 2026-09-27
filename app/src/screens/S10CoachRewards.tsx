// S10 rewards, coach (UC7 steps 2 and 9, story 6): the catalog, and redemptions to deliver.
import { useState } from "react";
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Button, Empty, Item, Screen } from "../design/components";
import { useNav } from "../nav";

export default function S10CoachRewards() {
  const nav = useNav();
  const data = useCall("S10", "coins", "manage_rewards", { op: "list" });
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const add = async () => {
    const r = await call("S10", "coins", "manage_rewards", { op: "add", rewardName: name, priceCoins: Number(price) });
    if (!r.ok) return nav.toast("חסר שם או מחיר");
    setName(""); setPrice(""); data.reload(); nav.toast("התגמול נוסף לקטלוג");
  };
  const deliver = async (redemptionID: string) => {
    await call("S10", "coins", "mark_reward_delivered", { redemptionID });
    data.reload(); nav.toast("סומן: התגמול סופק");
  };
  return (
    <Screen eyebrow="מטבעות ותגמולים" title="תגמולים">
      <h2>קטלוג</h2>
      <div className="list">{data.data?.rewards.map((r: any) => <Item key={r.RewardID}><span>{r.rewardName}</span><span className="mono">{r.priceCoins} מטבעות</span></Item>)}</div>
      <div className="grid2">
        <input id="rewardName" value={name} onChange={(e) => setName(e.target.value)} placeholder="שם התגמול" />
        <input id="rewardPrice" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="מחיר במטבעות" />
      </div>
      <Button secondary onClick={add}>+ הוספת תגמול</Button>
      <h2>מימושים לאספקה</h2>
      <div className="list">
        {data.data?.redemptions.length ? data.data.redemptions.map((r: any) => (
          <Item key={r.RedemptionID}>
            <div><div>{r.fullName}</div><div className="muted small">{r.rewardName ?? "תגמול שנמחק"}</div></div>
            {r.status === "delivered" ? <span className="badge ok">סופק</span> : <Button secondary small onClick={() => deliver(r.RedemptionID)}>סימון סופק</Button>}
          </Item>
        )) : <Empty>אין מימושים</Empty>}
      </div>
    </Screen>
  );
}
