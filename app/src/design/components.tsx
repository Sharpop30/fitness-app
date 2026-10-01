// D01 design module: the base components. Screens compose these and add no styling of their own.
// Version 2 (design stage, task 1; prototype version 2): the FORM shell with icons, tiles, the loading, error and empty
// states, a button that shows it is sending, labels tied to fields, and the text helpers for names, numbers and dates.
import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { useNav } from "../nav";
import { identityConfigured } from "../identity/auth";

// ---- Icons: 1.8 strokes with round caps (FORM) ----
const svg = (d: ReactNode, size = 20) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
export const ICONS = {
  home: svg(<path d="M3.5 9.5L10 4l6.5 5.5V16a1 1 0 0 1-1 1H12v-4.5H8V17H4.5a1 1 0 0 1-1-1z" />),
  users: svg(<><circle cx="7.5" cy="7" r="2.8" /><path d="M2.5 16.5c.6-2.7 2.7-4.2 5-4.2s4.4 1.5 5 4.2" /><circle cx="14" cy="7.6" r="2.2" /><path d="M14 12.4c1.9.1 3.2 1.4 3.7 3.6" /></>),
  calendar: svg(<><rect x="3" y="4.5" width="14" height="12.5" rx="2.5" /><path d="M3 8.5h14M7 2.8v3.4M13 2.8v3.4" /></>),
  more: svg(<><circle cx="5" cy="10" r=".6" /><circle cx="10" cy="10" r=".6" /><circle cx="15" cy="10" r=".6" /></>),
  dumbbell: svg(<path d="M6 6v8M14 6v8M3.5 8v4M16.5 8v4M6 10h8" />),
  user: svg(<><circle cx="10" cy="7" r="3.2" /><path d="M3.5 17c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" /></>),
  chart: svg(<path d="M3.5 16.5h13M6 13.5v-3M10 13.5v-7M14 13.5v-5" />), // the owner's measures (prototype version 3)
  back: svg(<path d="M7.5 4l6 6-6 6" />, 16), // "back" points right, as in Hebrew apps (finding 38)
  chevron: svg(<path d="M12 5l-5 5 5 5" />, 14), // a list row points left, forward (finding 38)
  offline: svg(<path d="M3 8.5a10 10 0 0 1 14 0M5.5 11.3a6.5 6.5 0 0 1 9 0M8.2 14a2.6 2.6 0 0 1 3.6 0M3 3l14 14" />, 28),
};
export const Chevron = () => <span className="chev">{ICONS.chevron}</span>;

const COACH_TABS: [string, string, ReactNode][] = [["S01", "בית", ICONS.home], ["S02", "מתאמנים", ICONS.users], ["S11", "שיעורים", ICONS.calendar], ["more", "עוד", ICONS.more]];
const TRAINEE_TABS: [string, string, ReactNode][] = [["S13", "בית", ICONS.home], ["S14", "אימון", ICONS.dumbbell], ["S17", "שיעורים", ICONS.calendar], ["me", "אני", ICONS.user]];
// The owner's tabs (prototype version 3; map v11): overview, coaches, measures, and "more", a navigation menu.
const OWNER_TABS: [string, string, ReactNode][] = [["S24", "סקירה", ICONS.home], ["S25", "מאמנים", ICONS.users], ["S26", "מדדים", ICONS.chart], ["ownerMore", "עוד", ICONS.more]];

// ---- The theme: the choice is kept in this browser (finding 27). Storage may be missing; the page works without it. ----
const THEME_KEY = "fitness-theme";
export function initTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  } catch { /* no storage: the system setting stays */ }
}
const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
};
function ThemeButton() {
  const [dark, setDark] = useState(isDark);
  const toggle = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* kept for this visit only */ }
    setDark(!dark);
  };
  return <button className="theme" onClick={toggle}>{dark ? "מצב בהיר" : "מצב כהה"}</button>;
}

