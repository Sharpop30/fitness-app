// S26 the measures (usecase-12 step 9, story 15; doc-okr-kpi version 2; prototype version 3): the measures the saved data
// can give, for the whole business. The targets are not set yet, so each says so. Loading and an error with a retry.
import { useCall } from "../api/useCall";
import { Load, Notice, Row, Screen } from "../design/components";

const pct = (part: number | null, whole: number | null) => (part === null || !whole ? "–" : `${Math.round((part / whole) * 100)}%`);

export default function S26Kpis() {
  const kpis = useCall("S26", "business", "get_kpis");
  return (
    <Screen eyebrow="OKR ו-KPI" title="מדדים" noBack>
      <Notice>המטרה: המאמן מנהל את כל העבודה באפליקציה אחת, והמתאמנים נשארים ומתאמנים.</Notice>
      <Load state={kpis}>{(d: any) => {
        const line = (title: string, part: number | null, whole: number | null, kr: string) => (
          <Row title={title} sub={`${part ?? "–"} מתוך ${whole ?? "–"} · ${kr} · יעד: טרם נקבע`} end={<span className="mono kpi">{pct(part, whole)}</span>} />
        );
        return (
          <div className="list">
            {line("תוכניות פעילות לכל מתאמן", d.withProgram, d.activeTrainees, "KR1")}
            {line("תשלומים עם חשבונית", d.invoicedPayments, d.allPayments, "KR1")}
            {line("השתתפות באתגר השבועי", d.challengeCompletions, d.activeTrainees, "KR2")}
            {line("הזנת תוצאות השבוע", d.loggedThisWeek, d.activeTrainees, "KR3")}
          </div>
        );
      }}</Load>
      <div className="muted small">מדדי הנטישה, הכניסות היומיות והמשוב דורשים נתוני כניסה שאינם נשמרים באפליקציה.</div>
    </Screen>
  );
}
