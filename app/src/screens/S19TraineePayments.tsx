// S19 payments, trainee (UC2, story 2): open requests, a demo payment with no card field, and invoices.
// Design stage: the payment button shows it is working and cannot be pressed twice (finding 16), amounts and dates with
// the year (32), loading, an error with a retry and "none yet" (2, 6, 30; the review saw a new trainee's empty screen).
import { call } from "../api/client";
import { both, useCall } from "../api/useCall";
import { Badge, Button, Empty, InvoiceCard, Load, Screen, fmtDateYear, fmtMoney, payLabel } from "../design/components";
import { useNav } from "../nav";

export default function S19TraineePayments({ invoiceNumber }: { invoiceNumber?: number }) {
  const nav = useNav();
  const pays = useCall("S19", "payments", "list_payments");
  const invs = useCall("S19", "invoices", "list_invoices");

  if (invoiceNumber) {
    return (
      <Screen eyebrow="הדגמה, אינה חשבונית מס" title={`חשבונית ${invoiceNumber}`}>
        <Load state={invs}>{(list: any[]) => {
          const inv = list.find((i: any) => i.invoiceNumber === invoiceNumber);
          return inv ? <InvoiceCard inv={inv} /> : <Empty title="החשבונית לא נמצאה" />;
        }}</Load>
      </Screen>
    );
  }
  const pay = async (paymentRequestID: string) => {
    const r = await call("S19", "payments", "pay_demo", { paymentRequestID });
    if (!r.ok) return nav.toast(r.error!.message);
    pays.reload(); invs.reload(); nav.toast("התשלום לדוגמה הושלם, וחשבונית נוצרה");
  };
  return (
    <Screen eyebrow="הדגמה, לא מתבצע חיוב" title="תשלומים">
      <Load state={both(pays, invs)}>{([ps]: [any[], any[]]) => ps.length
        ? <div className="list">
          {ps.map((p: any) => (
            <div className="card col" key={p.PaymentRequestID}>
              <div className="row between"><span className="t">{payLabel[p.paymentType]}</span><span className="mono">{fmtMoney(p.amount)}</span></div>
              <div className="muted small">{fmtDateYear(p.createdAt)}</div>
              {p.status === "open"
                ? <><Badge tone="demo">הדגמה: אין שדה כרטיס ולא מתבצע חיוב</Badge><Button onClick={() => pay(p.PaymentRequestID)} busyText="מעבד...">תשלום לדוגמה</Button></>
                : <div><Button secondary small onClick={() => nav.go("S19", { invoiceNumber: p.invoiceNumber })}>חשבונית {p.invoiceNumber}</Button></div>}
            </div>
          ))}
        </div>
        : <Empty title="אין בקשות תשלום" sub="כשהמאמן ישלח בקשת תשלום, היא תופיע כאן." />}
      </Load>
    </Screen>
  );
}
