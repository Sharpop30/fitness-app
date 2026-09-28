// Every screen opens on demo data and shows its title (stage 2 plan, task 8). Synthetic data only.
// And, with LIVE_DB=1 against the LOCAL stack, the screens on the Endpoint show what the database holds
// (stage 4a plan, task 8; stage 3 report, the content-check debt).
import { render, screen, cleanup } from "@testing-library/react";
import { setSession } from "../api/client";
import { accessToken } from "../identity/auth";
import { SCREENS } from "../App";
import { NavContext, type Nav } from "../nav";

// No identity token by default, so every screen stays on the demo adapter; the live block below sets one.
vi.mock("../identity/auth", async (original) => ({ ...(await original<object>()), accessToken: vi.fn(() => null) }));

const nav = (role: "coach" | "trainee"): Nav => ({
  role, tab: null, depth: 2, go: () => {}, replace: () => {}, back: () => {}, setTab: () => {}, signIn: () => {}, signOut: () => {}, toast: () => {},
});

const CASES: [string, "coach" | "trainee", Record<string, unknown>, string][] = [
  ["S01", "coach", {}, "הבית שלי"], ["S02", "coach", {}, "מתאמנים"], ["S03", "coach", { traineeID: "d0000000-0000-4000-8000-000000001001" }, "נועה (דוגמה)"],
  ["S04", "coach", { traineeID: "d0000000-0000-4000-8000-000000001001" }, "תוכנית אימון"], ["S05", "coach", {}, "תרגילים"], ["S06", "coach", { traineeID: "d0000000-0000-4000-8000-000000001001" }, "אימונים שבוצעו"],
  ["S07", "coach", { traineeID: "d0000000-0000-4000-8000-000000001001" }, "יעד אישי"], ["S08", "coach", {}, "תשלומים וחשבוניות"], ["S09", "coach", {}, "אתגר שבועי"],
  ["S10", "coach", {}, "תגמולים"], ["S11", "coach", {}, "שיעורים"], ["S12", "coach", {}, "הגדרות"],
  ["S13", "trainee", {}, "הבית שלי"], ["S14", "trainee", {}, "אימון"],
  ["S15", "trainee", { feedback: { done: 9, total: 9, records: [], coins: 10, goal: false, challenge: false, text: "כל הכבוד" } }, "כל הכבוד!"],
  ["S16", "trainee", {}, "האימונים שלי"], ["S17", "trainee", {}, "שיעורים"], ["S18", "trainee", {}, "מטבעות ותגמולים"],
  ["S19", "trainee", {}, "תשלומים"], ["S20", "trainee", {}, "האתגר השבועי"], ["S21", "trainee", {}, "גרף התקדמות"],
  ["S22", "trainee", {}, "הצטרפות"], ["S23", "trainee", {}, "כניסה לאפליקציה"],
];

afterEach(cleanup);

test.each(CASES)("%s opens and shows its title", async (id, role, params, title) => {
  setSession({ role, traineeID: role === "trainee" ? "d0000000-0000-4000-8000-000000001001" : null });
  const S = SCREENS[id];
  render(<NavContext.Provider value={nav(role)}><S {...params} /></NavContext.Provider>);
  expect(await screen.findByRole("heading", { level: 1, name: title })).toBeTruthy();
  expect(screen.getByText(/נתוני דוגמה/)).toBeTruthy();
});

// ---- Content against the database: S02 and S05 on the local Endpoint (run with LIVE_DB=1, local stack up) ----
describe.skipIf(!process.env.LIVE_DB)("live on the local stack: S02 and S05 show the database", () => {
  // The shared helper (tests/system/demo-users.mjs) runs in its own Node process: it reads the local stack's status
  // and signs the demo coach in with a one-run password. Only the local Endpoint and that token come back.
  let psql: (sql: string) => string;
  const COACH = "d0000000-0000-4000-8000-000000000001";

  beforeAll(async () => {
    const { execFileSync, execSync } = await import("node:child_process");
    const helper = `${__dirname}/../../../tests/system/demo-users.mjs`;
    const script = `const m = await import(${JSON.stringify("file://" + encodeURI(helper))});
      const t = await m.demoTokens(); console.log(JSON.stringify({ endpoint: m.ENDPOINT, token: t.coach }));`;
    const out = execFileSync("node", ["--input-type=module", "-e", script], { encoding: "utf8" }).trim().split("\n").pop()!;
    const { endpoint, token } = JSON.parse(out);
    const db = execSync("docker ps --format '{{.Names}}' | grep supabase_db_fitness-app", { encoding: "utf8" }).trim();
    psql = (sql) => execSync(`docker exec -i ${db} psql -U postgres -tA`, { input: sql, encoding: "utf8" }).trim();
    vi.mocked(accessToken).mockReturnValue(token);
    vi.stubEnv("VITE_API_URL", endpoint);
    setSession({ role: "coach", traineeID: null });
  }, 60000);
  afterAll(() => { vi.mocked(accessToken).mockReturnValue(null); vi.unstubAllEnvs(); });

  const rows = (sql: string) => psql(sql).split("\n").filter(Boolean).map((l) => l.split("|"));
  const open = (id: string, params: Record<string, unknown> = {}) => {
    const S = SCREENS[id];
    render(<NavContext.Provider value={nav("coach")}><S {...params} /></NavContext.Provider>);
  };
  const lineOf = async (name: string) => (await screen.findAllByText(name, {}, { timeout: 8000 }))[0].parentElement!.textContent;

  test("S02: every trainee with the right program label, and every open invite tagged as invited", async () => {
    open("S02");
    for (const [name, active] of rows(`select t."fullName", (select count(*) from programs p where p."TraineeID" = t."TraineeID" and p."isActive")
                                        from trainees t where t."CoachID" = '${COACH}'`)) {
      expect(await lineOf(name)).toContain(active === "1" ? "יש תוכנית" : "אין תוכנית");
    }
    for (const [name] of rows(`select "inviteeName" from invites where "CoachID" = '${COACH}' and status = 'open' and "expiresAt" > now()`)) {
      expect(await lineOf(name)).toContain("הוזמן, טרם הצטרף");
    }
    expect(screen.getByText(/נתוני דוגמה/)).toBeTruthy();
  }, 30000);

  test("S05: every exercise in reach with its video label, and an exercise with a video shows it", async () => {
    open("S05");
    const label: Record<string, string> = { youtube: "קישור יוטיוב", upload: "סרטון שהועלה", "": "אין סרטון" };
    const list = rows(`select "exerciseName", coalesce("videoType", ''), "ExerciseID" from exercises
                       where "isActive" and ("CoachID" is null or "CoachID" = '${COACH}')`);
    for (const [name, type] of list) expect(await lineOf(name)).toContain(label[type]);
    cleanup();
    const [name, , id] = list.find(([, type]) => type === "youtube")!;
    open("S05", { exerciseID: id });
    expect(await screen.findByRole("heading", { level: 1, name }, { timeout: 8000 })).toBeTruthy();
    expect(screen.getByText(/סרטון הדגמה מיוטיוב/)).toBeTruthy();
  }, 30000);
});
