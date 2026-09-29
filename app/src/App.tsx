// The app shell: role, screen stack, tabs and toast (stage 2 plan, task 7). Screens are separate modules;
// this file only routes between them. The "More" and "Me" tabs are navigation menus, with no action of their own.
import { useMemo, useRef, useState, type ComponentType } from "react";
import { setSession } from "./api/client";
import { Row, Screen } from "./design/components";
import { NavContext, useNav, type Nav, type Role, type Route } from "./nav";
import S01 from "./screens/S01CoachHome";
import S02 from "./screens/S02Trainees";
import S03 from "./screens/S03TraineeCard";
import S04 from "./screens/S04ProgramBuilder";
import S05 from "./screens/S05Exercises";
import S06 from "./screens/S06WorkoutsAndNotes";
import S07 from "./screens/S07PersonalGoal";
import S08 from "./screens/S08CoachPayments";
import S09 from "./screens/S09CoachChallenge";
import S10 from "./screens/S10CoachRewards";
import S11 from "./screens/S11CoachClasses";
import S12 from "./screens/S12Settings";
import S13 from "./screens/S13TraineeHome";
import S14 from "./screens/S14Workout";
import S15 from "./screens/S15Feedback";
import S16 from "./screens/S16MyWorkouts";
import S17 from "./screens/S17TraineeClasses";
import S18 from "./screens/S18Coins";
import S19 from "./screens/S19TraineePayments";
import S20 from "./screens/S20TraineeChallenge";
import S21 from "./screens/S21Progress";
import S22 from "./screens/S22JoinInvite";
import S23 from "./screens/S23SignIn";

function CoachMenu() {
  const nav = useNav();
  return (
    <Screen eyebrow="כלים" title="עוד" noBack>
      <div className="list">
        <Row title="רשימת התרגילים והסרטונים" onClick={() => nav.go("S05")} />
        <Row title="אתגר שבועי" onClick={() => nav.go("S09")} />
        <Row title="תגמולים ומימושים" onClick={() => nav.go("S10")} />
        <Row title="תשלומים וחשבוניות" onClick={() => nav.go("S08")} />
        <Row title="הגדרות: מטבעות, מחירים ונוסחים" onClick={() => nav.go("S12")} />
        <Row title="יציאה" onClick={nav.signOut} />
      </div>
    </Screen>
  );
}

// The trainee's menu. It has no action of its own (module map section 4), so the name, the balance and the "to pay"
// badge of prototype version 2 are not shown here (design stage, finding 35: a gap, as it needs a map row).
function TraineeMenu() {
  const nav = useNav();
  return (
    <Screen eyebrow="החשבון שלי" title="אני" noBack>
      <div className="list">
        <Row title="גרף ההתקדמות שלי" onClick={() => nav.go("S21")} />
        <Row title="האימונים שלי והערות המאמן" onClick={() => nav.go("S16")} />
        <Row title="מטבעות ותגמולים" onClick={() => nav.go("S18")} />
        <Row title="האתגר השבועי" onClick={() => nav.go("S20")} />
        <Row title="תשלומים וחשבוניות" onClick={() => nav.go("S19")} />
        <Row title="יציאה" onClick={nav.signOut} />
      </div>
    </Screen>
  );
}

export const SCREENS: Record<string, ComponentType<any>> = {
  S01, S02, S03, S04, S05, S06, S07, S08, S09, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23,
  more: CoachMenu, me: TraineeMenu,
};

export default function App() {
  const [role, setRole] = useState<Role>(null);
  const [tab, setTabState] = useState<string | null>(null);
  // An invite link (SITE_URL?join=token) opens joining, over the sign-in (stage 5 plan, decision 2).
  const [stack, setStack] = useState<Route[]>(() => {
    const inviteToken = new URLSearchParams(window.location.search).get("join");
    return [{ screen: "S23", params: {} }, ...(inviteToken ? [{ screen: "S22", params: { inviteToken } }] : [])];
  });
  const [toastText, setToastText] = useState("");
  const [toastOn, setToastOn] = useState(false);
  const timer = useRef<number>();

  const nav: Nav = useMemo(() => ({
    role, tab, depth: stack.length,
    go: (screen, params = {}) => { setStack((s) => [...s, { screen, params }]); window.scrollTo(0, 0); },
    replace: (screen, params = {}) => setStack((s) => [...s.slice(0, -1), { screen, params }]),
    back: () => { setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)); window.scrollTo(0, 0); },
    setTab: (t) => { setTabState(t); setStack([{ screen: t, params: {} }]); window.scrollTo(0, 0); },
    signIn: (r, traineeID) => {
      setSession({ role: r, traineeID: traineeID ?? null });
      setRole(r);
      const home = r === "coach" ? "S01" : "S13";
      setTabState(home); setStack([{ screen: home, params: {} }]);
    },
    signOut: () => { setSession(null); setRole(null); setTabState(null); setStack([{ screen: "S23", params: {} }]); },
    toast: (text) => {
      if (!text) return;
      setToastText(text); setToastOn(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setToastOn(false), 2400);
    },
  }), [role, tab, stack.length]);

  const top = stack[stack.length - 1];
  const Current = SCREENS[top.screen] ?? S23;
  return (
    <NavContext.Provider value={nav}>
      <div className="app">
        <Current key={stack.length + top.screen + JSON.stringify(top.params)} {...top.params} />
      </div>
      <div className={`toast${toastOn ? " show" : ""}`} role="status">{toastText}</div>
    </NavContext.Provider>
  );
}
