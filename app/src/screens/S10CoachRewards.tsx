// S10 rewards, coach (UC7 steps 2 and 9, story 6): the catalog, and redemptions to deliver.
// Design stage: marking a delivery checks the reply (finding 3; the review saw "delivered" with nothing saved), the new
// reward's fields have labels (18), prices with a thousands separator (32), loading, an error and "none yet" (2, 6, 30).
import { useState } from "react";
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Avatar, Badge, Button, Empty, Field, Item, Load, Name, Screen, fmtNum } from "../design/components";
import { useNav } from "../nav";

export default function S10CoachRewards() {
  const nav = useNav();
  const data = useCall("S10", "coins", "manage_rewards", { op: "list" });
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const add = async () => {
    const r = await call("S10", "coins", "manage_rewards", { op: "add", rewardName: name, priceCoins: Number(price) });
    if (!r.ok) return nav.toast(name.trim() && Number(price) > 0 ? r.error!.message : "חסר שם או מחיר");
    setName(""); setPrice(""); data.reload(); nav.toast("התגמול נוסף לקטלוג");
  };
  const deliver = async (redemptionID: string) => {
    const r = await call("S10", "coins", "mark_reward_delivered", { redemptionID });
    if (!r.ok) return nav.toast(r.error!.message);
    data.reload(); nav.toast("סומן: התגמול סופק");
  };
  return (
    <Screen eyebrow="מטבעות ותגמולים" title="תגמולים">
      <Load state={data}>{(d: any) => <>
        <h2>קטלוג</h2>
        {d.rewards.length
          ? <div className="list">{d.rewards.map((r: any) => <Item key={r.RewardID}><span className="t">{r.rewardName}</span><span className="mono">{fmtNum(r.priceCoins)} מטבעות</span></Item>)}</div>
          : <Empty title="עוד אין תגמולים בקטלוג" />}
        <div className="grid2">
          <Field label="שם התגמול"><input id="rewardName" value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: חולצה" /></Field>
          <Field label="מחיר במטבעות"><input id="rewardPrice" type="number" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        </div>
        <Button secondary onClick={add}>+ הוספת תגמול</Button>
        <h2>מימושים לאספקה</h2>
        {d.redemptions.length
          ? <div className="list">{d.redemptions.map((r: any) => (
            <Item key={r.RedemptionID}>
              <Avatar name={r.fullName} />
              <div className="grow"><div className="t"><Name>{r.fullName}</Name></div><div className="s">{r.rewardName ?? "תגמול שהוצא משימוש"}</div></div>
              {r.status === "delivered" ? <Badge tone="ok">סופק</Badge> : <Button secondary small onClick={() => deliver(r.RedemptionID)}>סימון סופק</Button>}
            </Item>
          ))}</div>
          : <Empty title="אין מימושים לאספקה" />}
      </>}</Load>
    </Screen>
  );
}
