// S08 payments and invoices, coach (UC2, story 2). Demo only: no card data anywhere.
import { useState } from "react";
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Badge, Button, Field, InvoiceCard, Item, Screen, fmtDate, payLabel } from "../design/components";
import { useNav } from "../nav";

export default function S08CoachPayments({ traineeID, request, invoice }: { traineeID?: string; request?: boolean; invoice?: any }) {
  const nav = useNav();
  const pays = useCall("S08", "payments", "list_payments", traineeID ? { traineeID } : {});
  const invs = useCall("S08", "invoices", "list_invoices", traineeID ? { traineeID } : {});
  const people = useCall("S08", "trainees", "list_trainees");
  // The card's trainee, or the first who joined; no fixed demo ID (stage 4d plan, decision 9).
  const [picked, setWho] = useState<string | undefined>(traineeID);
  const who = picked ?? people.data?.find((t: any) => t.joined)?.TraineeID ?? "";
  const [type, setType] = useState("monthly");

  if (invoice) return <Screen eyebrow="הדגמה, אינה חשבונית מס" title={`חשבונית ${invoice.invoiceNumber}`}><InvoiceCard inv={invoice} /></Screen>;

  if (request) {
    const send = async () => {
      const r = await call("S08", "payments", "create_payment_request", { traineeID: who, paymentType: type });
      if (!r.ok) return nav.toast(r.error!.message);
      nav.back(); nav.toast("בקשת התשלום נשלחה למתאמן");
    };
    return (
      <Screen eyebrow="הדגמה, לא מתבצע חיוב" title="בקשת תשלום">
        <Field label="מתאמן"><select id="payTrainee" value={who} onChange={(e) => setWho(e.target.value)}>
          {people.data?.filter((t: any) => t.joined).map((t: any) => <option key={t.TraineeID} value={t.TraineeID}>{t.fullName}</option>)}
        </select></Field>
        <Field label="סוג התשלום"><select id="payType" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="monthly">מנוי חודשי</option><option value="pack10">חבילת 10 אימונים (כרטיסייה)</option>
        </select></Field>
        <div className="muted small">המחירים מגיעים מההגדרות. הכרטיסייה בגרסה הראשונה היא סוג תשלום בלבד, ואינה סופרת אימונים.</div>
        <Button onClick={send}>שליחת בקשת תשלום</Button>
      </Screen>
    );
  }

  const invOf = (p: any) => invs.data?.find((i: any) => i.invoiceNumber === p.invoiceNumber);
  return (
    <Screen eyebrow="הדגמה, לא מתבצע חיוב" title="תשלומים וחשבוניות">
      <div className="list">
        {pays.data?.map((p: any) => (
          <Item key={p.PaymentRequestID}>
            <div><div>{p.fullName} · {payLabel[p.paymentType]}</div><div className="muted small mono">₪{p.amount} · {fmtDate(p.createdAt)}</div></div>
            {p.status === "paid" ? <Button secondary small onClick={() => nav.go("S08", { invoice: invOf(p) })}>חשבונית {p.invoiceNumber}</Button> : <Badge tone="warn">פתוחה</Badge>}
          </Item>
        ))}
      </div>
      <Button onClick={() => nav.go("S08", { request: true, traineeID })}>בקשת תשלום חדשה</Button>
    </Screen>
  );
}
