// Every screen opens on demo data and shows its title (stage 2 plan, task 8). Synthetic data only.
// And, with LIVE_DB=1 against the LOCAL stack, the screens on the Endpoint show what the database holds
// (stage 4a plan, task 8; stage 4b plan, task 12; stage 3 report, the content-check debt).
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { call, setAdapter, setSession, type Envelope } from "../api/client";
import { demoAdapter } from "../demo/adapter";
import { accessToken } from "../identity/auth";
import { SCREENS } from "../App";
import { NavContext, type Nav } from "../nav";
import { greeting } from "../design/components";

// No identity token by default, so every screen stays on the demo adapter; the live block below sets one.
vi.mock("../identity/auth", async (original) => ({ ...(await original<object>()), accessToken: vi.fn(() => null) }));

const nav = (role: "owner" | "coach" | "trainee"): Nav => ({
  role, roles: [role], tab: null, depth: 2, go: () => {}, replace: () => {}, back: () => {}, setTab: () => {}, signIn: () => {}, switchRole: () => {}, signOut: () => {}, toast: () => {},
});

const CASES: [string, "owner" | "coach" | "trainee", Record<string, unknown>, string][] = [
  ["S01", "coach", {}, "הבית שלי"], ["S02", "coach", {}, "מתאמנים"], ["S03", "coach", { traineeID: "d0000000-0000-4000-8000-000000001001" }, "נועה (דוגמה)"],
  ["S04", "coach", { traineeID: "d0000000-0000-4000-8000-000000001001" }, "תוכנית אימון"], ["S05", "coach", {}, "תרגילים"], ["S06", "coach", { traineeID: "d0000000-0000-4000-8000-000000001001" }, "אימונים שבוצעו"],
  ["S07", "coach", { traineeID: "d0000000-0000-4000-8000-000000001001" }, "יעד אישי"], ["S08", "coach", {}, "תשלומים וחשבוניות"], ["S09", "coach", {}, "אתגר שבועי"],
  ["S10", "coach", {}, "תגמולים"], ["S11", "coach", {}, "שיעורים"], ["S12", "owner", {}, "הגדרות העסק"],
  ["S13", "trainee", {}, `${greeting()}, נועה`], ["S14", "trainee", {}, "אימון"],
  ["S15", "trainee", { feedback: { done: 9, total: 9, records: [], coins: 10, goal: false, challenge: false, text: "כל הכבוד" } }, "כל הכבוד!"],
  ["S16", "trainee", {}, "האימונים שלי"], ["S17", "trainee", {}, "שיעורים"], ["S18", "trainee", {}, "מטבעות ותגמולים"],
  ["S19", "trainee", {}, "תשלומים"], ["S20", "trainee", {}, "האתגר השבועי"], ["S21", "trainee", {}, "גרף התקדמות"],
  ["S22", "trainee", {}, "הצטרפות"], ["S23", "trainee", {}, "fitness app"],
  // Stage 4e: the owner's screens (prototype version 3).
  ["S24", "owner", {}, "העסק שלי"], ["S25", "owner", {}, "מאמנים"], ["S26", "owner", {}, "מדדים"],
  ["S27", "owner", { coachID: "d0000000-0000-4000-8000-000000000001" }, "המאמן (דוגמה)"],
];

afterEach(cleanup);

// Map v12 (the team's decision, 01.10.2026): the business settings are in the owner's menu only.
test("the business settings are in the owner's menu, and not in the coach's", () => {
  const menu = (role: "owner" | "coach", id: string) => {
    const S = SCREENS[id];
    render(<NavContext.Provider value={{ ...nav(role), roles: ["owner", "coach"] }}><S /></NavContext.Provider>);
  };
  menu("coach", "more");
  expect(screen.queryByText(/הגדרות העסק/)).toBeNull();
  expect(screen.getByText("מעבר לבעל העסק")).toBeTruthy();
  cleanup();
  menu("owner", "ownerMore");
  expect(screen.getByText("הגדרות העסק: מחירים, מטבעות וכללים")).toBeTruthy();
});

test.each(CASES)("%s opens and shows its title", async (id, role, params, title) => {
  setSession({ role, traineeID: role === "trainee" ? "d0000000-0000-4000-8000-000000001001" : null });
  const S = SCREENS[id];
  render(<NavContext.Provider value={nav(role)}><S {...params} /></NavContext.Provider>);
  expect(await screen.findByRole("heading", { level: 1, name: title })).toBeTruthy();
  expect(screen.getByText(/תשלומים וחשבוניות הם הדגמה בלבד/)).toBeTruthy(); // the demo bar (design stage, decision 2)
});

// Stage 4c report, gap 1: the class list and the publish form ask for no single class; one class only with its ID.
test("S11 asks list_registrations only when it opens one class", async () => {
  const asked: Envelope[] = [];
  setAdapter((e, sess) => { asked.push(e); return demoAdapter(e, sess); });
  setSession({ role: "coach", traineeID: null });
  const S = SCREENS.S11;
  try {
    for (const params of [{}, { publish: true }]) {
      render(<NavContext.Provider value={nav("coach")}><S {...params} /></NavContext.Provider>);
      await screen.findByRole("heading", { level: 1 });
      cleanup();
    }
    expect(asked.filter((e) => e.action === "list_registrations")).toEqual([]);
    render(<NavContext.Provider value={nav("coach")}><S classID="d0000000-0000-4000-8000-00000000a001" /></NavContext.Provider>);
    await screen.findByRole("heading", { level: 1, name: "פארק הירקון" });
    expect(asked.filter((e) => e.action === "list_registrations").map((e) => e.payload)).toEqual([{ classID: "d0000000-0000-4000-8000-00000000a001" }]);
  } finally {
    setAdapter(demoAdapter);
  }
});

