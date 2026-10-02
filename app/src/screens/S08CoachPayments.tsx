// S08 payments and invoices, coach (UC2, story 2). Demo only: no card data anywhere.
// Design stage: the trainee's name in the title when opened from the card (finding 11), amounts with a thousands
// separator and dates with the year (32), loading, an error with a retry and "none yet" (2, 6, 30).
// The prices of the two payment types are in SETTINGS, which S08 does not read (module map v10): finding 12 is a gap.
import { useState } from "react";
import { call } from "../api/client";
import { both, useCall } from "../api/useCall";
import { Badge, Button, Empty, Field, InvoiceCard, Item, Load, Name, Screen, fmtDateYear, fmtMoney, payLabel } from "../design/components";
import { useNav } from "../nav";

export default function S08CoachPayments({ traineeID, name, request, invoice }: { traineeID?: string; name?: string; request?: boolean; invoice?: any }) {
  if (invoice) return <Screen eyebrow="הדגמה, אינה חשבונית מס" title={`חשבונית ${invoice.invoiceNumber}`}><InvoiceCard inv={invoice} /></Screen>;
  if (request) return <PaymentRequest traineeID={traineeID} />;
  return <Payments traineeID={traineeID} name={name} />;
}

function Payments({ traineeID, name }: { traineeID?: string; name?: string }) {
  const nav = useNav();
  const pays = useCall("S08", "payments", "list_payments", traineeID ? { traineeID } : {});
  const invs = useCall("S08", "invoices", "list_invoices", traineeID ? { traineeID } : {});
  return (
    <Screen eyebrow="הדגמה, לא מתבצע חיוב" title={name ? <>תשלומים · <Name>{name}</Name></> : "תשלומים וחשבוניות"}>
      <Load state={both(pays, invs)}>{([ps, is]: [any[], any[]]) => ps.length
        ? <div className="list">
          {ps.map((p: any) => (
            <Item key={p.PaymentRequestID}>
              <div className="grow"><div className="t"><Name>{p.fullName}</Name> · {payLabel[p.paymentType]}</div><div className="s"><span className="mono">{fmtMoney(p.amount)}</span> · {fmtDateYear(p.createdAt)}</div></div>
              {p.status === "paid"
                ? <Button secondary small onClick={() => nav.go("S08", { invoice: is.find((i: any) => i.invoiceNumber === p.invoiceNumber) })}>חשבונית {p.invoiceNumber}</Button>
                : <Badge tone="warn">פתוחה</Badge>}
            </Item>
          ))}
        </div>
        : <Empty title="עוד אין בקשות תשלום" />}
      </Load>
      <Button onClick={() => nav.go("S08", { request: true, traineeID })}>בקשת תשלום חדשה</Button>
    </Screen>
  );
}

function PaymentRequest({ traineeID }: { traineeID?: string }) {
  const nav = useNav();
  const people = useCall("S08", "trainees", "list_trainees");
  // The card's trainee, or the first who joined; no fixed demo ID (stage 4d plan, decision 9).
  const [picked, setWho] = useState<string | undefined>(traineeID);
  const who = picked ?? people.data?.find((t: any) => t.joined)?.TraineeID ?? "";
  const [type, setType] = useState("monthly");
  // The price beside each type, from SETTINGS (map v13; design-stage gap 1). A price not set yet shows no number.
  const prices = useCall<Record<string, string>>("S08", "settings", "get_settings", { keys: ["priceMonthly", "pricePack10"] });
  const price = (k: string) => (prices.data?.[k] ? ` · ${fmtMoney(Number(prices.data[k]))}` : "");
  const send = async () => {
    const r = await call("S08", "payments", "create_payment_request", { traineeID: who, paymentType: type });
    if (!r.ok) return nav.toast(r.error!.message);
    nav.back(); nav.toast("בקשת התשלום נשלחה למתאמן");
  };
  return (
    <Screen eyebrow="הדגמה, לא מתבצע חיוב" title="בקשת תשלום">
      <Load state={people}>{(list: any[]) => (
        <Field label="מתאמן"><select id="payTrainee" value={who} onChange={(e) => setWho(e.target.value)}>
          {list.filter((t: any) => t.joined).map((t: any) => <option key={t.TraineeID} value={t.TraineeID}>{t.fullName}</option>)}
        </select></Field>
      )}</Load>
      <Field label="סוג התשלום"><select id="payType" value={type} onChange={(e) => setType(e.target.value)}>
        <option value="monthly">{payLabel.monthly + price("priceMonthly")}</option><option value="pack10">{payLabel.pack10 + price("pricePack10")}</option>
      </select></Field>
      <div className="muted small">{prices.error ? `${prices.error.message}. ` : "המחירים מגיעים מההגדרות. "}הכרטיסייה בגרסה הראשונה היא סוג תשלום בלבד, ואינה סופרת אימונים.</div>
      <Button onClick={send}>שליחת בקשת תשלום</Button>
    </Screen>
  );
}