// The demo bar (finding 1, design stage decision 2): with the identity service, real data, and only payments are a demo;
// on demo data, everything is sample data.
export function Screen({ eyebrow, title, children, noBack }: { eyebrow: ReactNode; title: ReactNode; children: ReactNode; noBack?: boolean }) {
  const nav = useNav();
  const tabs = nav.role === "coach" ? COACH_TABS : nav.role === "trainee" ? TRAINEE_TABS : nav.role === "owner" ? OWNER_TABS : [];
  return (
    <>
      <div className="demo-bar">{identityConfigured() ? "תשלומים וחשבוניות הם הדגמה בלבד." : "גרסת דוגמה. כל הנתונים הם נתוני דוגמה, ותשלומים וחשבוניות הם הדגמה בלבד."}</div>
      <header className="hd">
        <div className="hd-top">
          {nav.depth > 1 && !noBack ? <button className="back" onClick={nav.back}>{ICONS.back}<span>חזרה</span></button> : <span />}
          <ThemeButton />
        </div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
      </header>
      <main>{children}</main>
      {tabs.length > 0 && (
        <nav className="tabs" aria-label="ניווט ראשי">
          {tabs.map(([k, l, icon]) => (
            <button key={k} className={nav.tab === k ? "on" : ""} aria-current={nav.tab === k ? "page" : undefined} onClick={() => nav.setTab(k)}>{icon}<span>{l}</span></button>
          ))}
        </nav>
      )}
    </>
  );
}

// ---- Cards and rows ----
export const Card = ({ children, col }: { children: ReactNode; col?: boolean }) => <div className={col ? "card col" : "card"}>{children}</div>;
export const Hero = ({ children, row }: { children: ReactNode; row?: boolean }) => <div className={row ? "hero row between" : "hero"}>{children}</div>;
// The number on the side of a hero card, lime on dark (FORM).
export const HeroStat = ({ value, label }: { value: ReactNode; label: string }) => <div className="side"><div className="num">{value}</div><div className="cap">{label}</div></div>;
export const Badge = ({ children, tone }: { children: ReactNode; tone?: "ok" | "warn" | "demo" }) => <span className={`badge ${tone ?? ""}`}>{children}</span>;
export const Notice = ({ children }: { children: ReactNode }) => <div className="notice">{children}</div>;
export const WarnBox = ({ children }: { children: ReactNode }) => <div className="warnbox">{children}</div>;
export const SectionHead = ({ title, action }: { title: string; action?: ReactNode }) => <div className="sechd"><h2>{title}</h2>{action}</div>;

// A number tile: label, number, and a short line under it; a button when it leads somewhere.
export function Tile({ label, value, caption, onClick }: { label: string; value: ReactNode; caption?: ReactNode; onClick?: () => void }) {
  const inner = <><div className="lbl">{label}</div><div className="num">{value}</div>{caption != null && <div className="cap">{caption}</div>}</>;
  return onClick ? <button className="tile" onClick={onClick}>{inner}</button> : <div className="tile">{inner}</div>;
}