// The screen review (30.09.2026): one challenge a week, so with one this week S09 offers no "add" but says when the next
// can go out, and the form cannot be sent. The demo data has this week's challenge.
test("S09 with a challenge this week: no add button, the next Sunday instead, and the form cannot publish", async () => {
  setSession({ role: "coach", traineeID: null });
  const S = SCREENS.S09;
  render(<NavContext.Provider value={nav("coach")}><S /></NavContext.Provider>);
  expect(await screen.findByText(/^האתגר הבא אפשר לפרסם מיום ראשון, \d+\.\d+\.$/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "הוספת אתגר" })).toBeNull();
  cleanup();
  render(<NavContext.Provider value={nav("coach")}><S create /></NavContext.Provider>);
  expect(await screen.findByText(/כבר יש אתגר השבוע/)).toBeTruthy();
  await waitFor(() => expect((screen.getByRole("button", { name: "פרסום האתגר" }) as HTMLButtonElement).disabled).toBe(true));
});

// ---- Stage 7a, task 2: the numbers the coach's screens show come from SETTINGS (map v13; design-stage gaps 1 to 3) ----
const coachOpens = (id: string, params: Record<string, unknown> = {}) => {
  setSession({ role: "coach", traineeID: null });
  const S = SCREENS[id];
  render(<NavContext.Provider value={nav("coach")}><S {...params} /></NavContext.Provider>);
};

test("S08: each payment type with its price from SETTINGS", async () => {
  setAdapter(demoAdapter);
  coachOpens("S08", { request: true });
  expect(await screen.findByRole("option", { name: "מנוי חודשי · ₪350" })).toBeTruthy();
  expect(screen.getByRole("option", { name: "חבילת 10 אימונים (כרטיסייה) · ₪600" })).toBeTruthy();
  expect(screen.getByText(/המחירים מגיעים מההגדרות/)).toBeTruthy();
});

test("S05, S07 and S11: the video limit and the coins from SETTINGS, never a fixed number", async () => {
  setAdapter(demoAdapter);
  // The coach's own exercise: the ready-made list takes no video from a coach (map v13, rule 12).
  setSession({ role: "coach", traineeID: null });
  const own = (await call("S05", "exercises", "create_exercise", { name: "פרפר" })).data.ExerciseID;
  coachOpens("S05", { exerciseID: own });
  expect(await screen.findByRole("button", { name: "העלאת סרטון מהטלפון (עד דקה ועד 50 מגה-בייט)" })).toBeTruthy();
  cleanup();
  // A ready-made exercise shows its video and why there is nothing to add (usecase-10 v3, alternative f; prototype 3.2).
  coachOpens("S05", { exerciseID: "d0000000-0000-4000-8000-000000002001" });
  expect(await screen.findByText(/התרגיל מהרשימה המוכנה, והסרטון שלו משותף לכל המאמנים בעסק/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "צירוף קישור" })).toBeNull();
  cleanup();
  coachOpens("S07", { traineeID: "d0000000-0000-4000-8000-000000001001" });
  expect(await screen.findByText(/מתקבלים 30 מטבעות/)).toBeTruthy();
  cleanup();
  coachOpens("S11", { classID: "d0000000-0000-4000-8000-00000000a000" });
  expect(await screen.findByRole("button", { name: "שמירת נוכחות (מי שסומן מקבל 5 מטבעות)" })).toBeTruthy();
});

test("rule 8: a value not set yet shows no number, and S08 says it is not set", async () => {
  setAdapter((e, sess) => e.action === "get_settings" ? Promise.resolve({ ok: false, data: null, error: { code: "VALUE_NOT_SET", message: "הערך עוד לא הוגדר בהגדרות" } }) : demoAdapter(e, sess));
  coachOpens("S08", { request: true });
  expect(await screen.findByText(/הערך עוד לא הוגדר בהגדרות/)).toBeTruthy();
  expect(screen.getByRole("option", { name: "מנוי חודשי" })).toBeTruthy();
  cleanup();
  coachOpens("S07", { traineeID: "d0000000-0000-4000-8000-000000001001" });
  expect(await screen.findByText("כשהמתאמן עובר את היעד מתקבלים מטבעות, והיעד נסגר עד שיוגדר יעד חדש.")).toBeTruthy();
  setAdapter(demoAdapter);
});

// ---- Stage 7a, task 3: S15 names the goal and challenge coins from the reply (map v13; design-stage gap 3) ----
test("S15: the goal and the challenge lines with their coins, as in the prototype", async () => {
  const S = SCREENS.S15;
  const feedback = { done: 9, total: 9, records: [], coins: 10, goal: true, goalCoins: 30, challenge: true, challengeCoins: 50, text: "כל הכבוד" };
  render(<NavContext.Provider value={nav("trainee")}><S feedback={feedback} /></NavContext.Provider>);
  expect(screen.getByText(/השגת את היעד האישי/).textContent).toBe("השגת את היעד האישי! +30 מטבעות");
  expect(screen.getByText(/השלמת את האתגר השבועי/).textContent).toBe("השלמת את האתגר השבועי! +50 מטבעות");
});

