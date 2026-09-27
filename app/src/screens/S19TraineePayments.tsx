// S19 payments, trainee (UC2, story 2): open requests, a demo payment with no card field, and invoices.
import { call } from "../api/client";
import { useCall } from "../api/useCall";
import { Badge, Button, InvoiceCard, Screen, payLabel } from "../design/components";
import { useNav } from "../nav";

export default function S19TraineePayments({ invoiceNumber }: { invoiceNumber?: number }) {
  const nav = useNav();
  const pays = useCall("S19", "payments", "list_payments");
  const invs = useCall("S19", "invoices", "list_invoices");

  if (invoiceNumber) {
    const inv = invs.data?.find((i: any) => i.invoiceNumber === invoiceNumber);
    return <Screen eyebrow="הדגמה, אינה חשבונית מס" title={`חשבונית ${invoiceNumber}`}>{inv && <InvoiceCard inv={inv} />}</Screen>;
  }
  const pay = async (paymentRequestID: string) => {
    const r = await call("S19", "payments", "pay_demo", { paymentRequestID });
    if (!r.ok) return nav.toast(r.error!.message);
    pays.reload(); invs.reload(); nav.toast("התשלום לדוגמה הושלם, וחשבונית נוצרה");
  };
  return (
    <Screen eyebrow="הדגמה, לא מתבצע חיוב" title="תשלומים">
      <div className="list">
        {pays.data?.map((p: any) => (
          <div className="card col" key={p.PaymentRequestID}>
            <div className="row between"><span>{payLabel[p.paymentType]}</span><span className="mono">₪{p.amount}</span></div>
            {p.status === "open"
              ? <><Badge tone="demo">הדגמה: אין שדה כרטיס ולא מתבצע חיוב</Badge><Button onClick={() => pay(p.PaymentRequestID)}>תשלום לדוגמה</Button></>
              : <Button secondary small onClick={() => nav.go("S19", { invoiceNumber: p.invoiceNumber })}>חשבונית {p.invoiceNumber}</Button>}
          </div>
        ))}
      </div>
    </Screen>
  );
}