export function Item({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return onClick ? <button className="item" onClick={onClick}>{children}</button> : <div className="item">{children}</div>;
}
// A list row with a title, an optional second line and what sits at its end (a badge, a number, or the chevron).
export function Row({ title, sub, end, lead, onClick }: { title: ReactNode; sub?: ReactNode; end?: ReactNode; lead?: ReactNode; onClick?: () => void }) {
  return (
    <Item onClick={onClick}>
      {lead}
      <div className="grow"><div className="t">{title}</div>{sub != null && <div className="s">{sub}</div>}</div>
      {end ?? (onClick ? <Chevron /> : null)}
    </Item>
  );
}
// The time column of a class row: "18:30" over "ב׳ 28.9".
export const When = ({ at }: { at: string | Date }) => <div className="when"><div className="h">{fmtTime(at)}</div><div className="d">{fmtWeekday(at)} {fmtDate(at)}</div></div>;
export const Avatar = ({ name }: { name: string }) => <span className="av" aria-hidden="true">{initials(name)}</span>;
export const TintRow = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => <button className="tintrow" onClick={onClick}>{children}</button>;
// A question before a change that cannot be undone from the screen (finding 20), or before spending (finding 13).
export function Confirm({ text, yes, onYes, onNo }: { text: ReactNode; yes: string; onYes: () => unknown; onNo: () => void }) {
  return (
    <div className="confirm col" role="alertdialog" aria-label={typeof text === "string" ? text : undefined}>
      <b>{text}</b>
      <div className="row"><Button small onClick={onYes}>{yes}</Button><Button small secondary onClick={onNo}>ביטול</Button></div>
    </div>
  );
}

// ---- States: loading (finding 6), an error with a retry (finding 2), empty (finding 30) ----
export const Loading = () => (
  <>
    <div className="skel" aria-hidden="true" /><div className="skel" aria-hidden="true" /><div className="skel" aria-hidden="true" />
    <div className="muted small" role="status">טוען...</div>
  </>
);
export function ErrorState({ error, onRetry }: { error?: { code: string; message: string } | null; onRetry: () => void }) {
  const offline = !error || error.code === "STORAGE_UNAVAILABLE";
  return (
    <div className="state err" role="alert">
      {offline && <span className="muted">{ICONS.offline}</span>}
      <div className="t">{offline ? "אין חיבור כרגע" : "משהו לא נטען"}</div>
      <div className="s">{offline ? "הנתונים לא הגיעו. אין צורך להזין שוב דבר." : error.message}</div>
      <Button small secondary onClick={onRetry}>לנסות שוב</Button>
    </div>
  );
}
// "Nothing yet": shown only when the reply came back and is empty. With a title it is the FORM empty card.
export function Empty({ children, title, sub, image }: { children?: ReactNode; title?: string; sub?: string; image?: ReactNode }) {
  if (title == null) return <div className="empty">{children}</div>;
  return <div className="state">{image}<div className="t">{title}</div>{sub && <div className="s">{sub}</div>}{children}</div>;
}
// One screen's data: loading, then the error with a retry, then the content. "Empty" is the screen's own decision,
// made on data that did arrive (finding 2: no "there is none" when nothing came back).
export function Load<T>({ state, children }: { state: { data: T | null; error: { code: string; message: string } | null; loading: boolean; reload: () => void }; children: (data: T) => ReactNode }) {
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (state.loading || state.data == null) return <Loading />;
  return <>{children(state.data)}</>;
}

// A decorative picture (design stage, task 4). Decorative, so hidden from screen readers; until a picture is approved
// by the team, a soft placeholder of the same size keeps the layout.
export function Picture({ src, size }: { src?: string; size?: "tall" | "short" }) {
  const cls = `img${size ? " " + size : ""}`;
  return src ? <img className={cls} src={src} alt="" aria-hidden="true" /> : <div className={cls} aria-hidden="true" />;
}

// ---- Buttons ----
// A button whose action returns a promise shows "sending" and cannot be pressed again until the reply (finding 16).
export function Button({ children, onClick, secondary, small, disabled, busyText = "שולח..." }: { children: ReactNode; onClick?: () => unknown; secondary?: boolean; small?: boolean; disabled?: boolean; busyText?: string }) {
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const click = async () => {
    if (busy || !onClick) return;
    const r = onClick();
    if (r && typeof (r as Promise<unknown>).then === "function") {
      setBusy(true);
      try { await r; } finally { if (alive.current) setBusy(false); }
    }
  };
  return (
    <button className={`btn${secondary ? " sec" : ""}${small ? " small" : ""}`} onClick={click} disabled={disabled || busy} aria-busy={busy || undefined}>
      {busy ? busyText : children}
    </button>
  );
}

// A button that opens the phone's file picker (UC10 step 1, the upload); "uploading" while it goes (finding 16).
export function FileButton({ children, id, accept, onFile, busy }: { children: ReactNode; id: string; accept: string; onFile: (f: File | undefined) => unknown; busy?: boolean }) {
  return (
    <label className="btn sec" aria-busy={busy || undefined} aria-disabled={busy || undefined}>
      {busy ? "מעלה..." : children}
      <input id={id} type="file" accept={accept} hidden disabled={busy} onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
    </label>
  );
}

export const LinkButton = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => <button className="link" onClick={onClick}>{children}</button>;

// ---- Forms ----
// The label names its field for a screen reader (finding 18): the field's own id, or one made here.
export function Field({ label, children }: { label: string; children: ReactNode }) {
  const made = useId();
  if (!isValidElement(children)) return <div><label>{label}</label>{children}</div>;
  const el = children as ReactElement<{ id?: string }>;
  const id = el.props.id ?? made;
  return <div><label htmlFor={id}>{label}</label>{cloneElement(el, { id })}</div>;
}
export const CheckLine = ({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="checkline" htmlFor={id}><input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span>{label}</span></label>
);
// The ✓ of a set or of attendance: a name and a pressed state (finding 18).
export const Check = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => (
  <button className={`check${on ? " on" : ""}`} aria-pressed={on} aria-label={label} onClick={onClick}>{on ? "✓" : ""}</button>
);
export const StatusToggle = ({ on, name, onClick }: { on: boolean; name: string; onClick: () => void }) => (
  <button className={`status${on ? " on" : ""}`} aria-pressed={on} aria-label={`${name}: ${on ? "הגיע/ה" : "לא סומן/ה"}`} onClick={onClick}>{on ? "✓ הגיע/ה" : "לא סומן/ה"}</button>
);

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return <div className="seg" role="group">{options.map(([v, l]) => <button key={v} className={value === v ? "on" : ""} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}</div>;
}

export const Pill = ({ on, children, onClick }: { on?: boolean; children: ReactNode; onClick: () => void }) =>
  <button className={`pill${on ? " on" : ""}`} aria-pressed={!!on} onClick={onClick}>{children}</button>;

// ---- Text direction (finding 8): a user's name isolated, email and links left to right, a signed number as "+10" ----
export const Name = ({ children }: { children: ReactNode }) => <bdi>{children}</bdi>;
export const Ltr = ({ children }: { children: ReactNode }) => <span className="ltr">{children}</span>;
export const Signed = ({ n }: { n: number }) => <span className="ltr mono">{n > 0 ? "+" : ""}{fmtNum(n)}</span>;
export const LinkBox = ({ children }: { children: ReactNode }) => <div className="linkbox">{children}</div>;

// ---- The video of an exercise (UC10 steps 6, 7, alternative d; stage 5 plan, decision 9): YouTube in its own player,
// an uploaded file in the browser's. A video that does not load says so, and the workout goes on. ----
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

// ---- Formatting (findings 31, 32) ----
const DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
export const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
export const fmtDateYear = (d: string | Date) => new Date(d).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" });
export const fmtTime = (d: string | Date) => new Date(d).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
export const fmtWeekday = (d: string | Date) => DAYS[new Date(d).getDay()];
export const fmtDay = (d: string | Date) => `יום ${fmtWeekday(d)}, ${fmtDate(d)}`; // "יום ד׳, 30.9"
export const fmtNum = (n: number) => Number(n).toLocaleString("he-IL"); // 125,000
export const fmtMoney = (n: number) => `₪${fmtNum(n)}`;
export const greeting = (at: Date = new Date()) => {
  const h = at.getHours();
  return h < 5 ? "לילה טוב" : h < 12 ? "בוקר טוב" : h < 17 ? "צהריים טובים" : h < 21 ? "ערב טוב" : "לילה טוב";
};
export const initials = (name: string) => name.replace(/\(.*?\)/g, "").trim().split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2);

// One exercise's sets as "weight×reps | ..." ("—" for a set not done). Kept until the screens move to SetChips (task 3).
export const setsText = (sets: any[], exID: string) =>
  sets.filter((s) => s.ExerciseID === exID).map((s) => (s.isDone ? (s.weight ? `${s.weight}×${s.reps}` : `${s.reps}`) : "—")).join(" | ");
// An exercise's sets as chips read left to right, the unit said once (finding 9): "סקוואט (ק"ג × חזרות)  60 × 8".
export function ExerciseSets({ name, bodyweight, sets, extra }: { name: string; bodyweight: boolean; sets: { reps: number; weight: number; isDone: boolean }[]; extra?: ReactNode }) {
  return (
    <div className="exline">
      <div><b>{name}</b> <span className="muted small">{bodyweight ? "(חזרות)" : '(ק"ג × חזרות)'}</span>{extra}</div>
      <div className="chips">{sets.map((s, i) => <span className="setchip" key={i}>{!s.isDone ? "—" : bodyweight ? s.reps : `${s.weight} × ${s.reps}`}</span>)}</div>
    </div>
  );
}

// A logged workout's sets, grouped by exercise in the order done. Bodyweight: every set without weight.
export function byExercise(sets: any[]): { id: string; name: string; bodyweight: boolean; sets: any[] }[] {
  const ids = [...new Set(sets.map((s) => s.ExerciseID))] as string[];
  return ids.map((id) => {
    const mine = sets.filter((s) => s.ExerciseID === id);
    return { id, name: mine[0].exerciseName ?? "", bodyweight: mine.every((s) => !s.weight), sets: mine };
  });
}

export const payLabel: Record<string, string> = { monthly: "מנוי חודשי", pack10: "חבילת 10 אימונים (כרטיסייה)" };

// A demo invoice, always marked as not a tax invoice (story 2). The date with its year (finding 32).
export function InvoiceCard({ inv }: { inv: any }) {
  return (
    <Card col>
      <Badge tone="demo">הדגמה, אינה חשבונית מס</Badge>
      <div className="row between"><span className="muted">מספר</span><span className="mono">{inv.invoiceNumber}</span></div>
      <div className="row between"><span className="muted">לקוח</span><Name>{inv.fullName}</Name></div>
      <div className="row between"><span className="muted">עבור</span><span>{payLabel[inv.paymentType]}</span></div>
      <div className="row between"><span className="muted">סכום</span><span className="mono">{fmtMoney(inv.amount)}</span></div>
      <div className="row between"><span className="muted">תאריך</span><span className="mono">{fmtDateYear(inv.issuedAt)}</span></div>
    </Card>
  );
}