// ---- Stage 7a, task 4: the trainee home greets by name and names the next workout's exercises (map v13; gap 7) ----
test("S13: the greeting with the trainee's name, and the exercises of the next workout in order", async () => {
  setAdapter(demoAdapter);
  setSession({ role: "trainee", traineeID: "d0000000-0000-4000-8000-000000001001" });
  const S = SCREENS.S13;
  render(<NavContext.Provider value={nav("trainee")}><S /></NavContext.Provider>);
  expect(await screen.findByRole("heading", { level: 1, name: `${greeting()}, נועה` })).toBeTruthy();
  expect(screen.getByText(/ · /).textContent).toMatch(/^[^·]+( · [^·]+)+$/);
});

// ---- Stage 7a, task 5: "שינוי אתגר" on S09 (map v13, rule 11; usecase-08 v3; prototype 3.2) ----
test("S09: the current challenge offers a change; after a completion only the name and the prize can change", async () => {
  setAdapter(demoAdapter);
  coachOpens("S09");
  expect(await screen.findByRole("button", { name: "שינוי אתגר" })).toBeTruthy();
  cleanup();
  const toasts: string[] = [];
  setSession({ role: "coach", traineeID: null });
  const S = SCREENS.S09;
  render(<NavContext.Provider value={{ ...nav("coach"), toast: (t: string) => toasts.push(t) }}><S edit /></NavContext.Provider>);
  // The demo challenge already has one who completed it, as in the prototype: the target is read only.
  expect(await screen.findByText(/כבר יש מי שהשלים את האתגר/)).toBeTruthy();
  expect(document.getElementById("challengeEditTarget")).toBeNull();
  fireEvent.change(document.getElementById("challengeEditName")!, { target: { value: "אתגר אחר (דוגמה)" } });
  fireEvent.click(screen.getByRole("button", { name: "שמירת השינוי" }));
  await waitFor(() => expect(toasts).toContain("האתגר עודכן"));
  cleanup();
  coachOpens("S09");
  expect(await screen.findByText("אתגר אחר (דוגמה)")).toBeTruthy();
});

// ---- Stage 7a, task 6: an invite that expired shows its message instead of the form (map v13; prototype 3.2) ----
test("S22: an expired invite shows the message and no form; the demo invite opens with the form", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", ""); // the demo: no identity service, whatever app/.env.local holds
  setAdapter(demoAdapter);
  setSession(null);
  const S = SCREENS.S22;
  render(<NavContext.Provider value={nav("trainee")}><S /></NavContext.Provider>);
  expect(await screen.findByRole("button", { name: "הצטרפות" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "מה רואים כשההזמנה פגה?" }));
  expect(await screen.findByText("ההזמנה כבר לא בתוקף. אפשר לבקש הזמנה חדשה")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "הצטרפות" })).toBeNull();
  expect(document.getElementById("joinPassword")).toBeNull();
  vi.unstubAllEnvs();
});

