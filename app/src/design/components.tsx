// D01 design module: the base components. Screens compose these and add no styling of their own.
import { type ReactNode, useState } from "react";
import { useNav } from "../nav";

const COACH_TABS: [string, string][] = [["S01", "בית"], ["S02", "מתאמנים"], ["S11", "שיעורים"], ["more", "עוד"]];
const TRAINEE_TABS: [string, string][] = [["S13", "בית"], ["S14", "אימון"], ["S17", "שיעורים"], ["me", "אני"]];

function toggleTheme() {
  const r = document.documentElement;
  const dark = r.dataset.theme === "dark" || (!r.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  r.dataset.theme = dark ? "light" : "dark";
}

export function Screen({ eyebrow, title, children, noBack }: { eyebrow: string; title: string; children: ReactNode; noBack?: boolean }) {
  const nav = useNav();
  const tabs = nav.role === "coach" ? COACH_TABS : nav.role === "trainee" ? TRAINEE_TABS : [];
  return (
    <>
      <div className="demo-bar">גרסת פיתוח. כל הנתונים הם נתוני דוגמה, ותשלומים וחשבוניות הם הדגמה בלבד.</div>
      <header className="hd">
        {nav.depth > 1 && !noBack ? <button className="back" onClick={nav.back}>‹ חזרה</button> : <div style={{ height: 30 }} />}
        <button className="theme" onClick={toggleTheme}>מצב כהה/בהיר</button>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
      </header>
      <main>{children}</main>
      {tabs.length > 0 && (
        <nav className="tabs">
          {tabs.map(([k, l]) => <button key={k} className={nav.tab === k ? "on" : ""} onClick={() => nav.setTab(k)}>{l}</button>)}
        </nav>
      )}
    </>
  );
}

export const Card = ({ children, col }: { children: ReactNode; col?: boolean }) => <div className={col ? "card col" : "card"}>{children}</div>;
export const Hero = ({ children }: { children: ReactNode }) => <div className="hero">{children}</div>;
export const Badge = ({ children, tone }: { children: ReactNode; tone?: "ok" | "warn" | "demo" }) => <span className={`badge ${tone ?? ""}`}>{children}</span>;
export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;
export const Notice = ({ children }: { children: ReactNode }) => <div className="notice">{children}</div>;
export const WarnBox = ({ children }: { children: ReactNode }) => <div className="warnbox">{children}</div>;

export function Button({ children, onClick, secondary, small, disabled }: { children: ReactNode; onClick?: () => void; secondary?: boolean; small?: boolean; disabled?: boolean }) {
  return <button className={`btn${secondary ? " sec" : ""}${small ? " small" : ""}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

// A button that opens the phone's file picker (UC10 step 1, the upload).
export function FileButton({ children, id, accept, onFile }: { children: ReactNode; id: string; accept: string; onFile: (f: File | undefined) => void }) {
  return <label className="btn sec">{children}<input id={id} type="file" accept={accept} hidden onChange={(e) => onFile(e.target.files?.[0])} /></label>;
}

export function Item({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return onClick ? <button className="item" onClick={onClick}>{children}</button> : <div className="item">{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label>{label}</label>{children}</div>;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return <div className="seg">{options.map(([v, l]) => <button key={v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>{l}</button>)}</div>;
}

export const Pill = ({ on, children, onClick }: { on?: boolean; children: ReactNode; onClick: () => void }) =>
  <button className={`pill${on ? " on" : ""}`} onClick={onClick}>{children}</button>;

// The demo video of an exercise (UC10 steps 6, 7, alternative d; stage 5 plan, decision 9): YouTube in its own player, an
// uploaded file in the browser's. A video that does not load says so, and the workout goes on.
const youTubeID = (url: string) => {
  try {
    const u = new URL(url);
    const id = u.hostname === "youtu.be" ? u.pathname.slice(1) : u.pathname.startsWith("/embed/") ? u.pathname.slice(7) : u.searchParams.get("v");
    return id && /^[\w-]{6,}$/.test(id) ? id : null;
  } catch {
    return null;
  }
};
export function VideoPlayer({ videoType, videoUrl }: { videoType: string; videoUrl: string }) {
  const [broken, setBroken] = useState(false);
  const id = videoType === "youtube" ? youTubeID(videoUrl) : null;
  if (broken || (videoType === "youtube" && !id)) return <div className="video">הסרטון אינו זמין כרגע</div>;
  return (
    <div className="video player">
      {id
        ? <iframe src={`https://www.youtube-nocookie.com/embed/${id}`} title="סרטון הדגמה" allow="encrypted-media; picture-in-picture" allowFullScreen />
        : <video src={videoUrl} controls playsInline preload="metadata" onError={() => setBroken(true)} />}
    </div>
  );
}

export const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
export const fmtTime = (d: string | Date) => new Date(d).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

// One exercise's sets as "weight×reps | ..." ("—" for a set not done).
export const setsText = (sets: any[], exID: string) =>
  sets.filter((s) => s.ExerciseID === exID).map((s) => (s.isDone ? (s.weight ? `${s.weight}×${s.reps}` : `${s.reps}`) : "—")).join(" | ");

export const payLabel: Record<string, string> = { monthly: "מנוי חודשי", pack10: "חבילת 10 אימונים (כרטיסייה)" };

// A demo invoice, always marked as not a tax invoice (story 2).
export function InvoiceCard({ inv }: { inv: any }) {
  return (
    <Card col>
      <Badge tone="demo">הדגמה, אינה חשבונית מס</Badge>
      <div className="row between"><span className="muted">מספר</span><span className="mono">{inv.invoiceNumber}</span></div>
      <div className="row between"><span className="muted">לקוח</span><span>{inv.fullName}</span></div>
      <div className="row between"><span className="muted">עבור</span><span>{payLabel[inv.paymentType]}</span></div>
      <div className="row between"><span className="muted">סכום</span><span className="mono">₪{inv.amount}</span></div>
      <div className="row between"><span className="muted">תאריך</span><span>{fmtDate(inv.issuedAt)}</span></div>
    </Card>
  );
}