// ---- Content against the database: the screens on the local Endpoint (run with LIVE_DB=1, local stack up) ----
// Stage 4a: S02 and S05. Stage 4b: S04 (the stage 3 debt), and every screen that moved in stage 4b (plan, task 12).
// Stage 4c: S11, S13 and S17. Stage 4d: S01, S03, S08, S12 and S19, and the note limit on S06.
describe.skipIf(!process.env.LIVE_DB)("live on the local stack: the screens on the Endpoint show the database", () => {
  // The shared helper (tests/system/demo-users.mjs) runs in its own Node process: it reads the local stack's status
  // and signs the demo coach and Noa in with a one-run password. Only the local Endpoint and those tokens come back.
  let psql: (sql: string) => string;
  let tokens: { coach: string; noa: string };
  const COACH = "d0000000-0000-4000-8000-000000000001";
  const NOA = "d0000000-0000-4000-8000-000000001001";

  beforeAll(async () => {
    const { execFileSync, execSync } = await import("node:child_process");
    const helper = `${__dirname}/../../../tests/system/demo-users.mjs`;
    const script = `const m = await import(${JSON.stringify("file://" + encodeURI(helper))});
      const t = await m.demoTokens(); console.log(JSON.stringify({ endpoint: m.ENDPOINT, coach: t.coach, noa: t.noa }));`;
    const out = execFileSync("node", ["--input-type=module", "-e", script], { encoding: "utf8" }).trim().split("\n").pop()!;
    const { endpoint, coach, noa } = JSON.parse(out);
    tokens = { coach, noa };
    const db = execSync("docker ps --format '{{.Names}}' | grep supabase_db_fitness-app", { encoding: "utf8" }).trim();
    psql = (sql) => execSync(`docker exec -i ${db} psql -U postgres -tA`, { input: sql, encoding: "utf8" }).trim();
    vi.stubEnv("VITE_API_URL", endpoint);
  }, 60000);
  afterAll(() => { vi.mocked(accessToken).mockReturnValue(null); vi.unstubAllEnvs(); });

  const rows = (sql: string) => psql(sql).split("\n").filter(Boolean).map((l) => l.split("|"));
  const signedIn = (role: "owner" | "coach" | "trainee") => {
    vi.mocked(accessToken).mockReturnValue(role === "trainee" ? tokens.noa : tokens.coach);
    setSession({ role, traineeID: role === "trainee" ? NOA : null });
  };
  // The demo coach is also the owner of the demo business (map v11): the same token, either view.
  const open = (id: string, params: Record<string, unknown> = {}, role: "owner" | "coach" | "trainee" = "coach") => {
    signedIn(role);
    const S = SCREENS[id];
    render(<NavContext.Provider value={nav(role)}><S {...params} /></NavContext.Provider>);
  };
  // The whole row, tile or hero stat a text sits in (design stage: a row's title and its second line are separate elements).
  const lineOf = async (name: string) => {
    const el = (await screen.findAllByText(name, {}, { timeout: 8000 }))[0];
    return (el.closest(".item, .tile, .side, .card") ?? el.parentElement!).textContent;
  };
  const shows = async (text: string | RegExp) => expect((await screen.findAllByText(text, {}, { timeout: 8000 })).length).toBeGreaterThan(0);
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // This week's Sunday in Israel (UC8; stage 4b plan, decision 8).
  const SUNDAY = `(now() at time zone 'Asia/Jerusalem')::date - extract(dow from (now() at time zone 'Asia/Jerusalem')::date)::int`;

  test("S04: Noa's active program, with every workout and every exercise in it", async () => {
    open("S04", { traineeID: NOA });
    for (const [workout] of rows(`select w."workoutName" from workouts w join programs p using ("ProgramID") where p."TraineeID"='${NOA}' and p."isActive"`)) {
      await shows(workout);
    }
    // Active exercises only: S04 names an item from the active list, so an exercise set inactive shows with no name
    // (stage 4b report, a gap next to stage 4a gap 11). Only tests make an exercise inactive today.
    for (const [exercise] of rows(`select distinct e."exerciseName" from workout_items i join workouts w using ("WorkoutID") join programs p using ("ProgramID")
                                   join exercises e using ("ExerciseID") where p."TraineeID"='${NOA}' and p."isActive" and e."isActive"`)) {
      await shows(exercise);
    }
  }, 30000);

  test("S06: every workout Noa did, and every note the coach wrote on them", async () => {
    open("S06", { traineeID: NOA });
    for (const [workout] of rows(`select distinct w."workoutName" from workout_logs l join workouts w using ("WorkoutID") where l."TraineeID"='${NOA}'`)) {
      await shows(new RegExp(escape(workout)));
    }
    for (const [note] of rows(`select n."noteText" from coach_notes n join workout_logs l using ("WorkoutLogID") where l."TraineeID"='${NOA}'`)) {
      await shows(new RegExp(escape(note)));
    }
  }, 30000);

  test("S07: with no goal given, the exercise starts at the first one in the list, not a fixed demo ID", async () => {
    open("S07", { traineeID: NOA });
    // By name: locally the demo list and the real list of 0018 share names (stage 7 plan, execution decision 2).
    const [[first]] = rows(`select "exerciseName" from exercises where "isActive" and not "isBodyweight" and ("CoachID" is null or "CoachID"='${COACH}')
                            order by "exerciseName" limit 1`);
    await waitFor(() => {
      const select = document.getElementById("goalExercise") as HTMLSelectElement;
      expect(select.value).toBeTruthy();
      expect(select.selectedOptions[0].textContent).toBe(first);
    }, { timeout: 8000 });
  }, 30000);

  test("S09: this week's challenge and who completed it; a new exercise challenge lists the exercises", async () => {
    open("S09");
    const current = rows(`select "challengeName", "ChallengeID" from challenges where "CoachID"='${COACH}' and "weekStart" = ${SUNDAY}`);
    if (current.length) {
      await shows(current[0][0]);
      for (const [name] of rows(`select t."fullName" from challenge_completions c join trainees t using ("TraineeID") where c."ChallengeID"='${current[0][1]}'`)) {
        await shows(name);
      }
    } else await shows("אין אתגר השבוע");
    cleanup();
    open("S09", { create: true });
    fireEvent.click(await screen.findByText("יעד בתרגיל"));
    const names = rows(`select "exerciseName" from exercises where "isActive" and ("CoachID" is null or "CoachID"='${COACH}')`).map(([n]) => n);
    const select = () => document.getElementById("challengeExercise") as HTMLSelectElement;
    await waitFor(() => expect([...select().options].map((o) => o.text).sort()).toEqual(names.sort()), { timeout: 8000 });
  }, 30000);

  test("S10: the coach's reward catalog, and the redemptions with the trainee's name", async () => {
    open("S10");
    for (const [name] of rows(`select "rewardName" from rewards where "CoachID"='${COACH}' and "isActive"`)) await shows(name);
    for (const [name] of rows(`select t."fullName" from redemptions r join trainees t using ("TraineeID") where t."CoachID"='${COACH}'`)) await shows(name);
  }, 30000);

  test("S21: the coach sees Noa's chart with every exercise she has results in", async () => {
    open("S21", { traineeID: NOA });
    for (const [name] of rows(`select distinct e."exerciseName" from set_results s join workout_logs l using ("WorkoutLogID") join exercises e using ("ExerciseID")
                               where l."TraineeID"='${NOA}'`)) await shows(name);
  }, 30000);

  test("S14 (as Noa): the workouts of her active program", async () => {
    open("S14", {}, "trainee");
    for (const [workout] of rows(`select w."workoutName" from workouts w join programs p using ("ProgramID") where p."TraineeID"='${NOA}' and p."isActive"`)) {
      await shows(workout);
    }
  }, 30000);

  test("S16 (as Noa): her workouts, and the coach's notes on them", async () => {
    open("S16", {}, "trainee");
    for (const [workout] of rows(`select distinct w."workoutName" from workout_logs l join workouts w using ("WorkoutID") where l."TraineeID"='${NOA}'`)) {
      await shows(new RegExp(escape(workout)));
    }
    for (const [note] of rows(`select n."noteText" from coach_notes n join workout_logs l using ("WorkoutLogID") where l."TraineeID"='${NOA}'`)) {
      await shows(new RegExp(escape(note)));
    }
  }, 30000);

  test("S18 (as Noa): the balance is the sum of her ledger, with the coach's rewards", async () => {
    open("S18", {}, "trainee");
    await shows(psql(`select coalesce(sum(amount),0) from coin_transactions where "TraineeID"='${NOA}'`));
    for (const [name] of rows(`select "rewardName" from rewards where "CoachID"='${COACH}' and "isActive"`)) await shows(name);
  }, 30000);

  test("S20 (as Noa): this week's challenge of her coach, or none", async () => {
    open("S20", {}, "trainee");
    const current = rows(`select "challengeName" from challenges where "CoachID"='${COACH}' and "weekStart" = ${SUNDAY}`);
    await shows(current.length ? current[0][0] : "אין אתגר השבוע");
  }, 30000);

  test("S02: every trainee with the right program label, and every open invite tagged as invited", async () => {
    open("S02");
    for (const [name, active] of rows(`select t."fullName", (select count(*) from programs p where p."TraineeID" = t."TraineeID" and p."isActive")
                                        from trainees t where t."CoachID" = '${COACH}'`)) {
      expect(await lineOf(name)).toContain(active === "1" ? "יש תוכנית" : "אין תוכנית");
    }
    for (const [name] of rows(`select "inviteeName" from invites where "CoachID" = '${COACH}' and status = 'open' and "expiresAt" > now()`)) {
      expect(await lineOf(name)).toContain("הוזמן, טרם הצטרף");
    }
    expect(screen.getByText(/תשלומים וחשבוניות הם הדגמה בלבד/)).toBeTruthy(); // the demo bar (design stage, decision 2)
  }, 30000);

  test("S05: every exercise in reach with its video label, and an exercise with a video shows it", async () => {
    open("S05");
    const label: Record<string, string> = { youtube: "קישור יוטיוב", upload: "סרטון שהועלה", "": "אין סרטון" };
    const list = rows(`select "exerciseName", coalesce("videoType", ''), "ExerciseID" from exercises
                       where "isActive" and ("CoachID" is null or "CoachID" = '${COACH}')`);
    // Locally the demo list and the real list of 0018 share names (stage 7 plan, execution decision 2), so each name is
    // checked against all its lines.
    const lines = async (name: string) => (await screen.findAllByText(name, {}, { timeout: 8000 }))
      .map((el) => (el.closest(".item, .tile, .side, .card") ?? el.parentElement!).textContent ?? "");
    for (const [name, type] of list) expect((await lines(name)).some((line) => line.includes(label[type]))).toBe(true);
    cleanup();
    const [name, , id] = list.find(([, type, id]) => type === "youtube" && id.startsWith("d0000000"))!;
    open("S05", { exerciseID: id });
    expect(await screen.findByRole("heading", { level: 1, name }, { timeout: 8000 })).toBeTruthy();
    // Stage 5: on the Endpoint the video plays. The demo links hold no video ("https://www.youtube.com/ (דוגמה)"),
    // so the screen says it is not available (UC10 d).
    expect(await screen.findByText("הסרטון אינו זמין כרגע", {}, { timeout: 8000 })).toBeTruthy();
    cleanup();
    // Stage 7, task 20: every real link of the ready-made list (0018) plays in the player.
    for (const [realName, , realID] of list.filter(([, type, id]) => type === "youtube" && id.startsWith("e7000000"))) {
      open("S05", { exerciseID: realID });
      expect(await screen.findByRole("heading", { level: 1, name: realName }, { timeout: 8000 })).toBeTruthy();
      const [[url]] = rows(`select "videoUrl" from exercises where "ExerciseID" = '${realID}'`);
      const frame = await screen.findByTitle("סרטון הדגמה", {}, { timeout: 8000 });
      expect(frame.getAttribute("src")).toBe(`https://www.youtube-nocookie.com/embed/${new URL(url).searchParams.get("v")}`);
      cleanup();
    }
  }, 30000);

  // ---- Stage 5: an uploaded video plays on S05 and on S14 (stage 5 plan, task 7) ----
  test("S05 and S14: an exercise with an uploaded file plays it from the store, for the coach and for Noa", async () => {
    // The file the UC10 system test uploaded (its exercise leaves use at the end), lent to the demo squat for this test.
    const [url] = rows(`select "videoUrl" from exercises where "videoType"='upload' order by "ExerciseID" limit 1`)[0] ?? [];
    expect(url, "no uploaded video yet: run tests/system/uc10-demo-videos.test.mjs on this database first").toBeTruthy();
    const SQUAT = "d0000000-0000-4000-8000-000000002001";
    const before = psql(`select "videoType" || '|' || "videoUrl" from exercises where "ExerciseID"='${SQUAT}'`).split("|");
    psql(`update exercises set "videoType"='upload', "videoUrl"='${url}' where "ExerciseID"='${SQUAT}'`);
    try {
      open("S05", { exerciseID: SQUAT });
      await waitFor(() => expect(document.querySelector(`video[src="${url}"]`)).toBeTruthy(), { timeout: 8000 });
      cleanup();
      open("S14", { videoOf: SQUAT }, "trainee");
      await waitFor(() => expect(document.querySelector(`video[src="${url}"]`)).toBeTruthy(), { timeout: 8000 });
    } finally {
      psql(`update exercises set "videoType"='${before[0]}', "videoUrl"='${before[1]}' where "ExerciseID"='${SQUAT}'`);
    }
  }, 30000);

  // ---- Stage 4c: S11, S13 and S17 (stage 4c plan, task 10) ----
  // Classes the coach sees: from the start of the Israel day three days back (module map v7).
  const COACH_FROM = `((now() at time zone 'Asia/Jerusalem')::date - 3)::timestamp at time zone 'Asia/Jerusalem'`;

  test("S11: every class from three days back, with how many are registered and waiting, and a past class marked", async () => {
    open("S11");
    const list = rows(`select k."status",
                         (select count(*) from class_registrations r where r."ClassID"=k."ClassID" and r."status"='registered'), k."capacity",
                         (select count(*) from class_registrations r where r."ClassID"=k."ClassID" and r."status" in ('waitlist','offered')),
                         k."startsAt" < now()
                       from classes k where k."CoachID"='${COACH}' and k."startsAt" >= ${COACH_FROM}`);
    expect(list.length).toBeGreaterThan(0);
    for (const [status, registered, capacity, waiting] of list) {
      await shows(status === "cancelled" ? "בוטל" : new RegExp(`^${registered}/${capacity} רשומים${waiting !== "0" ? ` · ${waiting} בהמתנה` : ""}$`));
    }
    const past = list.filter(([, , , , p]) => p === "t").length;
    if (past) expect((await screen.findAllByText("עבר", {}, { timeout: 8000 })).length).toBe(past);
    else expect(screen.queryByText("עבר")).toBeNull();
  }, 30000);

  test("S17 (as Noa): every class that has not started, with her own status and place", async () => {
    open("S17", {}, "trainee");
    const list = rows(`select coalesce(r."status", '-'), k."status" from classes k
                       left join class_registrations r on r."ClassID"=k."ClassID" and r."TraineeID"='${NOA}'
                       where k."CoachID"='${COACH}' and k."startsAt" > now()`);
    const count = (want: string) => list.filter(([mine, status]) => status === "active" && mine === want).length;
    if (count("registered")) expect((await screen.findAllByText("רשום", {}, { timeout: 8000 })).length).toBe(count("registered"));
    if (count("waitlist")) await shows(/^בהמתנה, מקום \d+$/);
    await shows(new RegExp(`אפשר לבטל עד ${psql(`select "settingValue" from settings where "BusinessID" = (select "BusinessID" from coaches where "CoachID"='${COACH}') and "settingKey"='cancelHours'`)} שעות`));
  }, 30000);

  test("S13 (as Noa): her unread messages, and her next class or none", async () => {
    open("S13", {}, "trainee");
    for (const [text] of rows(`select "messageText" from notifications where "TraineeID"='${NOA}' and "readAt" is null`)) {
      await shows(new RegExp(escape(text)));
    }
    const next = rows(`select k."place" from classes k join class_registrations r using ("ClassID")
                       where r."TraineeID"='${NOA}' and r."status"='registered' and k."status"='active' and k."startsAt" > now()
                       order by k."startsAt" limit 1`);
    await shows(next.length ? new RegExp(escape(next[0][0])) : "לא נרשמת לשיעור");
  }, 30000);

  test("S13 (as Noa): the greeting has her name from the database, and the next workout names its exercises (map v13)", async () => {
    open("S13", {}, "trainee");
    const [[name]] = rows(`select "fullName" from trainees where "TraineeID"='${NOA}'`);
    expect(await screen.findByRole("heading", { level: 1, name: `${greeting()}, ${name.replace(/\s*\(.*\)/, "")}` }, { timeout: 8000 })).toBeTruthy();
    const exercises = rows(`select distinct e."exerciseName" from workout_items i join workouts w using ("WorkoutID") join programs p using ("ProgramID")
                            join exercises e using ("ExerciseID") where p."TraineeID"='${NOA}' and p."isActive"`).map(([e]) => e);
    const line = (await screen.findAllByText(/ · /, {}, { timeout: 8000 }))[0].textContent!;
    for (const e of line.split(" · ")) expect(exercises).toContain(e);
  }, 30000);

  // ---- Stage 4d: S01, S03, S08, S12 and S19, and S06's note limit (stage 4d plan, task 11) ----
  // SETTINGS belong to the business since stage 4e (0013).
  const setting = (key: string) => psql(`select "settingValue" from settings where "BusinessID" = (select "BusinessID" from coaches where "CoachID"='${COACH}') and "settingKey"='${key}'`);
  const PAY: Record<string, string> = { monthly: "מנוי חודשי", pack10: "חבילת 10 אימונים (כרטיסייה)" };

  test("S01: active trainees, open payments and today's date, from the database", async () => {
    open("S01");
    const active = psql(`select count(*) from trainees where "CoachID"='${COACH}' and "isActive"`);
    const openPays = psql(`select count(*) from payment_requests where "CoachID"='${COACH}' and "status"='open'`);
    await shows(new RegExp(escape(new Date().toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })) + "$")); // "…· יום ד׳, 30.9"
    expect(await lineOf("מתאמנים פעילים")).toContain(active);
    expect(await lineOf("תשלומים פתוחים")).toContain(openPays);
  }, 30000);

  test("S03: Noa's card, with her coins, open payments, program and goal from the database", async () => {
    open("S03", { traineeID: NOA });
    expect(await screen.findByRole("heading", { level: 1, name: psql(`select "fullName" from trainees where "TraineeID"='${NOA}'`) }, { timeout: 8000 })).toBeTruthy();
    expect(await lineOf("מטבעות")).toContain(psql(`select coalesce(sum("amount"),0) from coin_transactions where "TraineeID"='${NOA}'`));
    expect(await lineOf("לתשלום")).toContain(psql(`select count(*) from payment_requests where "TraineeID"='${NOA}' and "status"='open'`));
    const workouts = psql(`select count(*) from workouts w join programs p using ("ProgramID") where p."TraineeID"='${NOA}' and p."isActive"`);
    await shows(`${workouts} אימונים`);
    const [goal] = rows(`select e."exerciseName", g."targetWeight" from personal_goals g join exercises e using ("ExerciseID")
                         where g."TraineeID"='${NOA}' and g."status"='active'`);
    await shows(goal ? new RegExp(`^${escape(`${goal[0]} ${Number(goal[1])} ק"ג`)} · פעיל$`) : "אין יעד פעיל");
  }, 30000);

  test("S08: every request of the coach, with the trainee, type and amount, and the invoice of each paid one", async () => {
    open("S08");
    const list = rows(`select t."fullName", p."paymentType", p."amount", p."status", coalesce(i."invoiceNumber"::text, '') from payment_requests p
                       join trainees t using ("TraineeID") left join invoices i using ("PaymentRequestID") where p."CoachID"='${COACH}'`);
    expect(list.length).toBeGreaterThan(0);
    await shows(`${list[0][0]}`);
    const lines = [...document.querySelectorAll(".item")].map((e) => e.textContent ?? "");
    for (const [name, type, amount, , number] of list) {
      // Each request is one row: the trainee and the type, then the amount with a thousands separator (design stage).
      const money = `₪${Number(amount).toLocaleString("he-IL")}`;
      expect(lines.some((l) => l.includes(`${name} · ${PAY[type]}`) && l.includes(money))).toBe(true);
      if (number) await shows(`חשבונית ${number}`);
    }
    const open_ = list.filter(([, , , status]) => status === "open").length;
    expect((await screen.findAllByText("פתוחה", {}, { timeout: 8000 })).length).toBe(open_);
  }, 30000);

  test("S08: a new request picks a trainee who joined, with no fixed demo ID", async () => {
    open("S08", { request: true });
    const joined = rows(`select "TraineeID" from trainees where "CoachID"='${COACH}' and "isActive"`).map(([id]) => id);
    await waitFor(() => expect(joined).toContain((document.getElementById("payTrainee") as HTMLSelectElement).value), { timeout: 8000 });
  }, 30000);

  test("S12: every value on the screen is the coach's value in SETTINGS", async () => {
    open("S12");
    await waitFor(() => expect((document.getElementById("setting-priceMonthly") as HTMLInputElement).value).not.toBe(""), { timeout: 8000 });
    for (const key of ["coinsWorkout", "coinsAttendance", "priceMonthly", "pricePack10", "cancelHours", "spotOfferHours", "feedbackFull"]) {
      expect((document.getElementById(`setting-${key}`) as HTMLInputElement).value).toBe(setting(key));
    }
  }, 30000);

  test("S19 (as Noa): her own requests, open ones to pay and paid ones with their invoice", async () => {
    open("S19", {}, "trainee");
    const list = rows(`select p."status", coalesce(i."invoiceNumber"::text, '') from payment_requests p left join invoices i using ("PaymentRequestID")
                       where p."TraineeID"='${NOA}'`);
    for (const [, number] of list.filter(([st]) => st === "paid")) await shows(`חשבונית ${number}`);
    const open_ = list.filter(([st]) => st === "open").length;
    if (open_) expect((await screen.findAllByText("תשלום לדוגמה", {}, { timeout: 8000 })).length).toBe(open_);
    expect(screen.queryByText(/מספר כרטיס|CVV/i)).toBeNull();
  }, 30000);

  test("S06: the note form shows the longest note from SETTINGS (stage 4b report, gap 2)", async () => {
    open("S06", { traineeID: NOA, noteFor: "d0000000-0000-4000-8000-000000006001" });
    await shows(new RegExp(`עד ${setting("noteMaxLength")} תווים`));
  }, 30000);

  // ---- Stage 7a, task 2: a change in SETTINGS shows on the coach's screens (map v13) ----
  const withSetting = async (key: string, value: string, check: () => Promise<void>) => {
    const was = setting(key);
    const where = `"BusinessID" = (select "BusinessID" from coaches where "CoachID"='${COACH}') and "settingKey"='${key}'`;
    psql(`update settings set "settingValue"='${value}' where ${where}`);
    try { await check(); } finally { psql(`update settings set "settingValue"='${was}' where ${where}`); }
  };

  test("S08: a new price in SETTINGS is the price beside the type", async () => {
    await withSetting("priceMonthly", "412", async () => {
      open("S08", { request: true });
      expect(await screen.findByRole("option", { name: "מנוי חודשי · ₪412" }, { timeout: 8000 })).toBeTruthy();
    });
  }, 30000);

  test("S05 and S07: a new video limit and new goal coins in SETTINGS show on the screens", async () => {
    signedIn("coach");
    const own = (await call("S05", "exercises", "create_exercise", { name: "פרפר (test)" })).data.ExerciseID; // rule 12: the coach's own
    await withSetting("videoMaxSeconds", "90", async () => {
      open("S05", { exerciseID: own });
      await shows(/העלאת סרטון מהטלפון \(עד 90 שניות ועד \d+ מגה-בייט\)/);
    });
    cleanup();
    await withSetting("coinsGoal", "33", async () => {
      open("S07", { traineeID: NOA });
      await shows(/מתקבלים 33 מטבעות/);
    });
  }, 30000);

  // ---- Stage 4e: S24 to S27, and S12 by the role on show (stage 4e plan, task 9) ----
  const BUSINESS = `(select "BusinessID" from coaches where "CoachID"='${COACH}')`;
  const money = (n: number) => `₪${n.toLocaleString("he-IL")}`;

  test("S24: the month's income, the open sum and the active trainees of the whole demo business", async () => {
    open("S24", {}, "owner");
    const [[income], [openSum], [active]] = [
      rows(`select coalesce(sum(p.amount),0)::int from payment_requests p join coaches c using ("CoachID") where c."BusinessID"=${BUSINESS}
            and p.status='paid' and to_char(p."paidAt" at time zone 'Asia/Jerusalem','YYYY-MM') = to_char(now() at time zone 'Asia/Jerusalem','YYYY-MM')`)[0],
      rows(`select coalesce(sum(p.amount),0)::int from payment_requests p join coaches c using ("CoachID") where c."BusinessID"=${BUSINESS} and p.status='open'`)[0],
      rows(`select count(*) from trainees t join coaches c using ("CoachID") where c."BusinessID"=${BUSINESS} and t."isActive"`)[0],
    ];
    await shows(money(Number(income)));
    expect(await lineOf("מתאמנים פעילים")).toContain(active);
    if (Number(openSum)) await shows(`${money(Number(openSum))} לגבייה`);
  }, 30000);

  test("S25: every coach of the demo business, and every open coach invite as not joined", async () => {
    open("S25", {}, "owner");
    for (const [name] of rows(`select "fullName" from coaches where "BusinessID"=${BUSINESS} and "isActive"`)) await shows(name);
    for (const [name] of rows(`select "inviteeName" from coach_invites where "BusinessID"=${BUSINESS} and status='open' and "expiresAt" > now()`)) {
      expect(await lineOf(name)).toContain("הוזמן, טרם הצטרף");
    }
  }, 30000);

  test("S26: the measures from the database, each with its target not set", async () => {
    open("S26", {}, "owner");
    const [[active]] = rows(`select count(*) from trainees t join coaches c using ("CoachID") where c."BusinessID"=${BUSINESS} and t."isActive"`);
    const [[all]] = rows(`select count(*) from payment_requests p join coaches c using ("CoachID") where c."BusinessID"=${BUSINESS}`);
    expect(await lineOf("תוכניות פעילות לכל מתאמן")).toContain(`מתוך ${active}`);
    expect(await lineOf("תשלומים עם חשבונית")).toContain(`מתוך ${all}`);
    expect((await screen.findAllByText(/יעד: טרם נקבע/)).length).toBe(4);
  }, 30000);

  test("S27: the demo coach's card names their trainees, with no result, note or goal", async () => {
    open("S27", { coachID: COACH }, "owner");
    for (const [name] of rows(`select "fullName" from trainees where "CoachID"='${COACH}' and "isActive"`)) await shows(name);
    expect(screen.queryByText(/שיא יפה בסקוואט|ק"ג|יעד אישי/)).toBeNull();
  }, 30000);

  test("S12: the owner's view can save", async () => {
    open("S12", {}, "owner");
    await waitFor(() => expect((document.getElementById("setting-priceMonthly") as HTMLInputElement).disabled).toBe(false), { timeout: 8000 });
    expect(screen.getByRole("button", { name: "שמירה" })).toBeTruthy();
  }, 30000);
});
